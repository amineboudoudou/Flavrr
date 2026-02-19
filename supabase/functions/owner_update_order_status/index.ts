import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VALID_TRANSITIONS: Record<string, string[]> = {
    'draft': ['pending_payment', 'canceled'],
    'pending_payment': ['paid', 'canceled'],
    'awaiting_payment': ['paid', 'canceled'],
    'paid': ['accepted', 'preparing', 'canceled'],
    'accepted': ['preparing', 'canceled'],
    'incoming': ['accepted', 'preparing', 'canceled'],
    'preparing': ['ready', 'canceled'],
    'ready': ['completed', 'out_for_delivery', 'canceled'],
    'out_for_delivery': ['completed', 'canceled'],
    'completed': [],
    'canceled': [],
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

        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
        
        const supabaseClient = createClient(
            supabaseUrl ?? '',
            supabaseAnonKey ?? '',
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

        const { order_id, new_status }: { order_id: string; new_status: string } = await req.json()

        if (!order_id || !new_status) {
            return new Response(
                JSON.stringify({ error: 'Missing order_id or new_status' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .select('id, org_id, status, customer_email, customer_name, fulfillment_type, public_token, order_number')
            .eq('id', order_id)
            .single()

        if (orderError || !order) {
            return new Response(
                JSON.stringify({ error: 'Order not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (order.org_id !== profile.org_id) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const currentStatus = order.status
        const validNextStates = VALID_TRANSITIONS[currentStatus] || []

        if (!validNextStates.includes(new_status)) {
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

        const updateData: Record<string, any> = { status: new_status }
        const timestamp = new Date().toISOString()
        
        if (new_status === 'accepted') updateData.accepted_at = timestamp
        else if (new_status === 'ready') updateData.ready_at = timestamp
        else if (new_status === 'completed') updateData.completed_at = timestamp
        else if (new_status === 'canceled') updateData.canceled_at = timestamp

        const { data: updatedOrder, error: updateError } = await supabaseAdmin
            .from('orders')
            .update(updateData)
            .eq('id', order_id)
            .select('id, status, order_number, public_token, org_id, customer_email, customer_name, fulfillment_type')
            .single()

        if (updateError || !updatedOrder) {
            return new Response(
                JSON.stringify({ error: 'Failed to update order', details: updateError?.message }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Non-blocking: log event
        supabaseAdmin.from('order_events').insert({
            order_id,
            previous_status: currentStatus,
            new_status,
            changed_by: user.id,
            metadata: { source: 'owner_portal' }
        }).then(() => {}).catch(() => {})

        // Non-blocking: send email for pickup orders marked ready
        if (new_status === 'ready' && order.fulfillment_type === 'pickup' && order.customer_email) {
            const resendApiKey = Deno.env.get('RESEND_API_KEY')
            if (resendApiKey && updatedOrder.public_token) {
                const origin = req.headers.get('origin') || 'https://flavrr.co'
                const orderNum = updatedOrder.order_number || order.order_number
                const formattedNum = typeof orderNum === 'number' ? orderNum.toString().padStart(4, '0') : '0000'
                
                fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${resendApiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        from: 'Flavrr <orders@flavrr.co>',
                        to: [order.customer_email],
                        subject: `Your order #${formattedNum} is ready for pickup!`,
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                                <h1 style="color: #22c55e; font-size: 28px; margin-bottom: 20px;">✅ Order Ready!</h1>
                                <p style="font-size: 18px; color: #333;">Hi ${order.customer_name || 'Customer'},</p>
                                <p style="font-size: 16px; color: #555; line-height: 1.6;">
                                    Great news! Your order <strong>#${formattedNum}</strong> is ready for pickup.
                                </p>
                                <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 25px 0;">
                                    <p style="margin: 0; color: #64748b; font-size: 14px;">TRACK YOUR ORDER</p>
                                    <a href="${origin}/t/${updatedOrder.public_token}" 
                                       style="display: inline-block; background: #22c55e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 10px;">
                                        View Order Status
                                    </a>
                                </div>
                                <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
                                    Thank you for ordering with Flavrr!
                                </p>
                            </div>
                        `
                    }),
                }).catch(() => {})
            }
        }

        return new Response(
            JSON.stringify({ success: true, order: updatedOrder }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: 'Internal server error', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
