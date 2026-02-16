import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const payload = await req.json();

    console.log('Uber webhook received:', payload);

    // Extract event data
    const eventId = payload.event_id || payload.id || `uber_${Date.now()}`;
    const deliveryId = payload.delivery_id || payload.resource_href?.split('/').pop();
    const eventType = payload.event_type || payload.kind;
    const status = payload.status;

    // Store event for idempotency
    const { data: existingEvent } = await supabase
      .from('uber_events')
      .select('event_id')
      .eq('event_id', eventId)
      .single();

    if (existingEvent) {
      console.log('Event already processed:', eventId);
      return new Response(JSON.stringify({ success: true, message: 'Event already processed' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Store event
    await supabase
      .from('uber_events')
      .insert({
        event_id: eventId,
        delivery_id: deliveryId,
        type: eventType,
        payload: payload,
        processing_result: 'processing'
      });

    if (!deliveryId) {
      console.error('No delivery_id in webhook payload');
      await supabase
        .from('uber_events')
        .update({ 
          processing_result: 'failed',
          error_message: 'No delivery_id in payload'
        })
        .eq('event_id', eventId);

      return new Response(JSON.stringify({ error: 'No delivery_id in payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Find delivery in our database
    const { data: delivery, error: deliveryError } = await supabase
      .from('deliveries')
      .select('*, order:orders!inner(*)')
      .eq('uber_delivery_id', deliveryId)
      .single();

    if (deliveryError || !delivery) {
      console.error('Delivery not found:', deliveryId, deliveryError);
      await supabase
        .from('uber_events')
        .update({ 
          processing_result: 'failed',
          error_message: 'Delivery not found in database'
        })
        .eq('event_id', eventId);

      return new Response(JSON.stringify({ error: 'Delivery not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Map Uber status to our internal status
    let internalStatus = delivery.status;
    let orderStatus = delivery.order.status;

    switch (status) {
      case 'pending':
        internalStatus = 'pending';
        break;
      case 'pickup':
        internalStatus = 'pickup';
        orderStatus = 'out_for_delivery';
        break;
      case 'pickup_complete':
        internalStatus = 'dropoff';
        orderStatus = 'out_for_delivery';
        break;
      case 'dropoff':
        internalStatus = 'dropoff';
        orderStatus = 'out_for_delivery';
        break;
      case 'delivered':
        internalStatus = 'delivered';
        orderStatus = 'delivered';
        break;
      case 'canceled':
        internalStatus = 'canceled';
        orderStatus = 'canceled';
        break;
      case 'returned':
        internalStatus = 'failed';
        orderStatus = 'canceled';
        break;
    }

    // Update delivery status
    const { error: updateDeliveryError } = await supabase
      .from('deliveries')
      .update({
        status: internalStatus,
        delivered_at: status === 'delivered' ? new Date().toISOString() : delivery.delivered_at,
      })
      .eq('id', delivery.id);

    if (updateDeliveryError) {
      console.error('Failed to update delivery:', updateDeliveryError);
    }

    // Update order status
    const { error: updateOrderError } = await supabase
      .from('orders')
      .update({
        status: orderStatus,
        delivered_at: status === 'delivered' ? new Date().toISOString() : delivery.order.delivered_at,
      })
      .eq('id', delivery.order_id);

    if (updateOrderError) {
      console.error('Failed to update order:', updateOrderError);
    }

    // If delivered, create seller ledger entry
    if (status === 'delivered') {
      console.log('Order delivered, creating seller ledger entry');

      const order = delivery.order;
      
      // IDEMPOTENCY CHECK: Verify ledger entry doesn't already exist
      const { data: existingLedger } = await supabase
        .from('seller_ledger')
        .select('id')
        .eq('order_id', order.id)
        .eq('type', 'sale')
        .single();

      if (existingLedger) {
        console.log('Ledger entry already exists for order:', order.id);
        // Idempotent success - do not create duplicate
      } else {
        // Calculate fees (platform takes 10% + delivery cost)
        const platformFeePercent = 0.10;
        const platformFeeCents = Math.round(order.subtotal_cents * platformFeePercent);
        const deliveryFeeCents = delivery.uber_cost_cents || 0;
        const totalFeesCents = platformFeeCents + deliveryFeeCents;
        const netAmountCents = order.total_cents - totalFeesCents;

        // Create ledger entry with constraint violation protection
        try {
          const { error: ledgerError } = await supabase
            .from('seller_ledger')
            .insert({
              workspace_id: order.workspace_id,
              org_id: order.org_id,
              order_id: order.id,
              type: 'sale',
              gross_amount_cents: order.total_cents,
              fees_amount_cents: totalFeesCents,
              net_amount_cents: netAmountCents,
              currency: order.currency,
              status: 'pending',
              available_on: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // Available in 2 days
              description: `Order #${order.id.slice(0, 8)} - ${order.customer_name || 'Customer'}`,
              metadata: {
                platform_fee_cents: platformFeeCents,
                delivery_fee_cents: deliveryFeeCents,
                subtotal_cents: order.subtotal_cents,
                tax_cents: order.tax_cents,
              }
            });

          if (ledgerError) {
            // Check if error is unique constraint violation (idempotent case)
            if (ledgerError.code === '23505' || ledgerError.message?.includes('unique_order_sale_ledger')) {
              console.log('Ledger entry already exists (constraint violation) - idempotent success');
            } else {
              console.error('Failed to create ledger entry:', ledgerError);
            }
          } else {
            console.log('Seller ledger entry created successfully');
          }
        } catch (error) {
          console.error('Exception creating ledger entry:', error);
        }
      }
    }

    // Mark event as processed
    await supabase
      .from('uber_events')
      .update({ 
        processing_result: 'success',
      })
      .eq('event_id', eventId);

    return new Response(JSON.stringify({ 
      success: true,
      delivery_status: internalStatus,
      order_status: orderStatus
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in uber-webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
