import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno';

function getStripeClient() {
  const key = Deno.env.get('STRIPE_SECRET_KEY') || Deno.env.get('STRIPE_TEST_SECRET_KEY') || '';
  if (!key) {
    throw new Error('Missing STRIPE_SECRET_KEY');
  }
  if (key.startsWith('sk_live_')) {
    throw new Error('Stripe must be in TEST mode');
  }
  return new Stripe(key, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
  });
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Platform fee: 5% of subtotal
const PLATFORM_FEE_PERCENTAGE = 0.05;

type Mode1Request = {
  order_id: string;
  workspace_slug: string;
};

type Mode2Request = {
  workspace_slug: string;
  idempotency_key: string;
  currency?: string;
  items: Array<{ product_id: string; name: string; unit_price_cents: number; qty: number }>;
  customer: { name?: string; email?: string; phone?: string };
  fulfillment: {
    type: 'delivery' | 'pickup';
    dropoff_address?: string;
    dropoff_lat?: number;
    dropoff_lng?: number;
    notes?: string;
  };
  totals: {
    subtotal_cents: number;
    delivery_fee_cents: number;
    service_fee_cents: number;
    tax_cents: number;
    total_cents: number;
  };
};

function isMode1(body: any): body is Mode1Request {
  return typeof body?.order_id === 'string' && typeof body?.workspace_slug === 'string';
}

function isMode2(body: any): body is Mode2Request {
  return (
    typeof body?.workspace_slug === 'string' &&
    typeof body?.idempotency_key === 'string' &&
    Array.isArray(body?.items) &&
    typeof body?.totals === 'object' &&
    typeof body?.fulfillment === 'object' &&
    typeof body?.customer === 'object'
  );
}

function ensureNonNegativeInt(n: any, fieldName: string) {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`Invalid ${fieldName}`);
  }
}

function validateMode2(req: Mode2Request) {
  if (!req.idempotency_key.trim()) throw new Error('Missing idempotency_key');

  ensureNonNegativeInt(req.totals.subtotal_cents, 'totals.subtotal_cents');
  ensureNonNegativeInt(req.totals.delivery_fee_cents, 'totals.delivery_fee_cents');
  ensureNonNegativeInt(req.totals.service_fee_cents, 'totals.service_fee_cents');
  ensureNonNegativeInt(req.totals.tax_cents, 'totals.tax_cents');
  ensureNonNegativeInt(req.totals.total_cents, 'totals.total_cents');

  const expectedTotal =
    req.totals.subtotal_cents +
    req.totals.delivery_fee_cents +
    req.totals.service_fee_cents +
    req.totals.tax_cents;

  if (req.totals.total_cents !== expectedTotal) {
    throw new Error('Invalid totals.total_cents');
  }

  if (!Array.isArray(req.items) || req.items.length === 0) {
    throw new Error('No items');
  }

  let computedSubtotal = 0;
  for (const item of req.items) {
    if (!item?.product_id || typeof item.product_id !== 'string') throw new Error('Invalid items.product_id');
    if (!item?.name || typeof item.name !== 'string') throw new Error('Invalid items.name');
    ensureNonNegativeInt(item.unit_price_cents, 'items.unit_price_cents');
    if (!Number.isInteger(item.qty) || item.qty <= 0) throw new Error('Invalid items.qty');
    computedSubtotal += item.unit_price_cents * item.qty;
  }

  if (computedSubtotal !== req.totals.subtotal_cents) {
    throw new Error('Subtotal mismatch');
  }

  if (req.fulfillment.type === 'delivery') {
    if (!req.fulfillment.dropoff_address || typeof req.fulfillment.dropoff_address !== 'string') {
      throw new Error('Missing fulfillment.dropoff_address');
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = getStripeClient();

    const raw = await req.text();
    let body: any;
    try {
      body = JSON.parse(raw || '{}');
    } catch (e) {
      console.error('Failed to parse JSON body', raw, e);
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Accept workspace_slug from client - multi-tenant support
    if (!body.workspace_slug) {
      return new Response(JSON.stringify({ error: 'Missing workspace_slug', requestId }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('create-payment-intent request body', JSON.stringify({
      workspace_slug: body.workspace_slug,
      mode: isMode1(body) ? 'mode1' : isMode2(body) ? 'mode2' : 'unknown',
      has_items: Array.isArray(body?.items),
      totals_keys: body?.totals ? Object.keys(body.totals) : null,
      raw,
    }));

    if (!isMode1(body) && !isMode2(body)) {
      return new Response(JSON.stringify({ error: 'Invalid request body', requestId }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let workspaceSlug = body.workspace_slug;

    // Get workspace with org_id for multi-tenant support
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, name, slug, org_id')
      .eq('slug', workspaceSlug)
      .single();

    if (workspaceError || !workspace) {
      console.error('Workspace not found for slug', workspaceSlug, workspaceError);
      return new Response(JSON.stringify({ error: 'Workspace not found', requestId }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!workspace.org_id) {
      console.error('Workspace missing org_id', workspace);
      return new Response(JSON.stringify({ error: 'Workspace configuration error', requestId }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let orderId: string;

    if (isMode1(body)) {
      orderId = body.order_id;
    } else {
      try {
        validateMode2(body);
      } catch (validationError: any) {
        console.error('Validation error', validationError?.message || validationError);
        return new Response(JSON.stringify({ error: validationError?.message || 'Invalid payload', requestId }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // MODE 2: idempotent order create
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('workspace_id', workspace.id)
        .eq('idempotency_key', body.idempotency_key)
        .maybeSingle();

      if (existingOrder?.id) {
        orderId = existingOrder.id;
      } else {
        const currency = (body.currency || 'cad').toLowerCase();

        const deliveryAddress =
          body.fulfillment.type === 'delivery'
            ? {
                address: body.fulfillment.dropoff_address,
                lat: body.fulfillment.dropoff_lat,
                lng: body.fulfillment.dropoff_lng,
              }
            : null;

        console.log('Creating order payload', {
          workspace_id: workspace.id,
          totals: body.totals,
          currency,
          idempotency_key: body.idempotency_key,
          customer: body.customer,
          fulfillment: body.fulfillment,
          items_count: body.items?.length,
        });

        const { data: createdOrder, error: createOrderError } = await supabase
          .from('orders')
          .insert({
            workspace_id: workspace.id,
            status: 'draft',
            org_id: workspace.org_id,
            fulfillment_type: body.fulfillment.type,
            subtotal_cents: body.totals.subtotal_cents,
            delivery_fee_cents: body.totals.delivery_fee_cents,
            service_fee_cents: body.totals.service_fee_cents,
            tax_cents: body.totals.tax_cents,
            total_cents: body.totals.total_cents,
            currency,
            idempotency_key: body.idempotency_key,
            customer_name: body.customer?.name || null,
            customer_email: body.customer?.email || null,
            customer_phone: body.customer?.phone || null,
            delivery_address: deliveryAddress,
          })
          .select('id')
          .single();

        if (createOrderError || !createdOrder) {
          // If unique conflict on (workspace_id,idempotency_key), fetch the existing order.
          if ((createOrderError as any)?.code === '23505') {
            const { data: conflictedOrder, error: conflictFetchError } = await supabase
              .from('orders')
              .select('id')
              .eq('workspace_id', workspace.id)
              .eq('idempotency_key', body.idempotency_key)
              .single();

            if (conflictFetchError || !conflictedOrder) {
              console.error('Order idempotency conflict fetch failed', conflictFetchError);
              throw new Error('Order idempotency conflict');
            }

            orderId = conflictedOrder.id;
          } else {
            console.error('Failed to create order', createOrderError);
            return new Response(JSON.stringify({ error: 'Failed to create order', details: createOrderError?.message || createOrderError, requestId }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        } else {
          orderId = createdOrder.id;

          const orderItems = body.items.map((item) => ({
            order_id: orderId,
            product_id: item.product_id,
            name_snapshot: item.name,
            price_cents_snapshot: item.unit_price_cents,
            unit_price_cents: item.unit_price_cents,
            quantity: item.qty,
            line_total_cents: item.unit_price_cents * item.qty,
          }));

          const { error: orderItemsError } = await supabase.from('order_items').insert(orderItems);
          if (orderItemsError) {
            console.error('Failed to create order items', orderItemsError);
            return new Response(JSON.stringify({ error: 'ITEMS_UNAVAILABLE', details: orderItemsError.message || orderItemsError, requestId }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
      }
    }

    // Get order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('workspace_id', workspace.id)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'Order not found', requestId }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verify order is in correct state
    if (order.status !== 'draft' && order.status !== 'pending_payment') {
      return new Response(JSON.stringify({ error: 'Order cannot be paid in current status', requestId }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check if payment already exists
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('stripe_payment_intent_id, status')
      .eq('order_id', orderId)
      .single();

    if (existingPayment && existingPayment.status === 'succeeded') {
      return new Response(JSON.stringify({ error: 'Order already paid', requestId }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get seller payout account
    const { data: payoutAccount, error: payoutError } = await supabase
      .from('seller_payout_accounts')
      .select('*')
      .eq('workspace_id', workspace.id)
      .single();

    if (payoutError || !payoutAccount) {
      return new Response(JSON.stringify({ error: 'Seller has not set up payouts', requestId }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!payoutAccount.charges_enabled) {
      return new Response(JSON.stringify({ error: 'Seller cannot accept payments yet', requestId }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Calculate platform fee (5% of subtotal)
    const applicationFeeCents = Math.round(order.subtotal_cents * PLATFORM_FEE_PERCENTAGE);

    console.log('Creating payment intent:', {
      order_id: orderId,
      total: order.total_cents,
      application_fee: applicationFeeCents,
      destination: payoutAccount.stripe_connect_account_id
    });

    // If payment intent already exists, return it
    if (existingPayment && existingPayment.stripe_payment_intent_id) {
      const existingPI = await stripe.paymentIntents.retrieve(existingPayment.stripe_payment_intent_id);
      
      return new Response(JSON.stringify({
        order_id: orderId,
        payment_intent_id: existingPI.id,
        client_secret: existingPI.client_secret,
        requestId,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
        order_id: orderId,
        customer_email: order.customer_email || '',
      },
      description: `Order from ${workspace.name}`,
    }, {
      idempotencyKey: `pi_${workspace.id}_${orderId}`
    });

    console.log('Payment intent created:', paymentIntent.id);

    // Update order status
    await supabase
      .from('orders')
      .update({ status: 'pending_payment' })
      .eq('id', orderId);

    // Create payment record
    await supabase
      .from('payments')
      .insert({
        order_id: orderId,
        workspace_id: workspace.id,
        stripe_payment_intent_id: paymentIntent.id,
        amount_total_cents: order.total_cents,
        application_fee_cents: applicationFeeCents,
        destination_account_id: payoutAccount.stripe_connect_account_id,
        status: 'pending',
      });

    return new Response(JSON.stringify({
      order_id: orderId,
      order_number: order.order_number,
      payment_intent_id: paymentIntent.id,
      client_secret: paymentIntent.client_secret,
      requestId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in create-payment-intent:', error);
    const message = (error as any)?.message || 'Internal error';
    const isStripe = Boolean((error as any)?.type) || Boolean((error as any)?.raw);
    const status = isStripe ? 400 : 500;
    return new Response(JSON.stringify({ error: message, requestId }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
