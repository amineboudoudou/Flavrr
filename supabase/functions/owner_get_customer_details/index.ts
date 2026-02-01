import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
                global: {
                    headers: { Authorization: req.headers.get('Authorization')! },
                },
            }
        );

        // Verify authentication
        const {
            data: { user },
            error: authError,
        } = await supabaseClient.auth.getUser();

        if (authError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Get user's organization
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('org_id')
            .eq('user_id', user.id)
            .single();

        if (profileError || !profile) {
            return new Response(JSON.stringify({ error: 'Profile not found' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Parse query parameters
        const url = new URL(req.url);
        const customerId = url.searchParams.get('customer_id');

        if (!customerId) {
            return new Response(
                JSON.stringify({ error: 'customer_id is required' }),
                {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            );
        }

        // Get customer details
        const { data: customer, error: customerError } = await supabaseClient
            .from('customers')
            .select('*')
            .eq('id', customerId)
            .eq('org_id', profile.org_id)
            .single();

        if (customerError || !customer) {
            return new Response(JSON.stringify({ error: 'Customer not found' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Get customer addresses
        const { data: addresses, error: addressesError } = await supabaseClient
            .from('customer_addresses')
            .select('*')
            .eq('customer_id', customerId)
            .order('use_count', { ascending: false });

        if (addressesError) {
            console.error('Error fetching addresses:', addressesError);
        }

        // Get recent orders
        const { data: orders, error: ordersError } = await supabaseClient
            .from('orders')
            .select('*')
            .eq('org_id', profile.org_id)
            .eq('customer_email', customer.email)
            .order('created_at', { ascending: false })
            .limit(20);

        if (ordersError) {
            console.error('Error fetching orders:', ordersError);
        }

        // Get order items to calculate favorite items
        const orderIds = orders?.map((o) => o.id) || [];
        let favoriteItems: any[] = [];

        if (orderIds.length > 0) {
            const { data: orderItems, error: itemsError } = await supabaseClient
                .from('order_items')
                .select('name_snapshot, quantity')
                .in('order_id', orderIds);

            if (!itemsError && orderItems) {
                // Aggregate items by name
                const itemCounts: { [key: string]: number } = {};
                orderItems.forEach((item) => {
                    itemCounts[item.name_snapshot] = (itemCounts[item.name_snapshot] || 0) + item.quantity;
                });

                // Sort by count and take top 5
                favoriteItems = Object.entries(itemCounts)
                    .map(([name, count]) => ({ name, count }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 5);
            }
        }

        return new Response(
            JSON.stringify({
                ...customer,
                addresses: addresses || [],
                recent_orders: orders || [],
                favorite_items: favoriteItems,
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    } catch (error) {
        console.error('Error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    }
});
