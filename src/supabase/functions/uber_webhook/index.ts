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
        console.log('🔔 UBER WEBHOOK RECEIVED', {
            method: req.method,
            headers: Object.fromEntries(req.headers.entries()),
        })

        // Verify webhook (if Uber provides signature)
        const signature = req.headers.get('x-uber-signature')
        console.log('📝 Webhook signature:', signature || 'none')

        const body = await req.json()
        console.log('📦 WEBHOOK PAYLOAD:', JSON.stringify(body, null, 2))

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Parse webhook payload
        const deliveryId = body.delivery_id || body.id
        const eventType = body.event_type || body.status
        const status = body.status

        console.log('🔍 PARSED WEBHOOK DATA:', {
            deliveryId,
            eventType,
            status,
        })

        if (!deliveryId) {
            console.error('❌ No delivery_id in webhook payload')
            return new Response(JSON.stringify({ error: 'No delivery_id' }), { status: 400 })
        }

        // Fetch delivery from database by uber_delivery_id
        console.log('🔍 Looking up delivery by uber_delivery_id:', deliveryId)
        const { data: delivery, error: deliveryError } = await supabaseAdmin
            .from('deliveries')
            .select('id, order_id, status, uber_delivery_id')
            .eq('uber_delivery_id', deliveryId)
            .single()

        if (deliveryError || !delivery) {
            console.error('❌ Delivery not found:', deliveryId, 'Error:', deliveryError)
            return new Response(JSON.stringify({ error: 'Delivery not found' }), { status: 404 })
        }

        console.log('✅ Delivery found:', {
            delivery_db_id: delivery.id,
            order_id: delivery.order_id,
            current_status: delivery.status,
        })

        // Map Uber status to our status
        const newStatus = STATUS_MAPPING[status] || delivery.status
        console.log('🔄 STATUS MAPPING:', {
            uber_status: status,
            mapped_status: newStatus,
            previous_status: delivery.status,
        })

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
            console.error('❌ Failed to update delivery:', updateError)
            throw updateError
        }

        console.log('✅ Delivery record updated:', delivery.id)

        // Update order status based on delivery status
        let orderStatus: string | null = null
        let orderStatusReason = ''

        if (newStatus === 'picked_up') {
            orderStatus = 'out_for_delivery'
            orderStatusReason = 'Courier picked up order'
        } else if (newStatus === 'dropped_off') {
            orderStatus = 'completed'
            orderStatusReason = 'Delivery completed'
        }

        console.log('🔄 ORDER STATUS UPDATE:', {
            order_id: delivery.order_id,
            new_order_status: orderStatus,
            reason: orderStatusReason,
        })

        if (orderStatus) {
            const orderUpdateData: Record<string, any> = {
                status: orderStatus,
                delivery_status: newStatus,
                uber_status: status,
                last_uber_sync_at: new Date().toISOString()
            }

            if (orderStatus === 'completed') {
                orderUpdateData.completed_at = new Date().toISOString()
                orderUpdateData.delivered_at = new Date().toISOString()
            }

            // Get current order status for logging
            const { data: currentOrder } = await supabaseAdmin
                .from('orders')
                .select('status')
                .eq('id', delivery.order_id)
                .single()

            console.log('📝 Current order status:', currentOrder?.status, '→ Updating to:', orderStatus)

            const { error: orderUpdateError } = await supabaseAdmin
                .from('orders')
                .update(orderUpdateData)
                .eq('id', delivery.order_id)

            if (orderUpdateError) {
                console.error('❌ Failed to update order status:', orderUpdateError)
            } else {
                console.log('✅ Order status updated:', delivery.order_id, '→', orderStatus)
            }

            // Log the status change
            const { error: eventError } = await supabaseAdmin
                .from('order_events')
                .insert({
                    order_id: delivery.order_id,
                    previous_status: currentOrder?.status || 'ready',
                    new_status: orderStatus,
                    changed_by: 'system_uber_webhook',
                    metadata: {
                        delivery_status: newStatus,
                        uber_status: status,
                        event_type: eventType,
                        delivery_id: deliveryId,
                    }
                })

            if (eventError) {
                console.error('❌ Failed to log order event:', eventError)
            }
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

        console.log(`✅ WEBHOOK COMPLETE: Delivery ${deliveryId} updated to status: ${newStatus}`)

        return new Response(JSON.stringify({ 
            received: true,
            delivery_id: deliveryId,
            status: newStatus,
            order_id: delivery.order_id,
        }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        console.error('❌ Uber webhook error:', error)
        return new Response(
            JSON.stringify({ error: error.message, timestamp: new Date().toISOString() }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
    }
})
