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
    'ready': ['completed', 'out_for_delivery', 'canceled', 'preparing'],
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

        // SELECT with uber_delivery_id for idempotency check
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .select('id, org_id, status, customer_email, customer_name, fulfillment_type, public_token, order_number, uber_delivery_id, uber_tracking_url, delivery_address')
            .eq('id', order_id)
            .single()

        if (orderError || !order) {
            return new Response(
                JSON.stringify({ error: 'Order not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log('📦 ORDER STATUS UPDATE TRIGGERED', {
            order_id: order.id,
            new_status,
            current_status: order.status,
            fulfillment_type: order.fulfillment_type,
            existing_delivery_id: order.uber_delivery_id,
        })

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

        const fulfillment = (order.fulfillment_type || '').toLowerCase()

        console.log('🚚 DELIVERY CHECK', {
            new_status,
            fulfillment,
            is_delivery: fulfillment === 'delivery',
            has_existing_delivery: !!order.uber_delivery_id,
        })

        // For delivery orders marked ready: trigger Uber delivery creation with strict checks
        if (new_status === 'ready' && fulfillment === 'delivery') {
            // IDEMPOTENCY: Skip if delivery already exists
            if (order.uber_delivery_id) {
                console.log('⏭️ Delivery already exists, skipping Uber creation', {
                    order_id,
                    uber_delivery_id: order.uber_delivery_id,
                })
            } else {
                console.log('🚚 Creating Uber delivery for order:', order_id)
                
                // Call uber_create_delivery via internal API
                const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
                const functionsUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/uber_create_delivery`
                
                try {
                    const uberResponse = await fetch(functionsUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + serviceRoleKey,
                            'X-Service-Role-Key': serviceRoleKey || '',
                        },
                        body: JSON.stringify({ order_id }),
                    })

                    console.log('📡 UBER RESPONSE STATUS', uberResponse.status)

                    if (uberResponse.ok) {
                        const result = await uberResponse.json()
                        console.log('✅ UBER DELIVERY CREATED', {
                            delivery_id: result.delivery_id,
                            uber_delivery_id: result.uber_delivery_id,
                            tracking_url: result.tracking_url,
                        })

                        // Update order with delivery info
                        const { error: deliveryUpdateError } = await supabaseAdmin
                            .from('orders')
                            .update({
                                uber_delivery_id: result.uber_delivery_id,
                                uber_tracking_url: result.tracking_url,
                                delivery_status: 'pending',
                            })
                            .eq('id', order_id)

                        if (deliveryUpdateError) {
                            console.error('❌ Failed to save delivery info to order:', deliveryUpdateError)
                        }
                    } else {
                        const errorText = await uberResponse.text()
                        console.error('❌ UBER DELIVERY FAILED', {
                            status: uberResponse.status,
                            error: errorText,
                        })

                        // Update order with delivery error but keep status as ready
                        await supabaseAdmin
                            .from('orders')
                            .update({
                                delivery_error: `Failed to create delivery: ${errorText}`,
                            })
                            .eq('id', order_id)

                        // Return success but with warning - order is ready but delivery failed
                        return new Response(
                            JSON.stringify({
                                success: true,
                                order: updatedOrder,
                                warning: 'Order marked ready but delivery creation failed. Please check delivery settings and try again.',
                                delivery_error: errorText,
                            }),
                            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                        )
                    }
                } catch (err: any) {
                    console.error('❌ EXCEPTION CALLING UBER:', err.message)
                    
                    // Save error to order
                    await supabaseAdmin
                        .from('orders')
                        .update({
                            delivery_error: `Exception: ${err.message}`,
                        })
                        .eq('id', order_id)

                    return new Response(
                        JSON.stringify({
                            success: true,
                            order: updatedOrder,
                            warning: 'Order marked ready but delivery creation failed.',
                            delivery_error: err.message,
                        }),
                        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    )
                }
            }
        }

        console.log('✅ ORDER UPDATE COMPLETE', {
            order_id,
            status: new_status,
            has_delivery: !!order.uber_delivery_id,
        })

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
