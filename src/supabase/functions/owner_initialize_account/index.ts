import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Missing authorization header' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        // Get authenticated user
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
        if (userError || !user) {
            console.error('Auth error:', userError)
            return new Response(
                JSON.stringify({ error: 'Unauthorized', details: userError?.message }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Parse request body
        const { full_name, org_name }: { full_name: string; org_name: string } = await req.json()

        if (!full_name || !org_name) {
            return new Response(
                JSON.stringify({ error: 'Missing full_name or org_name' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Use service role to bypass RLS for initial setup
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Check if user already has a profile
        const { data: existingProfile } = await supabaseAdmin
            .from('profiles')
            .select('user_id')
            .eq('user_id', user.id)
            .single()

        if (existingProfile) {
            return new Response(
                JSON.stringify({ error: 'Account already initialized' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 1. Create Organization
        const slug = org_name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-') + '-' + Math.random().toString(36).substring(2, 7)

        const { data: org, error: orgError } = await supabaseAdmin
            .from('organizations')
            .insert({
                name: org_name,
                slug: slug,
                email: user.email
            })
            .select()
            .single()

        if (orgError) throw orgError

        // 2. Create Profile
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .insert({
                user_id: user.id,
                org_id: org.id,
                role: 'owner',
                full_name: full_name
            })
            .select()
            .single()

        if (profileError) throw profileError

        return new Response(
            JSON.stringify({ success: true, organization: org, profile: profile }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Error initializing account:', error)
        return new Response(
            JSON.stringify({ error: 'Internal server error', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
