import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// State machine: valid transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
    'awaiting_payment': ['paid', 'canceled'],
    'paid': ['accepted', 'canceled'],
    'accepted': ['preparing'],
    'preparing': ['ready'],
    'ready': ['completed', 'out_for_delivery'],
    'out_for_delivery': ['completed'],
    // Refunded can only be done by admin and from certain states
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

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        // Get authenticated user
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
        if (userError || !user) {
            console.error('Auth error:', userError)
            return new Response(
                JSON.stringify({ error: 'Unauthorized', details: userError?.message }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Get user's profile
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

        // Parse request body
        const { order_id, new_status }: { order_id: string; new_status: string } = await req.json()

        if (!order_id || !new_status) {
            return new Response(
                JSON.stringify({ error: 'Missing order_id or new_status' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Use service role for atomic operations
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Fetch current order
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .select('id, org_id, status')
            .eq('id', order_id)
            .single()

        if (orderError || !order) {
            return new Response(
                JSON.stringify({ error: 'Order not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Verify user belongs to order's org
        if (order.org_id !== profile.org_id) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized to update this order' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Check role permissions
        if (new_status === 'refunded' && profile.role !== 'admin') {
            return new Response(
                JSON.stringify({ error: 'Only admins can refund orders' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Validate state transition
        const currentStatus = order.status
        const validNextStates = VALID_TRANSITIONS[currentStatus] || []

        if (!validNextStates.includes(new_status) && new_status !== 'refunded') {
            return new Response(
                JSON.stringify({
                    error: 'Invalid status transition',
                    current_status: currentStatus,
                    requested_status: new_status,
                    valid_transitions: validNextStates,
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Prepare update data
        const updateData: Record<string, any> = {
            status: new_status,
        }

        // Set timestamp based on status
        const timestamp = new Date().toISOString()
        if (new_status === 'accepted') {
            updateData.accepted_at = timestamp
        } else if (new_status === 'completed') {
            updateData.completed_at = timestamp
        } else if (new_status === 'canceled') {
            updateData.canceled_at = timestamp
        }

        // Update order
        const { data: updatedOrder, error: updateError } = await supabaseAdmin
            .from('orders')
            .update(updateData)
            .eq('id', order_id)
            .select()
            .single()

        if (updateError) {
            throw updateError
        }

        // Create notification
        await supabaseAdmin
            .from('notifications')
            .insert({
                org_id: order.org_id,
                user_id: null, // Org-wide
                type: 'order_status',
                payload: {
                    order_id: order_id,
                    old_status: currentStatus,
                    new_status: new_status,
                    updated_by: user.id,
                },
            })

        // TODO: Send customer notification (email/SMS)
        // TODO: Trigger realtime broadcast

        return new Response(
            JSON.stringify({
                success: true,
                order: updatedOrder,
            }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )

    } catch (error) {
        console.error('Error updating order status:', error)
        return new Response(
            JSON.stringify({ error: 'Internal server error', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
