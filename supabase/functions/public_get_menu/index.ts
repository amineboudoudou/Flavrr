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
        // Support workspace_slug (primary) with backward compatibility for org_slug
        const workspaceSlug = url.searchParams.get('workspace_slug') || url.searchParams.get('org_slug')

        if (!workspaceSlug) {
            return new Response(
                JSON.stringify({ error: 'workspace_slug parameter required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Initialize Supabase client with service role (bypasses RLS)
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Fetch workspace and organization (multi-tenant)
        const { data: workspace, error: workspaceError } = await supabaseAdmin
            .from('workspaces')
            .select(`
                id,
                name,
                slug,
                org_id
            `)
            .eq('slug', workspaceSlug)
            .single()

        if (workspaceError || !workspace) {
            return new Response(
                JSON.stringify({ error: 'Workspace not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (!workspace.org_id) {
            return new Response(
                JSON.stringify({ error: 'Workspace configuration error' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Fetch organization details
        const { data: org, error: orgError } = await supabaseAdmin
            .from('organizations')
            .select(`
                id,
                name,
                slug,
                street,
                city,
                region,
                postal_code,
                country,
                address_json,
                address_text,
                settings
            `)
            .eq('id', workspace.org_id)
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

        // Fetch business hours
        const { data: hours, error: hoursError } = await supabaseAdmin
            .from('business_hours')
            .select('day_of_week, open_time, close_time, is_closed')
            .eq('org_id', org.id)
            .order('day_of_week', { ascending: true })

        if (hoursError) {
            throw hoursError
        }

        // Structure response with workspace info
        const response = {
            workspace: {
                id: workspace.id,
                name: workspace.name,
                slug: workspace.slug
            },
            organization: {
                id: org.id,
                name: org.name,
                slug: org.slug,
                street: org.street,
                city: org.city,
                region: org.region,
                postal_code: org.postal_code,
                country: org.country,
                address_json: org.address_json,
                address_text: org.address_text,
                settings: org.settings,
                business_hours: hours || []
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
