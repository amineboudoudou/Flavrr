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

        // Handle checkout.session.completed
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object
            const orderId = session.metadata?.order_id
            const orgId = session.metadata?.org_id

            if (!orderId) {
                return new Response('Missing order_id', { status: 400 })
            }

            // Update order to paid - fire and forget side effects
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
                .select('status, payment_status')
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
