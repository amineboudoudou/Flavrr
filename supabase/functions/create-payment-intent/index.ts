import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Platform fee: 5% of subtotal
const PLATFORM_FEE_PERCENTAGE = 0.05;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { order_id, workspace_slug } = await req.json();

    if (!order_id || !workspace_slug) {
      return new Response(JSON.stringify({ error: 'order_id and workspace_slug are required' }), { status: 400 });
    }

    // Get workspace
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, name, slug')
      .eq('slug', workspace_slug)
      .single();

    if (workspaceError || !workspace) {
      return new Response(JSON.stringify({ error: 'Workspace not found' }), { status: 404 });
    }

    // Get order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .eq('workspace_id', workspace.id)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404 });
    }

    // Verify order is in correct state
    if (order.status !== 'draft' && order.status !== 'pending_payment') {
      return new Response(JSON.stringify({ error: 'Order cannot be paid in current status' }), { status: 400 });
    }

    // Check if payment already exists
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('stripe_payment_intent_id, status')
      .eq('order_id', order_id)
      .single();

    if (existingPayment && existingPayment.status === 'succeeded') {
      return new Response(JSON.stringify({ error: 'Order already paid' }), { status: 400 });
    }

    // Get seller payout account
    const { data: payoutAccount, error: payoutError } = await supabase
      .from('seller_payout_accounts')
      .select('*')
      .eq('workspace_id', workspace.id)
      .single();

    if (payoutError || !payoutAccount) {
      return new Response(JSON.stringify({ error: 'Seller has not set up payouts' }), { status: 400 });
    }

    if (!payoutAccount.charges_enabled) {
      return new Response(JSON.stringify({ error: 'Seller cannot accept payments yet' }), { status: 400 });
    }

    // Calculate platform fee (5% of subtotal)
    const applicationFeeCents = Math.round(order.subtotal_cents * PLATFORM_FEE_PERCENTAGE);

    console.log('Creating payment intent:', {
      order_id,
      total: order.total_cents,
      application_fee: applicationFeeCents,
      destination: payoutAccount.stripe_connect_account_id
    });

    // If payment intent already exists, return it
    if (existingPayment && existingPayment.stripe_payment_intent_id) {
      const existingPI = await stripe.paymentIntents.retrieve(existingPayment.stripe_payment_intent_id);
      
      return new Response(JSON.stringify({
        client_secret: existingPI.client_secret,
        payment_intent_id: existingPI.id,
        amount: existingPI.amount,
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Create payment intent with destination charges
    const paymentIntent = await stripe.paymentIntents.create({
      amount: order.total_cents,
      currency: order.currency,
      application_fee_amount: applicationFeeCents,
      transfer_data: {
        destination: payoutAccount.stripe_connect_account_id,
      },
      metadata: {
        workspace_id: workspace.id,
        workspace_slug: workspace.slug,
        order_id: order_id,
        customer_email: order.customer_email || '',
      },
      description: `Order from ${workspace.name}`,
    });

    console.log('Payment intent created:', paymentIntent.id);

    // Update order status
    await supabase
      .from('orders')
      .update({ status: 'pending_payment' })
      .eq('id', order_id);

    // Create payment record
    await supabase
      .from('payments')
      .insert({
        order_id: order_id,
        workspace_id: workspace.id,
        stripe_payment_intent_id: paymentIntent.id,
        amount_total_cents: order.total_cents,
        application_fee_cents: applicationFeeCents,
        destination_account_id: payoutAccount.stripe_connect_account_id,
        status: 'pending',
      });

    return new Response(JSON.stringify({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      amount: paymentIntent.amount,
      application_fee: applicationFeeCents,
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (error) {
    console.error('Error in create-payment-intent:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
});
