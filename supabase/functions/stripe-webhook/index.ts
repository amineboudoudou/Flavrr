import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  
  if (!signature) {
    return new Response(JSON.stringify({ error: 'No signature' }), { status: 400 });
  }

  try {
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    console.log('Received Stripe webhook:', event.type, event.id);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if event already processed (idempotency)
    const { data: existingEvent } = await supabase
      .from('stripe_events')
      .select('event_id')
      .eq('event_id', event.id)
      .single();

    if (existingEvent) {
      console.log('Event already processed:', event.id);
      return new Response(JSON.stringify({ received: true, already_processed: true }), { status: 200 });
    }

    // Log event immediately
    await supabase
      .from('stripe_events')
      .insert({
        event_id: event.id,
        type: event.type,
        payload: event as any,
        processing_result: 'processing',
      });

    // Process event based on type
    let result = 'unhandled';

    switch (event.type) {
      case 'payment_intent.succeeded':
        result = await handlePaymentIntentSucceeded(event, supabase);
        break;
      
      case 'payment_intent.payment_failed':
        result = await handlePaymentIntentFailed(event, supabase);
        break;
      
      case 'charge.refunded':
        result = await handleChargeRefunded(event, supabase);
        break;
      
      case 'account.updated':
        result = await handleAccountUpdated(event, supabase);
        break;
      
      default:
        console.log('Unhandled event type:', event.type);
    }

    // Update event processing result
    await supabase
      .from('stripe_events')
      .update({ processing_result: result })
      .eq('event_id', event.id);

    return new Response(JSON.stringify({ received: true, result }), { status: 200 });

  } catch (error) {
    console.error('Webhook error:', error);
    
    // Try to log error
    try {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      await supabase
        .from('stripe_events')
        .update({ 
          processing_result: 'error',
          error_message: error.message 
        })
        .eq('event_id', (error as any).event?.id);
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
});

// =====================================================
// PAYMENT INTENT SUCCEEDED
// =====================================================
async function handlePaymentIntentSucceeded(event: Stripe.Event, supabase: any): Promise<string> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  
  console.log('Processing payment_intent.succeeded:', paymentIntent.id);

  const orderId = paymentIntent.metadata.order_id;
  const workspaceId = paymentIntent.metadata.workspace_id;

  if (!orderId || !workspaceId) {
    console.error('Missing metadata:', paymentIntent.metadata);
    return 'error:missing_metadata';
  }

  // Update payment record
  const { error: paymentError } = await supabase
    .from('payments')
    .update({
      status: 'succeeded',
      stripe_charge_id: paymentIntent.latest_charge,
      payment_method_type: paymentIntent.payment_method_types?.[0],
      succeeded_at: new Date().toISOString(),
    })
    .eq('stripe_payment_intent_id', paymentIntent.id);

  if (paymentError) {
    console.error('Error updating payment:', paymentError);
    return 'error:payment_update_failed';
  }

  // Update order status
  const { error: orderError } = await supabase
    .from('orders')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (orderError) {
    console.error('Error updating order:', orderError);
    return 'error:order_update_failed';
  }

  // Get order details for ledger
  const { data: order } = await supabase
    .from('orders')
    .select('subtotal_cents, delivery_fee_cents, service_fee_cents')
    .eq('id', orderId)
    .single();

  if (!order) {
    console.error('Order not found:', orderId);
    return 'error:order_not_found';
  }

  // Get payment details for application fee
  const { data: payment } = await supabase
    .from('payments')
    .select('application_fee_cents')
    .eq('order_id', orderId)
    .single();

  // Create ledger entries
  const ledgerEntries = [
    {
      workspace_id: workspaceId,
      order_id: orderId,
      type: 'sale',
      amount_cents: order.subtotal_cents,
      status: 'pending',
      description: 'Order sale revenue',
    },
    {
      workspace_id: workspaceId,
      order_id: orderId,
      type: 'platform_fee',
      amount_cents: -(payment?.application_fee_cents || 0),
      status: 'settled',
      description: 'Flavrr platform fee (5%)',
    },
    {
      workspace_id: workspaceId,
      order_id: orderId,
      type: 'delivery_fee_collected',
      amount_cents: order.delivery_fee_cents,
      status: 'pending',
      description: 'Delivery fee collected from customer',
    },
  ];

  const { error: ledgerError } = await supabase
    .from('ledger_entries')
    .insert(ledgerEntries);

  if (ledgerError) {
    console.error('Error creating ledger entries:', ledgerError);
    return 'error:ledger_failed';
  }

  // Trigger Uber delivery creation (idempotent)
  try {
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/uber_create_delivery`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Role-Key': supabaseServiceKey,
      },
      body: JSON.stringify({ order_id: orderId }),
    });
  } catch (uberError) {
    console.error('Error triggering Uber delivery:', uberError);
    // Don't fail the webhook - delivery can be retried
  }

  console.log('Payment processed successfully:', paymentIntent.id);
  return 'success';
}

// =====================================================
// PAYMENT INTENT FAILED
// =====================================================
async function handlePaymentIntentFailed(event: Stripe.Event, supabase: any): Promise<string> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  
  console.log('Processing payment_intent.payment_failed:', paymentIntent.id);

  const { error } = await supabase
    .from('payments')
    .update({
      status: 'failed',
      failure_reason: paymentIntent.last_payment_error?.message || 'Unknown error',
    })
    .eq('stripe_payment_intent_id', paymentIntent.id);

  if (error) {
    console.error('Error updating failed payment:', error);
    return 'error:update_failed';
  }

  return 'success';
}

// =====================================================
// CHARGE REFUNDED
// =====================================================
async function handleChargeRefunded(event: Stripe.Event, supabase: any): Promise<string> {
  const charge = event.data.object as Stripe.Charge;
  
  console.log('Processing charge.refunded:', charge.id);

  // Get payment by charge ID
  const { data: payment } = await supabase
    .from('payments')
    .select('id, order_id, workspace_id')
    .eq('stripe_charge_id', charge.id)
    .single();

  if (!payment) {
    console.error('Payment not found for charge:', charge.id);
    return 'error:payment_not_found';
  }

  // Refund details (can include multiple refunds over time)
  const refunds = charge.refunds?.data || [];
  if (refunds.length === 0) {
    console.error('No refund data in charge:', charge.id);
    return 'error:no_refund_data';
  }

  let insertedAnyRefund = false;

  for (const refund of refunds) {
    if (!refund?.id) continue;

    // Insert refund row idempotently (stripe_refund_id is UNIQUE)
    const { data: existingRefund } = await supabase
      .from('refunds')
      .select('id')
      .eq('stripe_refund_id', refund.id)
      .maybeSingle();

    if (!existingRefund) {
      const { error: refundError } = await supabase
        .from('refunds')
        .insert({
          order_id: payment.order_id,
          payment_id: payment.id,
          stripe_refund_id: refund.id,
          amount_cents: refund.amount,
          reason: refund.reason || 'requested_by_customer',
          status: refund.status === 'succeeded' ? 'succeeded' : 'pending',
          succeeded_at: refund.status === 'succeeded' ? new Date().toISOString() : null,
        });

      if (refundError) {
        // If unique violation, treat as idempotent success
        if ((refundError as any).code !== '23505') {
          console.error('Error creating refund:', refundError);
          return 'error:refund_insert_failed';
        }
      } else {
        insertedAnyRefund = true;
      }
    }

    // Create ledger entry for this refund idempotently
    const { data: existingLedger } = await supabase
      .from('ledger_entries')
      .select('id')
      .eq('order_id', payment.order_id)
      .eq('type', 'refund')
      .contains('metadata', { stripe_refund_id: refund.id })
      .maybeSingle();

    if (!existingLedger) {
      const { error: ledgerError } = await supabase
        .from('ledger_entries')
        .insert({
          workspace_id: payment.workspace_id,
          order_id: payment.order_id,
          type: 'refund',
          amount_cents: -refund.amount,
          status: 'reversed',
          description: `Refund: ${refund.reason || 'customer request'}`,
          metadata: { stripe_refund_id: refund.id, stripe_charge_id: charge.id },
        });

      if (ledgerError) {
        console.error('Error creating refund ledger entry:', ledgerError);
      }
    }
  }

  // Update order status: fully refunded => refunded, partial => keep as paid
  const isFullyRefunded = (charge.amount_refunded || 0) >= (charge.amount || 0);
  const nextStatus = isFullyRefunded ? 'refunded' : 'paid';

  const { error: orderError } = await supabase
    .from('orders')
    .update({ status: nextStatus })
    .eq('id', payment.order_id);

  if (orderError) {
    console.error('Error updating order refund status:', orderError);
  }

  console.log('Refunds processed successfully:', refunds.map((r: any) => r.id));
  return insertedAnyRefund ? 'success' : 'success:already_recorded';
}

// =====================================================
// ACCOUNT UPDATED (Connect Account)
// =====================================================
async function handleAccountUpdated(event: Stripe.Event, supabase: any): Promise<string> {
  const account = event.data.object as Stripe.Account;
  
  console.log('Processing account.updated:', account.id);

  const { error } = await supabase
    .from('seller_payout_accounts')
    .update({
      charges_enabled: account.charges_enabled || false,
      payouts_enabled: account.payouts_enabled || false,
      requirements_due: account.requirements?.currently_due || [],
      details_submitted: account.details_submitted || false,
      onboarding_status: account.details_submitted ? 'complete' : 'pending',
    })
    .eq('stripe_connect_account_id', account.id);

  if (error) {
    console.error('Error updating payout account:', error);
    return 'error:update_failed';
  }

  return 'success';
}
