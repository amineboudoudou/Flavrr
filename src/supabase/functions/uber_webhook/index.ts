import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const webhookSecret = Deno.env.get('UBER_DIRECT_WEBHOOK_SECRET') ?? ''

// Map Uber status to our delivery status
const STATUS_MAPPING: Record<string, string> = {
    'pending': 'created',
    'pickup': 'courier_assigned',
    'pickup_complete': 'picked_up',
    'dropoff': 'picked_up',
    'delivered': 'dropped_off',
    'canceled': 'canceled',
    'returned': 'failed',
}

serve(async (req) => {
    try {
        // Verify webhook (if Uber provides signature)
        const signature = req.headers.get('x-uber-signature')
        // TODO: Implement signature verification if Uber provides it

        const body = await req.json()
        console.log('Received Uber webhook:', JSON.stringify(body, null, 2))

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Parse webhook payload
        const deliveryId = body.delivery_id || body.id
        const eventType = body.event_type || body.status
        const status = body.status

        if (!deliveryId) {
            console.error('No delivery_id in webhook payload')
            return new Response(JSON.stringify({ error: 'No delivery_id' }), { status: 400 })
        }

        // Fetch delivery from database
        const { data: delivery, error: deliveryError } = await supabaseAdmin
            .from('deliveries')
            .select('id, order_id, status')
            .eq('external_id', deliveryId)
            .single()

        if (deliveryError || !delivery) {
            console.error('Delivery not found:', deliveryId)
            return new Response(JSON.stringify({ error: 'Delivery not found' }), { status: 404 })
        }

        // Map Uber status to our status
        const newStatus = STATUS_MAPPING[status] || delivery.status

        // Update delivery record
        const updateData: Record<string, any> = {
            status: newStatus,
            raw_response: body,
        }

        if (body.courier) {
            updateData.pickup_eta = body.pickup?.eta
            updateData.dropoff_eta = body.dropoff?.eta
        }

        const { error: updateError } = await supabaseAdmin
            .from('deliveries')
            .update(updateData)
            .eq('id', delivery.id)

        if (updateError) {
            throw updateError
        }

        // Update order status based on delivery status
        let orderStatus: string | null = null
        if (newStatus === 'picked_up') {
            orderStatus = 'out_for_delivery'
        } else if (newStatus === 'dropped_off') {
            orderStatus = 'completed'
        }

        if (orderStatus) {
            const orderUpdateData: Record<string, any> = {
                status: orderStatus,
                uber_status: status,
                last_uber_sync_at: new Date().toISOString()
            }

            if (orderStatus === 'completed') {
                orderUpdateData.completed_at = new Date().toISOString()
            }

            // Get current order status for logging
            const { data: currentOrder } = await supabaseAdmin
                .from('orders')
                .select('status')
                .eq('id', delivery.order_id)
                .single()

            await supabaseAdmin
                .from('orders')
                .update(orderUpdateData)
                .eq('id', delivery.order_id)

            // Log the status change
            await supabaseAdmin
                .from('order_events')
                .insert({
                    order_id: delivery.order_id,
                    previous_status: currentOrder?.status || 'ready',
                    new_status: orderStatus,
                    changed_by: 'system_uber_webhook',
                    metadata: {
                        delivery_status: newStatus,
                        uber_status: status,
                        event_type: eventType
                    }
                })
        }

        // Create notification
        const { data: order } = await supabaseAdmin
            .from('orders')
            .select('org_id')
            .eq('id', delivery.order_id)
            .single()

        if (order) {
            await supabaseAdmin
                .from('notifications')
                .insert({
                    org_id: order.org_id,
                    user_id: null,
                    type: 'delivery_update',
                    payload: {
                        order_id: delivery.order_id,
                        delivery_status: newStatus,
                        event_type: eventType,
                    },
                })
        }

        console.log(`Delivery ${deliveryId} updated to status: ${newStatus}`)

        return new Response(JSON.stringify({ received: true }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        console.error('Uber webhook error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
    }
})
