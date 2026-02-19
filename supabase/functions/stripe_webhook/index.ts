import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
    apiVersion: '2023-10-16',
})

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

const cryptoProvider = Stripe.createSubtleCryptoProvider()

serve(async (req) => {
    // Log all incoming webhook requests
    console.log(`🔔 Webhook received`, {
        method: req.method,
        url: req.url,
        headers: Object.fromEntries(req.headers.entries())
    })
    
    try {
        const signature = req.headers.get('Stripe-Signature')

        if (!signature) {
            console.error('❌ Missing Stripe-Signature header')
            return new Response('Missing Stripe signature', { status: 400 })
        }

        const body = await req.text()
        
        // Get webhook secret from environment
        const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
        
        if (!secret) {
            console.error('❌ Missing STRIPE_WEBHOOK_SECRET environment variable')
            return new Response('Server configuration error: missing webhook secret', { status: 500 })
        }

        console.log(`🔐 Verifying webhook signature...`, {
            signature_present: !!signature,
            body_length: body.length,
            secret_present: !!secret
        })

        let event
        try {
            event = await stripe.webhooks.constructEventAsync(
                body,
                signature,
                secret,
                undefined,
                cryptoProvider
            )
            console.log(`✅ Webhook signature verified`)
        } catch (err) {
            console.error(`❌ Webhook signature verification failed: ${err.message}`, {
                error: err,
                signature: signature.substring(0, 20) + '...'
            })
            return new Response(`Webhook signature verification failed: ${err.message}`, { status: 400 })
        }

        console.log(`🔔 Webhook received: ${event.type}`, {
            event_id: event.id,
            created: event.created,
            livemode: event.livemode
        })

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

        // PAYMENT INTENT SUCCEEDED (Direct Payment Intent flow - no Checkout Session)
        if (event.type === 'payment_intent.succeeded') {
            const paymentIntent = event.data.object as Stripe.PaymentIntent
            console.log(`🔔 payment_intent.succeeded event received`, {
                event_id: event.id,
                payment_intent_id: paymentIntent.id,
                amount: paymentIntent.amount,
                currency: paymentIntent.currency,
                status: paymentIntent.status,
                metadata: paymentIntent.metadata,
                latest_charge: paymentIntent.latest_charge
            })
            
            const orderId = paymentIntent.metadata?.order_id

            if (!orderId) {
                console.error('❌ Missing order_id from payment intent metadata', {
                    event_id: event.id,
                    payment_intent_id: paymentIntent.id,
                    metadata: paymentIntent.metadata
                })
                // Return 200 to prevent retry, but log for debugging
                return new Response(JSON.stringify({ warning: 'Missing order_id in metadata' }), { status: 200 })
            }

            console.log(`💳 Processing payment_intent.succeeded`, {
                payment_intent_id: paymentIntent.id,
                order_id: orderId,
                amount_cents: paymentIntent.amount
            })

            // IDEMPOTENCY CHECK
            const { data: order, error: fetchError } = await supabaseAdmin
                .from('orders')
                .select('id, order_number, status, payment_status, workspace_id, org_id, total_cents')
                .eq('id', orderId)
                .single()

            if (fetchError || !order) {
                console.error('❌ Order not found in database', {
                    order_id: orderId,
                    error: fetchError?.message,
                    event_id: event.id
                })
                // Return 200 to prevent retry - order may have been deleted
                return new Response(JSON.stringify({ warning: 'Order not found' }), { status: 200 })
            }

            console.log(`📦 Order found`, {
                order_id: order.id,
                order_number: order.order_number,
                current_status: order.status,
                current_payment_status: order.payment_status,
                workspace_id: order.workspace_id
            })

            // Idempotency: skip if already processed
            if (order.payment_status === 'succeeded' || order.status === 'paid') {
                console.log(`✅ Order ${order.order_number} already marked paid (idempotent)`, {
                    order_id: order.id,
                    status: order.status,
                    payment_status: order.payment_status
                })
                return new Response(JSON.stringify({ status: 'already_processed' }), { status: 200 })
            }

            // FETCH STRIPE FINANCIALS
            let stripeFee = 0
            let stripeNet = 0
            let stripeChargeId = null
            let stripeBalanceTxId = null
            let stripeCurrency = paymentIntent.currency?.toUpperCase()

            try {
                const charge = paymentIntent.latest_charge
                if (charge) {
                    stripeChargeId = typeof charge === 'string' ? charge : charge.id
                    
                    // Fetch full charge with balance transaction
                    const fullCharge = await stripe.charges.retrieve(stripeChargeId, {
                        expand: ['balance_transaction']
                    })
                    
                    if (fullCharge.balance_transaction) {
                        const balanceTx = fullCharge.balance_transaction as Stripe.BalanceTransaction
                        stripeBalanceTxId = balanceTx.id
                        stripeFee = balanceTx.fee
                        stripeNet = balanceTx.net
                        stripeCurrency = balanceTx.currency.toUpperCase()
                    }
                }
            } catch (err) {
                console.error('⚠️ Failed to fetch Stripe financials:', err)
            }

            // UPDATE ORDER TO PAID
            const paidAt = new Date().toISOString()
            console.log(`📝 Updating order to paid`, {
                order_id: orderId,
                order_number: order.order_number,
                new_status: 'paid',
                new_payment_status: 'succeeded',
                stripe_payment_intent_id: paymentIntent.id,
                stripe_fee: stripeFee,
                stripe_net: stripeNet
            })

            const { data: updatedOrder, error: updateError } = await supabaseAdmin
                .from('orders')
                .update({
                    status: 'paid',
                    payment_status: 'succeeded',
                    paid_at: paidAt,
                    stripe_payment_intent_id: paymentIntent.id,
                    stripe_charge_id: stripeChargeId,
                    stripe_balance_transaction_id: stripeBalanceTxId,
                    stripe_fee_amount: stripeFee,
                    stripe_net_amount: stripeNet,
                    stripe_currency: stripeCurrency
                })
                .eq('id', orderId)
                .select('id, order_number, status, payment_status')
                .single()

            if (updateError) {
                console.error('❌ Failed to update order', {
                    order_id: orderId,
                    error: updateError.message,
                    code: updateError.code,
                    details: updateError.details
                })
                return new Response(JSON.stringify({ error: 'Database update failed' }), { status: 500 })
            }
            
            console.log(`✅ Order updated successfully`, {
                order_id: updatedOrder.id,
                order_number: updatedOrder.order_number,
                status: updatedOrder.status,
                payment_status: updatedOrder.payment_status,
                paid_at: paidAt,
                stripe_fee: stripeFee,
                stripe_net: stripeNet
            })

            // LOG EVENT
            await supabaseAdmin.from('order_events').insert({
                order_id: orderId,
                previous_status: order.status,
                new_status: 'paid',
                changed_by: null,
                metadata: {
                    payment_intent_id: paymentIntent.id,
                    event_id: event.id,
                    fee: stripeFee,
                    net: stripeNet
                }
            })

            // UPDATE PAYMENT RECORD
            await supabaseAdmin
                .from('payments')
                .update({
                    status: 'succeeded',
                    metadata: {
                        payment_intent_id: paymentIntent.id,
                        fee: stripeFee,
                        net: stripeNet
                    }
                })
                .eq('order_id', orderId)
                .eq('stripe_payment_intent_id', paymentIntent.id)

            console.log(`🎉 Payment processing complete`, {
                order_id: orderId,
                order_number: order.order_number,
                payment_intent_id: paymentIntent.id,
                event_id: event.id,
                total_cents: order.total_cents,
                stripe_fee_cents: stripeFee,
                stripe_net_cents: stripeNet,
                status: 'paid',
                payment_status: 'succeeded'
            })
        }

        return new Response('OK', { status: 200 })

    } catch (err) {
        console.error(`❌ Webhook Error: ${err.message}`)
        return new Response(`Webhook Error: ${err.message}`, { status: 400 })
    }
})
