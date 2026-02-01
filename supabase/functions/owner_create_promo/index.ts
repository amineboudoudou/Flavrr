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

        // Parse request body
        const body = await req.json();
        const {
            code,
            description,
            discount_type,
            discount_value,
            min_order_cents = 0,
            max_discount_cents,
            max_uses,
            max_uses_per_customer = 1,
            starts_at,
            expires_at,
            applicable_category_ids,
            applicable_item_ids,
        } = body;

        // Validate required fields
        if (!code || !discount_type || !discount_value) {
            return new Response(
                JSON.stringify({ error: 'code, discount_type, and discount_value are required' }),
                {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            );
        }

        // Validate discount type
        if (!['percentage', 'fixed_amount'].includes(discount_type)) {
            return new Response(
                JSON.stringify({ error: 'discount_type must be percentage or fixed_amount' }),
                {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            );
        }

        // Validate discount value
        if (discount_type === 'percentage' && (discount_value < 1 || discount_value > 100)) {
            return new Response(
                JSON.stringify({ error: 'Percentage discount must be between 1 and 100' }),
                {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            );
        }

        // Check if code already exists
        const { data: existing } = await supabaseClient
            .from('promo_codes')
            .select('id')
            .eq('org_id', profile.org_id)
            .eq('code', code.toUpperCase())
            .single();

        if (existing) {
            return new Response(
                JSON.stringify({ error: 'Promo code already exists' }),
                {
                    status: 409,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            );
        }

        // Create promo code
        const { data: promoCode, error: createError } = await supabaseClient
            .from('promo_codes')
            .insert({
                org_id: profile.org_id,
                created_by: user.id,
                code: code.toUpperCase(),
                description,
                discount_type,
                discount_value,
                min_order_cents,
                max_discount_cents,
                max_uses,
                max_uses_per_customer,
                starts_at: starts_at || new Date().toISOString(),
                expires_at,
                applicable_category_ids,
                applicable_item_ids,
            })
            .select()
            .single();

        if (createError) {
            throw createError;
        }

        return new Response(
            JSON.stringify({
                success: true,
                promo_code: promoCode,
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
