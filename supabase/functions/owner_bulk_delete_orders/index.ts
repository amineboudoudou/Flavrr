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
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Missing authorization header' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
        if (userError || !user) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('org_id, role')
            .eq('user_id', user.id)
            .single()

        if (profileError || !profile) {
            return new Response(
                JSON.stringify({ error: 'Profile not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (!['owner', 'admin'].includes(profile.role)) {
            return new Response(
                JSON.stringify({ error: 'Insufficient permissions to delete orders' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const { order_ids }: { order_ids: string[] } = await req.json()

        if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
            return new Response(
                JSON.stringify({ error: 'Missing or empty order_ids array' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (order_ids.length > 50) {
            return new Response(
                JSON.stringify({ error: 'Cannot delete more than 50 orders at once' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Verify all orders belong to user's org
        const { data: orders, error: ordersError } = await supabaseAdmin
            .from('orders')
            .select('id, org_id')
            .in('id', order_ids)

        if (ordersError) {
            throw ordersError
        }

        const validIds = (orders || [])
            .filter(o => o.org_id === profile.org_id)
            .map(o => o.id)

        if (validIds.length === 0) {
            return new Response(
                JSON.stringify({ error: 'No valid orders found to delete', deleted: 0 }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Delete related records first
        await supabaseAdmin.from('order_events').delete().in('order_id', validIds)
        await supabaseAdmin.from('order_items').delete().in('order_id', validIds)

        // Delete the orders
        const { error: deleteError } = await supabaseAdmin
            .from('orders')
            .delete()
            .in('id', validIds)

        if (deleteError) {
            throw deleteError
        }

        return new Response(
            JSON.stringify({ success: true, deleted: validIds.length }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Error bulk deleting orders:', error)
        return new Response(
            JSON.stringify({ error: 'Internal server error', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
