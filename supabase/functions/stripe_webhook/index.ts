import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
    apiVersion: '2023-10-16',
})

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper to send order confirmation email
async function sendOrderConfirmationEmail(order: any, origin: string, resendApiKey: string) {
    console.log('📧 Attempting to send confirmation email for order:', order.order_number)
    
    if (!order.customer_email) {
        console.log('⚠️ No customer email found, skipping email')
        return
    }
    if (!order.public_token) {
        console.log('⚠️ No public_token found, skipping email')
        return
    }
    if (!resendApiKey) {
        console.log('⚠️ No RESEND_API_KEY found, skipping email')
        return
    }
    
    const orderNum = typeof order.order_number === 'number' 
        ? order.order_number.toString().padStart(4, '0') 
        : '0000'
    const trackingUrl = `${origin}/t/${order.public_token}`
    
    console.log('📧 Sending email to:', order.customer_email)
    
    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: 'Flavrr <orders@flavrr.co>',
                to: [order.customer_email],
                subject: `Order #${orderNum} confirmed - Thank you for your order!`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h1 style="color: #22c55e; font-size: 28px; margin-bottom: 20px;">🎉 Order Confirmed!</h1>
                        <p style="font-size: 18px; color: #333;">Hi ${order.customer_name || 'Customer'},</p>
                        <p style="font-size: 16px; color: #555; line-height: 1.6;">
                            Thank you for your order! We've received your order <strong>#${orderNum}</strong> and it's being prepared.
                        </p>
                        <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 25px 0;">
                            <p style="margin: 0; color: #64748b; font-size: 14px;">TRACK YOUR ORDER</p>
                            <a href="${trackingUrl}" 
                               style="display: inline-block; background: #22c55e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 10px;">
                                View Order Status
                            </a>
                            <p style="margin: 10px 0 0 0; color: #64748b; font-size: 12px;">
                                ${trackingUrl}
                            </p>
                        </div>
                        <p style="color: #555; font-size: 14px; line-height: 1.6;">
                            <strong>What's next?</strong><br>
                            • We'll notify you when your order is ready for pickup<br>
                            • You can track your order status anytime using the link above
                        </p>
                        <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
                            Thank you for ordering with Flavrr!
                        </p>
                    </div>
                `
            })
        })
        
        if (!response.ok) {
            const errorText = await response.text()
            console.error('❌ Email send failed:', response.status, errorText)
        } else {
            const result = await response.json()
            console.log('✅ Email sent successfully:', result.id)
        }
    } catch (err) {
        console.error('❌ Email send error:', err)
    }
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const signature = req.headers.get('Stripe-Signature')
        if (!signature) {
            return new Response('Missing signature', { status: 400 })
        }

        const body = await req.text()
        const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
        if (!secret) {
            return new Response('Missing webhook secret', { status: 500 })
        }

        let event
        try {
            event = await stripe.webhooks.constructEventAsync(
                body,
                signature,
                secret,
                undefined,
                Stripe.createSubtleCryptoProvider()
            )
        } catch (err) {
            return new Response(`Signature verification failed: ${err.message}`, { status: 400 })
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )
        
        const resendApiKey = Deno.env.get('RESEND_API_KEY')
        const origin = 'https://flavrr.co'

        // Handle checkout.session.completed
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object
            const orderId = session.metadata?.order_id
            const orgId = session.metadata?.org_id

            if (!orderId) {
                return new Response('Missing order_id', { status: 400 })
            }

            // Fetch order details for email
            const { data: order } = await supabaseAdmin
                .from('orders')
                .select('id, order_number, customer_email, customer_name, public_token, fulfillment_type')
                .eq('id', orderId)
                .single()

            // Update order to paid
            const { error: updateError } = await supabaseAdmin
                .from('orders')
                .update({
                    status: 'paid',
                    payment_status: 'succeeded',
                    paid_at: new Date().toISOString(),
                    stripe_payment_intent_id: session.payment_intent as string,
                })
                .eq('id', orderId)

            if (updateError) {
                return new Response('Database error', { status: 500 })
            }

            // Send order confirmation email
            if (order && resendApiKey) {
                sendOrderConfirmationEmail(order, origin, resendApiKey)
            }

            // Non-blocking: log event
            supabaseAdmin.from('order_events').insert({
                order_id: orderId,
                previous_status: 'pending_payment',
                new_status: 'paid',
                changed_by: 'system',
                metadata: { session_id: session.id }
            }).catch(() => {})

            // Non-blocking: notification
            if (orgId) {
                supabaseAdmin.from('notifications').insert({
                    org_id: orgId,
                    type: 'order_paid',
                    payload: { order_id: orderId }
                }).catch(() => {})
            }
        }

        // Handle payment_intent.succeeded
        if (event.type === 'payment_intent.succeeded') {
            const paymentIntent = event.data.object
            const orderId = paymentIntent.metadata?.order_id

            if (!orderId) {
                return new Response('Missing order_id', { status: 200 })
            }

            // Check if already processed
            const { data: order } = await supabaseAdmin
                .from('orders')
                .select('status, payment_status, customer_email, public_token, order_number, customer_name, fulfillment_type')
                .eq('id', orderId)
                .single()

            if (order?.payment_status === 'succeeded') {
                return new Response('Already processed', { status: 200 })
            }

            // Update order
            const { error: updateError } = await supabaseAdmin
                .from('orders')
                .update({
                    status: 'paid',
                    payment_status: 'succeeded',
                    paid_at: new Date().toISOString(),
                    stripe_payment_intent_id: paymentIntent.id,
                })
                .eq('id', orderId)

            if (updateError) {
                return new Response('Database error', { status: 500 })
            }

            // Send order confirmation email (if not already sent via checkout.session)
            if (order && resendApiKey && order.customer_email) {
                sendOrderConfirmationEmail(order, origin, resendApiKey)
            }

            // Non-blocking: log event
            supabaseAdmin.from('order_events').insert({
                order_id: orderId,
                previous_status: 'pending_payment',
                new_status: 'paid',
                changed_by: 'system',
                metadata: { payment_intent_id: paymentIntent.id }
            }).catch(() => {})
        }

        return new Response('OK', { status: 200 })

    } catch (err) {
        return new Response(`Error: ${err.message}`, { status: 400 })
    }
})
