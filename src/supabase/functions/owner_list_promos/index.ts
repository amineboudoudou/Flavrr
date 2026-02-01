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
        const status = url.searchParams.get('status'); // active, expired, all
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const offset = parseInt(url.searchParams.get('offset') || '0');

        // Build query
        let query = supabaseClient
            .from('promo_codes')
            .select('*')
            .eq('org_id', profile.org_id)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        // Apply status filter
        const now = new Date().toISOString();
        if (status === 'active') {
            query = query
                .eq('is_active', true)
                .or(`expires_at.is.null,expires_at.gt.${now}`);
        } else if (status === 'expired') {
            query = query.lt('expires_at', now);
        }

        const { data: promoCodes, error: promoError } = await query;

        if (promoError) {
            throw promoError;
        }

        // Get total count
        let countQuery = supabaseClient
            .from('promo_codes')
            .select('*', { count: 'exact', head: true })
            .eq('org_id', profile.org_id);

        if (status === 'active') {
            countQuery = countQuery
                .eq('is_active', true)
                .or(`expires_at.is.null,expires_at.gt.${now}`);
        } else if (status === 'expired') {
            countQuery = countQuery.lt('expires_at', now);
        }

        const { count } = await countQuery;

        return new Response(
            JSON.stringify({
                promo_codes: promoCodes || [],
                total: count || 0,
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
