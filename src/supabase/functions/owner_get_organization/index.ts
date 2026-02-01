import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'No auth header' }), { status: 401, headers: corsHeaders })
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized', details: userError?.message }), { status: 401, headers: corsHeaders })
        }

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('org_id')
            .eq('user_id', user.id)
            .single()

        if (profileError || !profile) {
            return new Response(JSON.stringify({ error: 'Profile not found' }), { status: 404, headers: corsHeaders })
        }

        const { data: organization, error: orgError } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', profile.org_id)
            .single()

        if (orgError) {
            return new Response(JSON.stringify({ error: 'Organization not found' }), { status: 404, headers: corsHeaders })
        }

        const { data: hours, error: hoursError } = await supabase
            .from('business_hours')
            .select('*')
            .eq('org_id', profile.org_id)
            .order('day_of_week', { ascending: true })

        if (hoursError) {
            return new Response(JSON.stringify({ error: 'Business hours not found' }), { status: 404, headers: corsHeaders })
        }

        return new Response(JSON.stringify({
            organization: {
                ...organization,
                business_hours: hours || []
            }
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }
})
