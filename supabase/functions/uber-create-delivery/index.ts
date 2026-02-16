import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const uberClientId = Deno.env.get('UBER_DIRECT_CLIENT_ID') || '';
const uberClientSecret = Deno.env.get('UBER_DIRECT_CLIENT_SECRET') || '';
const uberCustomerId = Deno.env.get('UBER_DIRECT_CUSTOMER_ID') || '';

// CORS helper
const ALLOWED_ORIGINS = [
  'https://flavrr-snowy.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  let allowedOrigin = 'https://flavrr-snowy.vercel.app';
  
  if (origin) {
    if (ALLOWED_ORIGINS.includes(origin)) {
      allowedOrigin = origin;
    } else if (origin.endsWith('.vercel.app')) {
      allowedOrigin = origin;
    }
  }
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
  };
}

// Get Uber Direct OAuth token
async function getUberToken(): Promise<string> {
  const tokenUrl = 'https://login.uber.com/oauth/v2/token';
  const credentials = btoa(`${uberClientId}:${uberClientSecret}`);
  
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=eats.deliveries',
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get Uber token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { order_id } = await req.json();

    if (!order_id) {
      return new Response(JSON.stringify({ error: 'order_id is required' }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch order with workspace and items
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        workspace:workspaces!inner(id, slug, name, business_address),
        items:order_items(*)
      `)
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      console.error('Order not found:', orderError);
      return new Response(JSON.stringify({ error: 'Order not found' }), { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if delivery already exists (idempotency)
    const { data: existingDelivery } = await supabase
      .from('deliveries')
      .select('*')
      .eq('order_id', order_id)
      .single();

    if (existingDelivery) {
      console.log('Delivery already exists:', existingDelivery.id);
      return new Response(JSON.stringify({
        delivery: existingDelivery,
        already_exists: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify order is paid and ready
    if (order.status !== 'preparing' && order.status !== 'paid') {
      return new Response(JSON.stringify({ 
        error: 'Order must be paid and ready before creating delivery',
        current_status: order.status 
      }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate addresses
    if (!order.delivery_address) {
      return new Response(JSON.stringify({ error: 'Order missing delivery address' }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const pickupAddress = order.workspace.business_address;
    if (!pickupAddress) {
      return new Response(JSON.stringify({ error: 'Workspace missing business address' }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get Uber token
    const uberToken = await getUberToken();

    // Build Uber Direct delivery request
    const deliveryRequest = {
      pickup_address: pickupAddress.street_address_1,
      pickup_name: order.workspace.name,
      pickup_phone_number: pickupAddress.phone || '+15555555555',
      dropoff_address: order.delivery_address.street_address_1,
      dropoff_name: order.customer_name || 'Customer',
      dropoff_phone_number: order.customer_phone || order.delivery_address.phone || '+15555555555',
      manifest_items: order.items.map((item: any) => ({
        name: item.name_snapshot,
        quantity: item.quantity,
        size: 'small',
      })),
      dropoff_notes: order.delivery_instructions || '',
      external_store_id: order.workspace_id,
    };

    console.log('Creating Uber delivery:', deliveryRequest);

    // Create delivery in Uber Direct
    const uberResponse = await fetch(`https://api.uber.com/v1/customers/${uberCustomerId}/deliveries`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${uberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(deliveryRequest),
    });

    if (!uberResponse.ok) {
      const errorText = await uberResponse.text();
      console.error('Uber API error:', errorText);
      
      // Store failed delivery attempt
      await supabase
        .from('deliveries')
        .insert({
          order_id: order_id,
          workspace_id: order.workspace_id,
          status: 'failed',
          error_message: errorText,
          idempotency_key: `order_${order_id}_${Date.now()}`,
          pickup_address: pickupAddress,
          dropoff_address: order.delivery_address,
        });

      return new Response(JSON.stringify({ 
        error: 'Failed to create Uber delivery',
        details: errorText 
      }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const uberDelivery = await uberResponse.json();
    console.log('Uber delivery created:', uberDelivery);

    // Store delivery in database
    const { data: delivery, error: deliveryError } = await supabase
      .from('deliveries')
      .insert({
        order_id: order_id,
        workspace_id: order.workspace_id,
        uber_delivery_id: uberDelivery.id,
        quote_id: uberDelivery.quote_id,
        status: 'delivery_requested',
        uber_cost_cents: Math.round((uberDelivery.fee || 0) * 100),
        customer_delivery_fee_cents: order.delivery_fee_cents,
        idempotency_key: `order_${order_id}_${Date.now()}`,
        pickup_address: pickupAddress,
        dropoff_address: order.delivery_address,
        tracking_url: uberDelivery.tracking_url,
      })
      .select()
      .single();

    if (deliveryError) {
      console.error('Failed to store delivery:', deliveryError);
      return new Response(JSON.stringify({ error: 'Failed to store delivery' }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update order status
    await supabase
      .from('orders')
      .update({ status: 'out_for_delivery' })
      .eq('id', order_id);

    return new Response(JSON.stringify({
      success: true,
      delivery: delivery,
      tracking_url: uberDelivery.tracking_url,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in uber-create-delivery:', error);
    const origin = req.headers.get('origin');
    const errorCorsHeaders = getCorsHeaders(origin);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...errorCorsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
