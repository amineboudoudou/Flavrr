import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

    // Get active products for the workspace (for manual order creation)
    const { data: products, error: productsError } = await supabaseAdmin
      .from('products')
      .select(`
        id,
        name,
        name_fr,
        name_en,
        description,
        description_fr,
        description_en,
        base_price_cents,
        image_url,
        status,
        visibility,
        track_quantity,
        quantity,
        reserved_quantity,
        allow_overselling,
        category_id,
        sort_order,
        allergens,
        ingredients,
        is_best_seller
      `)
      .eq('workspace_id', membership.workspace_id)
      .eq('status', 'active')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (productsError) {
      console.error('Error fetching products:', productsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch products', details: productsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Transform products for the frontend
    const transformedProducts = (products || []).map(product => {
      const availableQty = product.track_quantity 
        ? Math.max(0, product.quantity - product.reserved_quantity)
        : null;

      return {
        id: product.id,
        name: product.name,
        name_fr: product.name_fr,
        name_en: product.name_en,
        description: product.description,
        description_fr: product.description_fr,
        description_en: product.description_en,
        base_price_cents: product.base_price_cents,
        image_url: product.image_url,
        status: product.status,
        visibility: product.visibility,
        category_id: product.category_id,
        sort_order: product.sort_order,
        allergens: product.allergens || [],
        ingredients: product.ingredients || [],
        is_best_seller: product.is_best_seller,
        inventory: {
          track_quantity: product.track_quantity,
          available: availableQty,
          total: product.quantity,
          reserved: product.reserved_quantity,
          allow_overselling: product.allow_overselling
        }
      };
    });

    return new Response(
      JSON.stringify({ 
        products: transformedProducts,
        count: transformedProducts.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in owner-list-products:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
