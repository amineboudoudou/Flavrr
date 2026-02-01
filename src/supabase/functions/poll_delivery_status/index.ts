import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getUberAccessToken } from '../_shared/uber-auth.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UBER_API_BASE = 'https://api.uber.com/v1/customers'
const UBER_CUSTOMER_ID = Deno.env.get('UBER_CUSTOMER_ID')

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Get all active deliveries (not completed/canceled)
        const { data: deliveries, error: fetchError } = await supabaseAdmin
            .from('deliveries')
            .select('id, external_id, order_id, status')
            .in('status', ['created', 'courier_assigned', 'picked_up'])

        if (fetchError) {
            throw fetchError
        }

        if (!deliveries || deliveries.length === 0) {
            console.log('No active deliveries to poll')
            return new Response(
                JSON.stringify({ message: 'No active deliveries', count: 0 }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log(`Polling ${deliveries.length} active deliveries`)

        const accessToken = await getUberAccessToken()
        let updatedCount = 0

        for (const delivery of deliveries) {
            try {
                // Fetch status from Uber API
                const response = await fetch(
                    `${UBER_API_BASE}/${UBER_CUSTOMER_ID}/deliveries/${delivery.external_id}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        }
                    }
                )

                if (!response.ok) {
                    console.error(`Failed to fetch delivery ${delivery.external_id}:`, response.status)
                    continue
                }

                const uberData = await response.json()
                console.log(`Delivery ${delivery.external_id} status: ${uberData.status}`)

                // Update delivery record
                await supabaseAdmin
                    .from('deliveries')
                    .update({
                        status: uberData.status || delivery.status,
                        raw_response: uberData,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', delivery.id)

                // Update order status based on delivery status
                let orderStatus: string | null = null
                if (uberData.status === 'courier_assigned' || uberData.status === 'pickup') {
                    orderStatus = 'out_for_delivery'
                } else if (uberData.status === 'delivered' || uberData.status === 'dropoff') {
                    orderStatus = 'completed'
                }

                if (orderStatus) {
                    // Get current order status
                    const { data: currentOrder } = await supabaseAdmin
                        .from('orders')
                        .select('status')
                        .eq('id', delivery.order_id)
                        .single()

                    // Only update if status changed
                    if (currentOrder && currentOrder.status !== orderStatus) {
                        const orderUpdateData: any = {
                            status: orderStatus,
                            uber_status: uberData.status,
                            last_uber_sync_at: new Date().toISOString()
                        }

                        if (orderStatus === 'completed') {
                            orderUpdateData.completed_at = new Date().toISOString()
                        }

                        await supabaseAdmin
                            .from('orders')
                            .update(orderUpdateData)
                            .eq('id', delivery.order_id)

                        // Log the status change
                        await supabaseAdmin
                            .from('order_events')
                            .insert({
                                order_id: delivery.order_id,
                                previous_status: currentOrder.status,
                                new_status: orderStatus,
                                changed_by: 'system_delivery_poll',
                                metadata: {
                                    delivery_status: uberData.status,
                                    polled_at: new Date().toISOString()
                                }
                            })

                        console.log(`Order ${delivery.order_id} status updated: ${currentOrder.status} → ${orderStatus}`)
                        updatedCount++
                    }
                }

            } catch (error) {
                console.error(`Error polling delivery ${delivery.external_id}:`, error)
                // Continue with next delivery
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                total_deliveries: deliveries.length,
                updated_orders: updatedCount
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Polling error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
