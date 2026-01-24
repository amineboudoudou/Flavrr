import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const url = new URL(req.url)
        const token = url.searchParams.get('token')

        if (!token) {
            return new Response(
                JSON.stringify({ error: 'token parameter required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Fetch order by public token (no auth required)
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .select(`
        id,
        public_token,
        status,
        fulfillment_type,
        customer_name,
        subtotal_cents,
        tax_cents,
        tip_cents,
        delivery_fee_cents,
        total_cents,
        created_at,
        paid_at,
        accepted_at,
        completed_at
      `)
            .eq('public_token', token)
            .single()

        if (orderError || !order) {
            return new Response(
                JSON.stringify({ error: 'Order not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Fetch order items
        const { data: items, error: itemsError } = await supabaseAdmin
            .from('order_items')
            .select(`
        id,
        name_snapshot,
        price_cents_snapshot,
        quantity,
        modifiers,
        notes
      `)
            .eq('order_id', order.id)

        if (itemsError) {
            throw itemsError
        }

        // Fetch delivery tracking if exists
        const { data: delivery } = await supabaseAdmin
            .from('deliveries')
            .select(`
        status,
        pickup_eta,
        dropoff_eta,
        tracking_url
      `)
            .eq('order_id', order.id)
            .single()

        // Structure safe response (no sensitive data)
        const response = {
            order: {
                public_token: order.public_token,
                status: order.status,
                fulfillment_type: order.fulfillment_type,
                customer_name: order.customer_name,
                subtotal_cents: order.subtotal_cents,
                tax_cents: order.tax_cents,
                tip_cents: order.tip_cents,
                delivery_fee_cents: order.delivery_fee_cents,
                total_cents: order.total_cents,
                created_at: order.created_at,
                paid_at: order.paid_at,
                accepted_at: order.accepted_at,
                completed_at: order.completed_at,
            },
            items,
            delivery: delivery || null,
        }

        return new Response(
            JSON.stringify(response),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )

    } catch (error) {
        console.error('Error fetching order:', error)
        return new Response(
            JSON.stringify({ error: 'Internal server error', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
