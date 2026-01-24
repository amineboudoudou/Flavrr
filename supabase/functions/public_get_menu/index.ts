import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const url = new URL(req.url)
        const orgSlug = url.searchParams.get('org_slug')

        if (!orgSlug) {
            return new Response(
                JSON.stringify({ error: 'org_slug parameter required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Initialize Supabase client with service role (bypasses RLS)
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Fetch organization
        const { data: org, error: orgError } = await supabaseAdmin
            .from('organizations')
            .select('id, name, slug, settings')
            .eq('slug', orgSlug)
            .single()

        if (orgError || !org) {
            return new Response(
                JSON.stringify({ error: 'Organization not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Fetch active categories with their active menu items
        const { data: categories, error: categoriesError } = await supabaseAdmin
            .from('menu_categories')
            .select(`
        id,
        name_fr,
        name_en,
        sort_order
      `)
            .eq('org_id', org.id)
            .eq('is_active', true)
            .order('sort_order', { ascending: true })

        if (categoriesError) {
            throw categoriesError
        }

        // Fetch all active menu items for this org
        const { data: items, error: itemsError } = await supabaseAdmin
            .from('menu_items')
            .select(`
        id,
        category_id,
        name_fr,
        name_en,
        description_fr,
        description_en,
        price_cents,
        image_url,
        allergens,
        ingredients,
        sort_order
      `)
            .eq('org_id', org.id)
            .eq('is_active', true)
            .order('sort_order', { ascending: true })

        if (itemsError) {
            throw itemsError
        }

        // Group items by category
        const menuData = categories.map(category => ({
            ...category,
            items: items.filter(item => item.category_id === category.id)
        }))

        // Structure response
        const response = {
            organization: {
                name: org.name,
                slug: org.slug,
                settings: org.settings
            },
            menu: menuData
        }

        // Return with cache headers (60 seconds)
        return new Response(
            JSON.stringify(response),
            {
                status: 200,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, max-age=60, s-maxage=120',
                }
            }
        )

    } catch (error) {
        console.error('Error fetching menu:', error)
        return new Response(
            JSON.stringify({ error: 'Internal server error', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
