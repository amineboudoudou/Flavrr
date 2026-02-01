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
        // Verify authentication
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Missing authorization header' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Initialize Supabase client
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        console.log('🔐 Attempting to authenticate user...')

        // Get authenticated user
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser()

        if (userError || !user) {
            console.error('❌ Auth failed:', userError?.message)
            return new Response(
                JSON.stringify({
                    error: 'Unauthorized',
                    details: userError?.message || 'Invalid or expired session',
                }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log('✅ User authenticated:', user.id)

        // Now create authenticated client for database operations
        const authedClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        // Get user's profile to fetch org_id
        const { data: profile, error: profileError } = await authedClient
            .from('profiles')
            .select('org_id, role')
            .eq('user_id', user.id)
            .single()

        if (profileError || !profile) {
            console.error('❌ Profile not found:', profileError)
            return new Response(
                JSON.stringify({ error: 'Profile not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log('✅ Profile loaded, org_id:', profile.org_id)

        // Parse query parameters
        const url = new URL(req.url)
        const orderId = url.searchParams.get('order_id')

        if (!orderId) {
            return new Response(
                JSON.stringify({ error: 'Missing order_id' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Fetch order
        const { data: order, error: orderError } = await authedClient
            .from('orders')
            .select(`
                id,
                org_id,
                order_number,
                status,
                fulfillment_type,
                customer_name,
                customer_phone,
                customer_email,
                delivery_address,
                notes,
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
            .eq('id', orderId)
            .eq('org_id', profile.org_id) // Security check
            .single()

        if (orderError || !order) {
            console.error('❌ Order not found:', orderError)
            return new Response(
                JSON.stringify({ error: 'Order not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Fetch order items
        const { data: items, error: itemsError } = await authedClient
            .from('order_items')
            .select(`
                id,
                name_snapshot,
                price_cents_snapshot,
                quantity,
                modifiers,
                notes
            `)
            .eq('order_id', orderId)

        if (itemsError) {
            throw itemsError
        }

        // Map internal cents to frontend dollars for consistency with types.ts
        const formattedOrder = {
            ...order,
            subtotal_cents: order.subtotal_cents,
            tax_cents: order.tax_cents,
            tip_cents: order.tip_cents,
            delivery_fee_cents: order.delivery_fee_cents,
            total_cents: order.total_cents,

            // frontend mapped fields
            subtotal: order.subtotal_cents / 100,
            tax: order.tax_cents / 100,
            tip: order.tip_cents / 100,
            delivery_fee: order.delivery_fee_cents / 100,
            total: order.total_cents / 100,
            items: items.map(item => ({
                id: item.id,
                name: item.name_snapshot,
                price: item.price_cents_snapshot / 100,
                quantity: item.quantity,
                modifiers: Array.isArray(item.modifiers) ? item.modifiers : [],
                notes: item.notes
            }))
        }

        console.log(`✅ Returning order #${order.order_number}`)

        return new Response(
            JSON.stringify(formattedOrder),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )

    } catch (error) {
        console.error('❌ Error getting order:', error)
        return new Response(
            JSON.stringify({ error: 'Internal server error', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
