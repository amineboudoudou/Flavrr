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
        const { promo_id, ...updates } = body;

        if (!promo_id) {
            return new Response(
                JSON.stringify({ error: 'promo_id is required' }),
                {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            );
        }

        // Verify the promo belongs to the user's organization
        const { data: promo, error: promoError } = await supabaseClient
            .from('promo_codes')
            .select('id, org_id')
            .eq('id', promo_id)
            .single();

        if (promoError || !promo) {
            return new Response(JSON.stringify({ error: 'Promo code not found' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (promo.org_id !== profile.org_id) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Remove fields that shouldn't be updated
        delete updates.promo_id;
        delete updates.org_id;
        delete updates.created_by;
        delete updates.current_uses;
        delete updates.total_revenue_cents;
        delete updates.total_discount_given_cents;
        delete updates.created_at;

        // If updating code, ensure it's uppercase and unique
        if (updates.code) {
            updates.code = updates.code.toUpperCase();

            const { data: existing } = await supabaseClient
                .from('promo_codes')
                .select('id')
                .eq('org_id', profile.org_id)
                .eq('code', updates.code)
                .neq('id', promo_id)
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
        }

        // Update promo code
        const { data: updatedPromo, error: updateError } = await supabaseClient
            .from('promo_codes')
            .update(updates)
            .eq('id', promo_id)
            .select()
            .single();

        if (updateError) {
            throw updateError;
        }

        return new Response(
            JSON.stringify({
                success: true,
                promo_code: updatedPromo,
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
