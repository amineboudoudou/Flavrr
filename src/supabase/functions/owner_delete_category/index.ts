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
            return new Response(JSON.stringify({ error: 'Missing auth header' }), { status: 401, headers: corsHeaders })
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('org_id')
            .eq('user_id', user.id)
            .single()

        if (!profile) {
            return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })
        }

        const { category_id } = await req.json()

        if (!category_id) {
            return new Response(JSON.stringify({ error: 'Missing category_id' }), { status: 400, headers: corsHeaders })
        }

        const { error } = await supabase
            .from('menu_categories')
            .delete()
            .eq('id', category_id)
            .eq('org_id', profile.org_id)

        if (error) throw error

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }
})
