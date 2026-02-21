import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's workspace membership
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('workspace_memberships')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      return new Response(
        JSON.stringify({ error: 'No workspace membership found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['owner', 'admin', 'manager'].includes(membership.role)) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get workspace details
    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from('workspaces')
      .select('id, org_id, slug, name')
      .eq('id', membership.workspace_id)
      .single();

    if (workspaceError || !workspace) {
      return new Response(
        JSON.stringify({ error: 'Workspace not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const {
      customer_id,
      customer_name,
      customer_email,
      customer_phone,
      items,
      fulfillment_type,
      delivery_address,
      notes,
      payment_method,
    } = body;

    // Validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'At least one item is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!customer_name) {
      return new Response(
        JSON.stringify({ error: 'Customer name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (fulfillment_type === 'delivery' && !delivery_address) {
      return new Response(
        JSON.stringify({ error: 'Delivery address is required for delivery orders' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Address validation for delivery
    if (fulfillment_type === 'delivery' && delivery_address) {
      const requiredAddressFields = ['street', 'city', 'postal_code'];
      const missingFields = requiredAddressFields.filter(f => !delivery_address[f]);
      if (missingFields.length > 0) {
        return new Response(
          JSON.stringify({ error: `Missing address fields: ${missingFields.join(', ')}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Calculate totals with Shopify-level product validation
    let subtotal_cents = 0;
    const orderItems = [];
    const inventoryReservations = [];

    for (const item of items) {
      // Look up product in unified products table with Shopify-level validation
      const { data: product, error: productError } = await supabaseAdmin
        .from('products')
        .select('id, name, name_fr, name_en, base_price_cents, description, description_fr, description_en, status, visibility, track_quantity, quantity, reserved_quantity, allow_overselling')
        .eq('id', item.product_id)
        .eq('workspace_id', workspace.id)
        .single();

      if (productError || !product) {
        return new Response(
          JSON.stringify({ error: `Product not found: ${item.product_id}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Shopify-level validation: Check product is active and visible
      if (product.status !== 'active') {
        return new Response(
          JSON.stringify({ error: `Product "${product.name}" is not available for sale (status: ${product.status})` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (product.visibility !== 'public' && product.visibility !== 'unlisted') {
        return new Response(
          JSON.stringify({ error: `Product "${product.name}" is not available for sale` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Shopify-level validation: Check inventory if tracked
      if (product.track_quantity) {
        const availableQty = product.quantity - product.reserved_quantity;
        if (availableQty < item.quantity && !product.allow_overselling) {
          return new Response(
            JSON.stringify({ 
              error: `Insufficient stock for "${product.name}". Available: ${availableQty}, Requested: ${item.quantity}` 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      const quantity = item.quantity || 1;
      const price_cents = product.base_price_cents;
      const line_total = price_cents * quantity;
      subtotal_cents += line_total;

      orderItems.push({
        product_id: product.id,
        name_snapshot: product.name,
        description_snapshot: product.description,
        price_cents_snapshot: price_cents,
        unit_price_cents: price_cents,
        quantity: quantity,
        line_total_cents: line_total,
      });

      // Track inventory reservations for tracked products
      if (product.track_quantity) {
        inventoryReservations.push({
          product_id: product.id,
          quantity: quantity
        });
      }
    }

    // Calculate fees
    const tax_rate = 0.15; // 15% tax
    const tax_cents = Math.round(subtotal_cents * tax_rate);
    const delivery_fee_cents = fulfillment_type === 'delivery' ? 599 : 0; // $5.99 delivery fee
    const service_fee_cents = Math.round(subtotal_cents * 0.05); // 5% service fee
    const total_cents = subtotal_cents + tax_cents + delivery_fee_cents + service_fee_cents;

    // Determine order status based on payment method
    const order_status = payment_method === 'cash_on_delivery' || payment_method === 'cash_on_pickup' 
      ? 'paid' 
      : 'pending_payment';

    // Create order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        workspace_id: workspace.id,
        org_id: workspace.org_id,
        status: order_status,
        payment_status: payment_method.startsWith('cash') ? 'succeeded' : 'pending',
        payment_method: payment_method || 'manual',
        fulfillment_type: fulfillment_type || 'pickup',
        customer_id: customer_id || null,
        customer_name: customer_name,
        customer_email: customer_email || null,
        customer_phone: customer_phone || null,
        delivery_address: delivery_address || null,
        notes: notes || null,
        subtotal_cents: subtotal_cents,
        tax_cents: tax_cents,
        delivery_fee_cents: delivery_fee_cents,
        service_fee_cents: service_fee_cents,
        tip_cents: 0,
        total_cents: total_cents,
        currency: 'cad',
        source: 'manual',
        idempotency_key: crypto.randomUUID(),
      })
      .select('id, order_number, status, total_cents, public_token')
      .single();

    if (orderError || !order) {
      console.error('Failed to create order:', orderError);
      return new Response(
        JSON.stringify({ error: 'Failed to create order', details: orderError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Reserve inventory for tracked products (Shopify-level inventory management)
    for (const reservation of inventoryReservations) {
      try {
        const { error: reserveError } = await supabaseAdmin.rpc('reserve_inventory', {
          p_product_id: reservation.product_id,
          p_quantity: reservation.quantity,
          p_order_id: order.id
        });
        if (reserveError) {
          console.error('Failed to reserve inventory for product', reservation.product_id, reserveError);
        }
      } catch (invError) {
        console.error('Failed to reserve inventory:', invError);
        // Don't fail the order, but log it
      }
    }

    // Create order items
    const orderItemsWithOrderId = orderItems.map(item => ({
      ...item,
      order_id: order.id,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from('order_items')
      .insert(orderItemsWithOrderId);

    if (itemsError) {
      console.error('Failed to create order items:', itemsError);
      // Don't fail the request, just log it
    }

    // Create or update customer record
    if (customer_email || customer_phone) {
      const { data: existingCustomer } = await supabaseAdmin
        .from('customers')
        .select('id')
        .eq('workspace_id', workspace.id)
        .or(`email.eq.${customer_email},phone.eq.${customer_phone}`)
        .maybeSingle();

      if (existingCustomer) {
        // Update last order date and order count
        await supabaseAdmin
          .from('customers')
          .update({
            last_order_at: new Date().toISOString(),
            total_orders: supabaseAdmin.rpc('increment', { x: 1 }),
            total_spent_cents: supabaseAdmin.rpc('increment', { x: total_cents }),
          })
          .eq('id', existingCustomer.id);
      } else {
        // Create new customer
        await supabaseAdmin
          .from('customers')
          .insert({
            workspace_id: workspace.id,
            org_id: workspace.org_id,
            name: customer_name,
            email: customer_email,
            phone: customer_phone,
            address: delivery_address ? JSON.stringify(delivery_address) : null,
            first_order_at: new Date().toISOString(),
            last_order_at: new Date().toISOString(),
            total_orders: 1,
            total_spent_cents: total_cents,
          });
      }
    }

    // Log order event
    await supabaseAdmin
      .from('order_events')
      .insert({
        order_id: order.id,
        workspace_id: workspace.id,
        event_type: 'order_created',
        payload: {
          source: 'manual',
          payment_method: payment_method,
          created_by: user.id,
        },
      });

    return new Response(
      JSON.stringify({
        success: true,
        order: {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          total_cents: order.total_cents,
          public_token: order.public_token,
          tracking_url: `/t/${order.public_token}`,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in create-manual-order:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
