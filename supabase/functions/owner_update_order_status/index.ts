import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// State machine: valid transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
    'draft': ['pending_payment', 'canceled'],
    'pending_payment': ['paid', 'canceled'],
    'awaiting_payment': ['paid', 'canceled'],
    'paid': ['accepted', 'preparing', 'canceled'], // After payment, can accept or start prep
    'accepted': ['preparing', 'canceled'], // Accepted, ready to prepare
    'incoming': ['accepted', 'preparing', 'canceled'], // Legacy: same as paid
    'preparing': ['ready', 'canceled'],
    'ready': ['completed', 'out_for_delivery', 'canceled'],
    'out_for_delivery': ['completed', 'canceled'],
    'completed': [], // Terminal state
    'canceled': [], // Terminal state
    // Refunded can only be done by admin and from certain states
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Verify authentication
        const authHeader = req.headers.get('Authorization')
        console.log('🔐 Auth header received:', authHeader ? 'Present' : 'Missing')
        
        if (!authHeader) {
            console.error('❌ Missing authorization header')
            return new Response(
                JSON.stringify({ error: 'Missing authorization header' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
        console.log('🔧 Supabase config:', { url: supabaseUrl ? 'Set' : 'Missing', key: supabaseAnonKey ? 'Set' : 'Missing' })

        const supabaseClient = createClient(
            supabaseUrl ?? '',
            supabaseAnonKey ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        // Get authenticated user
        console.log('👤 Getting user from auth...')
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
        
        if (userError) {
            console.error('❌ Auth error details:', userError)
        }
        if (!user) {
            console.error('❌ No user returned')
        }
        
        if (userError || !user) {
            console.error('❌ Auth failed:', { error: userError?.message, user: user ? 'Present' : 'Missing' })
            return new Response(
                JSON.stringify({ error: 'Unauthorized', details: userError?.message }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }
        
        console.log('✅ User authenticated:', user.id)

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

        console.log('📝 Step 1: Parsing request body...')
        // Parse request body
        const { order_id, new_status }: { order_id: string; new_status: string } = await req.json()
        console.log('📝 Step 2: Request parsed:', { order_id, new_status })

        if (!order_id || !new_status) {
            console.error('❌ Missing order_id or new_status')
            return new Response(
                JSON.stringify({ error: 'Missing order_id or new_status' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log('📝 Step 3: Creating supabase admin client...')
        // Use service role for atomic operations
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )
        console.log('📝 Step 4: Supabase admin client created')

        console.log('📝 Step 5: Fetching order...')
        // Fetch current order
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .select('id, org_id, status, customer_email, customer_name, fulfillment_type, public_token, order_number')
            .eq('id', order_id)
            .single()
        
        console.log('📝 Step 6: Order fetch result:', { order: order ? 'Found' : 'Not found', error: orderError ? orderError.message : 'None' })

        if (orderError || !order) {
            console.error('❌ Order not found:', orderError)
            return new Response(
                JSON.stringify({ error: 'Order not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log('📝 Step 7: Verifying org...')
        // Verify user belongs to order's org
        if (order.org_id !== profile.org_id) {
            console.error('❌ Org mismatch:', { orderOrg: order.org_id, profileOrg: profile.org_id })
            return new Response(
                JSON.stringify({ error: 'Unauthorized to update this order' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log('📝 Step 8: Checking role permissions...')
        // Check role permissions
        if (new_status === 'refunded' && profile.role !== 'admin') {
            return new Response(
                JSON.stringify({ error: 'Only admins can refund orders' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log('📝 Step 9: Validating status transition...')
        // Validate state transition
        const currentStatus = order.status
        const validNextStates = VALID_TRANSITIONS[currentStatus] || []

        if (!validNextStates.includes(new_status) && new_status !== 'refunded') {
            console.error('❌ Invalid transition:', { current: currentStatus, requested: new_status, valid: validNextStates })
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

        console.log('📝 Step 10: Preparing update data...')
        // Prepare update data
        const updateData: Record<string, any> = {
            status: new_status,
        }

        // Set timestamp based on status
        const timestamp = new Date().toISOString()
        if (new_status === 'accepted') {
            updateData.accepted_at = timestamp
        } else if (new_status === 'ready') {
            updateData.ready_at = timestamp
        } else if (new_status === 'completed') {
            updateData.completed_at = timestamp
        } else if (new_status === 'canceled') {
            updateData.canceled_at = timestamp
        }

        console.log('📝 Step 11: Updating order...', updateData)
        // Update order
        const { data: updatedOrder, error: updateError } = await supabaseAdmin
            .from('orders')
            .update(updateData)
            .eq('id', order_id)
            .select('id, status, order_number, public_token, org_id, customer_email, customer_name, fulfillment_type')
            .single()

        console.log('📝 Step 12: Update result:', { updatedOrder: updatedOrder ? 'Success' : 'Failed', error: updateError ? updateError.message : 'None' })

        if (updateError) {
            console.error('❌ Update error:', updateError)
            throw updateError
        }

        // Create log event
        try {
            await supabaseAdmin
                .from('order_events')
                .insert({
                    order_id: order_id,
                    previous_status: currentStatus,
                    new_status: new_status,
                    changed_by: user.id,
                    metadata: { source: 'owner_portal' }
                })
            console.log('📝 Order event logged')
        } catch (eventErr) {
            console.error('❌ Failed to log order event:', eventErr)
        }

        // Create notification
        try {
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
            console.log('🔔 Notification created')
        } catch (notifErr) {
            console.error('❌ Failed to create notification:', notifErr)
        }

        console.log('✅ Order status updated successfully:', new_status)

        if (new_status === 'ready') {
            try {
                console.log('🔄 Processing ready status, fulfillment_type:', order.fulfillment_type);
                // Handle Pickup Notification
                if (order.fulfillment_type === 'pickup' && order.customer_email) {
                    console.log('📧 Processing pickup notification for:', order.customer_email);
                    const resendApiKey = Deno.env.get('RESEND_API_KEY');
                    console.log('🔑 Resend API key present:', !!resendApiKey);
                    if (resendApiKey) {
                        const origin = req.headers.get('origin') || 'https://flavrr.co';
                        console.log('🔗 Origin:', origin);
                        console.log('📦 updatedOrder:', JSON.stringify(updatedOrder));
                        
                        // Safely get order number
                        const orderNum = updatedOrder.order_number || order.order_number;
                        const publicToken = updatedOrder.public_token || order.public_token;
                        console.log('📝 Order number:', orderNum, 'Public token:', publicToken);
                        
                        if (!publicToken) {
                            console.error('❌ Missing public_token for tracking URL');
                        }
                        
                        const trackingUrl = `${origin}/t/${publicToken}`;
                        const formattedOrderNum = orderNum ? orderNum.toString().padStart(4, '0') : 'N/A';

                        const emailBody = {
                            from: 'Flavrr <orders@flavrr.co>',
                            to: [order.customer_email],
                            subject: `Your order #${formattedOrderNum} is ready for pickup!`,
                            html: `
                                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                                    <h1 style="color: #22c55e; font-size: 28px; margin-bottom: 20px;">✅ Order Ready!</h1>
                                    <p style="font-size: 18px; color: #333;">Hi ${order.customer_name || 'Customer'},</p>
                                    <p style="font-size: 16px; color: #555; line-height: 1.6;">
                                        Great news! Your order <strong>#${formattedOrderNum}</strong> is ready for pickup.
                                    </p>
                                    <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 25px 0;">
                                        <p style="margin: 0; color: #64748b; font-size: 14px;">TRACK YOUR ORDER</p>
                                        <a href="${trackingUrl}" 
                                           style="display: inline-block; background: #22c55e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 10px;">
                                            View Order Status
                                        </a>
                                    </div>
                                    <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
                                        Thank you for ordering with Flavrr!
                                    </p>
                                </div>
                            `
                        };
                        
                        console.log('📤 Sending email to Resend...');
                        const resendRes = await fetch('https://api.resend.com/emails', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${resendApiKey}`,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(emailBody),
                        });
                        
                        if (!resendRes.ok) {
                            const resendErr = await resendRes.text();
                            console.error('❌ Resend API error:', resendRes.status, resendErr);
                        } else {
                            const resendData = await resendRes.json();
                            console.log(`✅ Email sent successfully:`, resendData);
                        }
                    } else {
                        console.log('⚠️ No Resend API key configured, skipping email');
                    }
                }
                // Handle Delivery Logic (Uber Direct)
                else if (order.fulfillment_type === 'delivery') {
                    // Start automated dispatch if not already dispatched
                    // We check idempotency briefly here, but the called function should also handle it.
                    // Actually, let's just call it.
                    console.log('🚚 Order ready for delivery - triggering Uber Direct...');

                    const functionsUrl = Deno.env.get('SUPABASE_URL')
                        ? `${Deno.env.get('SUPABASE_URL')}/functions/v1/uber_create_delivery`
                        : 'http://localhost:54321/functions/v1/uber_create_delivery'; // Fallback for local

                    // Fire and wait - we want to report error if it fails
                    const uberRes = await fetch(functionsUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': authHeader // Pass through the user's token
                        },
                        body: JSON.stringify({ order_id: order_id })
                    });

                    if (!uberRes.ok) {
                        const uberErr = await uberRes.json().catch(() => ({}));
                        console.error('❌ Auto-dispatch failed:', uberErr);
                        // Return this error to the UI so we can show "Ready but dispatch failed"
                        return new Response(
                            JSON.stringify({
                                success: true,
                                order: updatedOrder,
                                warning: `Order marked Ready, but Uber dispatch failed: ${uberErr.error || uberRes.statusText}`,
                                uber_dispatch_failed: true
                            }),
                            {
                                status: 200,
                                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                            }
                        )
                    } else {
                        const uberData = await uberRes.json();
                        console.log('✅ Auto-dispatch success:', uberData);
                        return new Response(
                            JSON.stringify({
                                success: true,
                                order: updatedOrder,
                                uber_delivery: uberData.delivery
                            }),
                            {
                                status: 200,
                                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                            }
                        )
                    }
                }
            } catch (err) {
                console.error('❌ Failed to process post-update actions:', err);
                // Don't fail the request just because notification/dispatch failed
            }
        }

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
