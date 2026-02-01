import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
    apiVersion: '2023-10-16',
})

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

const cryptoProvider = Stripe.createSubtleCryptoProvider()

serve(async (req) => {
    try {
        const signature = req.headers.get('Stripe-Signature')

        if (!signature) {
            return new Response('Missing Stripe signature', { status: 400 })
        }

        const body = await req.text()
        const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

        if (!webhookSecret) {
            console.error('Missing STRIPE_WEBHOOK_SECRET')
            return new Response('Server configuration error', { status: 500 })
        }

        let event
        try {
            event = await stripe.webhooks.constructEventAsync(
                body,
                signature,
                webhookSecret,
                undefined,
                cryptoProvider
            )
        } catch (err) {
            console.error(`⚠️ Webhook signature verification failed: ${err.message}`)
            return new Response(err.message, { status: 400 })
        }

        console.log(`🔔 Webhook received: ${event.type}`)

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // ACCOUNT UPDATED (Connect)
        if (event.type === 'account.updated') {
            const account = event.data.object as Stripe.Account
            console.log(`👤 Connect Account Updated: ${account.id}`)

            const { error: updateError } = await supabaseAdmin
                .from('organizations')
                .update({
                    stripe_account_status: account.payouts_enabled ? 'complete' : (account.details_submitted ? 'details_submitted' : 'restricted'),
                })
                .eq('stripe_account_id', account.id)

            if (updateError) {
                console.error('❌ Failed to update organization status:', updateError)
                return new Response('Database Update Error', { status: 500 })
            }
        }

        // CHECKOUT SESSION COMPLETED (Payment Success)
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object
            const orderId = session.metadata?.order_id

            if (!orderId) {
                console.error('❌ Missing order_id from session metadata')
                return new Response('Missing metadata', { status: 400 })
            }

            // IDEMPOTENCY CHECK: Source of Truth = Database
            const { data: order, error: fetchError } = await supabaseAdmin
                .from('orders')
                .select('status, payment_status')
                .eq('id', orderId)
                .single()

            if (fetchError || !order) {
                console.error('❌ Order not found:', fetchError)
                return new Response('Order not found', { status: 404 })
            }

            if (order.payment_status === 'succeeded' || order.status === 'incoming') {
                console.log(`✅ Order ${orderId} already marked incoming. Skipping.`)
                return new Response('OK (Idempotent)', { status: 200 })
            }


            // FETCH STRIPE FINANCIALS
            let stripeFee = 0;
            let stripeNet = 0;
            let stripeChargeId = null;
            let stripeBalanceTxId = null;
            let stripeCurrency = session.currency?.toUpperCase();

            try {
                if (session.payment_intent) {
                    const pi = await stripe.paymentIntents.retrieve(session.payment_intent as string, {
                        expand: ['latest_charge']
                    });
                    const charge = pi.latest_charge as any; // Stripe.Charge

                    if (charge) {
                        stripeChargeId = charge.id;
                        if (charge.balance_transaction) {
                            // This might be a string ID or object depending on expansion. 
                            // Usually it's an ID unless we expanded it. We didn't expand it above.
                            // Fetch Balance Transaction
                            const balanceTx = await stripe.balanceTransactions.retrieve(charge.balance_transaction as string);
                            stripeBalanceTxId = balanceTx.id;
                            stripeFee = balanceTx.fee;
                            stripeNet = balanceTx.net;
                            stripeCurrency = balanceTx.currency.toUpperCase();
                        }
                    }
                }
            } catch (err) {
                console.error('⚠️ Failed to fetch Stripe financials:', err);
                // Don't fail the webhook processing, just log it.
            }

            // UPDATE ORDER
            const { error: updateError } = await supabaseAdmin
                .from('orders')
                .update({
                    status: 'incoming', // Paid and awaiting restaurant acceptance
                    payment_status: 'succeeded',
                    paid_at: new Date().toISOString(),
                    stripe_checkout_session_id: session.id,
                    stripe_payment_intent_id: session.payment_intent as string,
                    stripe_charge_id: stripeChargeId,
                    stripe_balance_transaction_id: stripeBalanceTxId,
                    stripe_fee_amount: stripeFee,
                    stripe_net_amount: stripeNet,
                    stripe_currency: stripeCurrency
                })
                .eq('id', orderId)

            if (updateError) {
                console.error('❌ Failed to update order:', updateError)
                return new Response('Database error', { status: 500 })
            }

            // LOG EVENT
            await supabaseAdmin.from('order_events').insert({
                order_id: orderId,
                previous_status: order.status,
                new_status: 'incoming',
                changed_by: 'system_stripe',
                metadata: {
                    session_id: session.id,
                    event_id: event.id,
                    fee: stripeFee,
                    net: stripeNet
                }
            })

            // NOTIFICATION (Owner)
            const orgId = session.metadata?.org_id
            if (orgId) {
                await supabaseAdmin.from('notifications').insert({
                    org_id: orgId,
                    type: 'order_paid',
                    payload: {
                        order_id: orderId,
                        amount: session.amount_total,
                        currency: session.currency
                    }
                })
            }

            // INSERT PAYMENT RECORD (if keeping separate table)
            await supabaseAdmin.from('payments').insert({
                order_id: orderId,
                provider: 'stripe',
                status: 'succeeded',
                amount_cents: session.amount_total,
                currency: session.currency?.toUpperCase(),
                provider_ref: session.payment_intent as string,
                metadata: {
                    session_id: session.id,
                    fee: stripeFee,
                    net: stripeNet
                }
            })

            console.log(`✅ Order ${orderId} payments processed successfully. Fee=${stripeFee}, Net=${stripeNet}`)
        }

        return new Response('OK', { status: 200 })

    } catch (err) {
        console.error(`❌ Webhook Error: ${err.message}`)
        return new Response(`Webhook Error: ${err.message}`, { status: 400 })
    }
})
