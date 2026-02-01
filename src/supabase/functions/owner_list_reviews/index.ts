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
        const status = url.searchParams.get('status');
        const rating = url.searchParams.get('rating');
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const offset = parseInt(url.searchParams.get('offset') || '0');

        // Build query
        let query = supabaseClient
            .from('reviews')
            .select(`
        *,
        order:orders!inner(
          order_number,
          total_cents,
          created_at
        )
      `)
            .eq('org_id', profile.org_id)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        // Apply filters
        if (status) {
            query = query.eq('status', status);
        }
        if (rating) {
            query = query.eq('rating', parseInt(rating));
        }

        const { data: reviews, error: reviewsError } = await query;

        if (reviewsError) {
            throw reviewsError;
        }

        // Get statistics
        const { data: stats, error: statsError } = await supabaseClient.rpc(
            'get_review_stats',
            { p_org_id: profile.org_id }
        ).single();

        // If the RPC doesn't exist yet, calculate stats manually
        let reviewStats = {
            average_rating: 0,
            total_reviews: 0,
            pending_count: 0,
            approved_count: 0,
            rejected_count: 0,
        };

        if (!statsError && stats) {
            reviewStats = stats;
        } else {
            // Calculate stats from all reviews
            const { data: allReviews } = await supabaseClient
                .from('reviews')
                .select('rating, status')
                .eq('org_id', profile.org_id);

            if (allReviews && allReviews.length > 0) {
                reviewStats.total_reviews = allReviews.length;
                reviewStats.average_rating =
                    allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
                reviewStats.pending_count = allReviews.filter((r) => r.status === 'pending').length;
                reviewStats.approved_count = allReviews.filter((r) => r.status === 'approved').length;
                reviewStats.rejected_count = allReviews.filter((r) => r.status === 'rejected').length;
            }
        }

        // Get total count for pagination
        const { count } = await supabaseClient
            .from('reviews')
            .select('*', { count: 'exact', head: true })
            .eq('org_id', profile.org_id);

        return new Response(
            JSON.stringify({
                reviews: reviews || [],
                total: count || 0,
                stats: reviewStats,
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
