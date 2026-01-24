import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
    apiVersion: '2023-10-16',
})

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

// Track processed events to ensure idempotency
const processedEvents = new Set<string>()

serve(async (req) => {
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
        return new Response('No signature', { status: 400 })
    }

    try {
        const body = await req.text()

        // Verify webhook signature
        const event = stripe.webhooks.constructEvent(body, signature, webhookSecret)

        // Check if already processed (idempotency)
        if (processedEvents.has(event.id)) {
            console.log(`Event ${event.id} already processed, skipping`)
            return new Response(JSON.stringify({ received: true, skipped: true }), {
                headers: { 'Content-Type': 'application/json' },
                status: 200,
            })
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        console.log(`Received Stripe webhook: ${event.type}`)

        // Handle different event types
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session
                const orderId = session.metadata?.order_id
                const paymentIntentId = session.payment_intent as string

                if (!orderId) {
                    console.error('No order_id in session metadata')
                    break
                }

                // Update order status to paid
                const { error: orderError } = await supabaseAdmin
                    .from('orders')
                    .update({
                        status: 'paid',
                        stripe_payment_intent_id: paymentIntentId,
                        paid_at: new Date().toISOString(),
                    })
                    .eq('id', orderId)

                if (orderError) {
                    throw orderError
                }

                // Create payment record
                const { error: paymentError } = await supabaseAdmin
                    .from('payments')
                    .insert({
                        order_id: orderId,
                        provider: 'stripe',
                        status: 'succeeded',
                        amount_cents: session.amount_total || 0,
                        currency: session.currency?.toUpperCase() || 'CAD',
                        provider_ref: paymentIntentId,
                        metadata: { session_id: session.id },
                    })

                if (paymentError) {
                    throw paymentError
                }

                // Fetch order details for notification
                const { data: order } = await supabaseAdmin
                    .from('orders')
                    .select('org_id, customer_email, public_token')
                    .eq('id', orderId)
                    .single()

                if (order) {
                    // Create notification for owner portal
                    await supabaseAdmin
                        .from('notifications')
                        .insert({
                            org_id: order.org_id,
                            user_id: null, // Org-wide notification
                            type: 'order_paid',
                            payload: {
                                order_id: orderId,
                                public_token: order.public_token,
                                amount: session.amount_total,
                            },
                        })

                    // TODO: Send email confirmation to customer
                    // TODO: Send push notification to owner portal
                }

                console.log(`Order ${orderId} marked as paid`)
                break
            }

            case 'payment_intent.succeeded': {
                const paymentIntent = event.data.object as Stripe.PaymentIntent
                const orderId = paymentIntent.metadata?.order_id

                if (!orderId) {
                    console.error('No order_id in payment intent metadata')
                    break
                }

                // Update payment record
                const { error: paymentError } = await supabaseAdmin
                    .from('payments')
                    .update({
                        status: 'succeeded',
                    })
                    .eq('provider_ref', paymentIntent.id)

                if (paymentError) {
                    console.error('Error updating payment:', paymentError)
                }

                console.log(`Payment intent ${paymentIntent.id} succeeded`)
                break
            }

            case 'payment_intent.payment_failed': {
                const paymentIntent = event.data.object as Stripe.PaymentIntent
                const orderId = paymentIntent.metadata?.order_id

                if (!orderId) {
                    console.error('No order_id in payment intent metadata')
                    break
                }

                // Update payment record
                const { error: paymentError } = await supabaseAdmin
                    .from('payments')
                    .update({
                        status: 'failed',
                    })
                    .eq('provider_ref', paymentIntent.id)

                if (paymentError) {
                    console.error('Error updating payment:', paymentError)
                }

                console.log(`Payment intent ${paymentIntent.id} failed`)
                break
            }

            case 'charge.refunded': {
                const charge = event.data.object as Stripe.Charge
                const paymentIntentId = charge.payment_intent as string

                // Find order by payment intent
                const { data: order } = await supabaseAdmin
                    .from('orders')
                    .select('id, org_id')
                    .eq('stripe_payment_intent_id', paymentIntentId)
                    .single()

                if (!order) {
                    console.error('Order not found for refund')
                    break
                }

                // Update order status
                const { error: orderError } = await supabaseAdmin
                    .from('orders')
                    .update({
                        status: 'refunded',
                    })
                    .eq('id', order.id)

                if (orderError) {
                    throw orderError
                }

                // Update payment record
                const { error: paymentError } = await supabaseAdmin
                    .from('payments')
                    .update({
                        status: 'refunded',
                    })
                    .eq('provider_ref', paymentIntentId)

                if (paymentError) {
                    console.error('Error updating payment:', paymentError)
                }

                // Create notification
                await supabaseAdmin
                    .from('notifications')
                    .insert({
                        org_id: order.org_id,
                        user_id: null,
                        type: 'order_status',
                        payload: {
                            order_id: order.id,
                            status: 'refunded',
                        },
                    })

                console.log(`Order ${order.id} refunded`)
                break
            }

            default:
                console.log(`Unhandled event type: ${event.type}`)
        }

        // Mark event as processed
        processedEvents.add(event.id)

        return new Response(JSON.stringify({ received: true }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        console.error('Webhook error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
    }
})
