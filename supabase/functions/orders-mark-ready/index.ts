import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

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

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    // Verify JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth verification failed:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { order_id } = await req.json();

    if (!order_id) {
      return new Response(JSON.stringify({ error: 'order_id is required' }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch order and verify ownership
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, workspace:workspaces!inner(id, slug, org_id)')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      console.error('Order not found:', orderError);
      return new Response(JSON.stringify({ error: 'Order not found' }), { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify user owns this workspace
    const { data: membership } = await supabase
      .from('workspace_memberships')
      .select('role')
      .eq('workspace_id', order.workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return new Response(JSON.stringify({ error: 'Not authorized to manage this order' }), { 
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify order is paid
    if (order.status !== 'paid') {
      return new Response(JSON.stringify({ 
        error: 'Order must be paid before marking ready',
        current_status: order.status 
      }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update order status to preparing and set ready_at
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'preparing',
        ready_at: new Date().toISOString()
      })
      .eq('id', order_id)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update order:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update order' }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if delivery should be created (only for delivery orders)
    if (order.fulfillment_type === 'delivery') {
      // Check if delivery already exists
      const { data: existingDelivery } = await supabase
        .from('deliveries')
        .select('id, status')
        .eq('order_id', order_id)
        .single();

      if (!existingDelivery) {
        // Call uber-create-delivery function
        const uberResponse = await fetch(`${supabaseUrl}/functions/v1/uber-create-delivery`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ order_id })
        });

        if (!uberResponse.ok) {
          const errorData = await uberResponse.json();
          console.error('Failed to create delivery:', errorData);
          // Don't fail the whole request, just log the error
          // Order is still marked as preparing
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      order: updatedOrder,
      message: 'Order marked as ready'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in orders-mark-ready:', error);
    const origin = req.headers.get('origin');
    const errorCorsHeaders = getCorsHeaders(origin);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...errorCorsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
