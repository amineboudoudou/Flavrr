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
            Deno.env.get('SUPABASE_ANON_KEY') ?? ''
        )

        console.log('🔐 Attempting to authenticate user...')

        // Extract JWT token from Authorization header and pass it explicitly
        const jwt = authHeader.replace('Bearer ', '')

        // Get authenticated user - MUST pass JWT explicitly in Edge Functions
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt)

        if (userError || !user) {
            console.error('❌ Auth failed:', {
                error: userError?.message,
                hasJWT: !!jwt,
                jwtLength: jwt?.length
            })
            return new Response(
                JSON.stringify({
                    error: 'Unauthorized',
                    details: userError?.message || 'Invalid or expired session',
                    hint: 'Please sign out and sign in again'
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
        const status = url.searchParams.get('status')
        const dateFrom = url.searchParams.get('date_from')
        const dateTo = url.searchParams.get('date_to')
        const limit = parseInt(url.searchParams.get('limit') || '50', 10)
        const offset = parseInt(url.searchParams.get('offset') || '0', 10)

        // Build query
        let query = authedClient
            .from('orders')
            .select(`
        id,
        public_token,
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
      `, { count: 'exact' })
            .eq('org_id', profile.org_id)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        // Apply filters
        if (status) {
            const statusArray = status.split(',')
            query = query.in('status', statusArray)
        }

        if (dateFrom) {
            query = query.gte('created_at', dateFrom)
        }

        if (dateTo) {
            query = query.lte('created_at', dateTo)
        }

        const { data: orders, error: ordersError, count } = await query

        if (ordersError) {
            throw ordersError
        }

        // Fetch items for each order
        const orderIds = orders?.map(o => o.id) || []
        const { data: items, error: itemsError } = await authedClient
            .from('order_items')
            .select(`
        id,
        order_id,
        name_snapshot,
        price_cents_snapshot,
        quantity,
        modifiers,
        notes
      `)
            .in('order_id', orderIds)

        if (itemsError) {
            throw itemsError
        }

        // Group items by order
        const itemsByOrder = (items || []).reduce((acc, item) => {
            if (!acc[item.order_id]) {
                acc[item.order_id] = []
            }
            acc[item.order_id].push(item)
            return acc
        }, {} as Record<string, any[]>)

        // Attach items to orders
        const ordersWithItems = orders?.map(order => ({
            ...order,
            items: itemsByOrder[order.id] || []
        }))

        console.log(`✅ Returning ${ordersWithItems?.length || 0} orders`)

        return new Response(
            JSON.stringify({
                orders: ordersWithItems,
                pagination: {
                    total: count,
                    limit,
                    offset,
                },
            }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )

    } catch (error) {
        console.error('❌ Error listing orders:', error)
        return new Response(
            JSON.stringify({ error: 'Internal server error', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
