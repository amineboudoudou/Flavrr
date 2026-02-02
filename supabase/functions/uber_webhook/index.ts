import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const webhookSecret = Deno.env.get('UBER_DIRECT_WEBHOOK_SECRET') ?? ''

// Map Uber status to our delivery status
const STATUS_MAPPING: Record<string, string> = {
    'pending': 'delivery_requested',
    'pickup': 'pickup',
    'pickup_complete': 'dropoff',
    'dropoff': 'dropoff',
    'delivered': 'delivered',
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
            .eq('uber_delivery_id', deliveryId)
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
        if (newStatus === 'pickup' || newStatus === 'dropoff') {
            orderStatus = 'out_for_delivery'
        } else if (newStatus === 'delivered') {
            orderStatus = 'delivered'
        }

        if (orderStatus) {
            const orderUpdateData: Record<string, any> = { status: orderStatus }
            if (orderStatus === 'delivered') {
                orderUpdateData.delivered_at = new Date().toISOString()
            }

            await supabaseAdmin
                .from('orders')
                .update(orderUpdateData)
                .eq('id', delivery.order_id)
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
