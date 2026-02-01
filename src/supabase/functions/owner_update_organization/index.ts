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

        const updates = await req.json()
        const { business_hours, address_json, address_text, ...orgUpdates } = updates

        const addressProvided = Object.prototype.hasOwnProperty.call(updates, 'address_json')
        let normalizedAddress: Record<string, any> | null = null

        if (addressProvided && !address_json) {
            return new Response(JSON.stringify({
                error: 'Invalid address',
                details: 'Please select a valid address from suggestions before saving.'
            }), { status: 400, headers: corsHeaders })
        }

        if (address_json) {
            const requiredFields = ['street1', 'city', 'province', 'postal_code', 'country', 'lat', 'lng', 'place_id']
            const missing = requiredFields.filter((field) => !address_json[field] && address_json[field] !== 0)

            if (missing.length > 0) {
                return new Response(JSON.stringify({
                    error: 'Invalid address',
                    details: `Missing fields: ${missing.join(', ')}`
                }), { status: 400, headers: corsHeaders })
            }

            const lat = Number(address_json.lat)
            const lng = Number(address_json.lng)
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                return new Response(JSON.stringify({
                    error: 'Invalid address',
                    details: 'Latitude/Longitude must be valid numbers'
                }), { status: 400, headers: corsHeaders })
            }

            normalizedAddress = {
                street1: String(address_json.street1).trim(),
                city: String(address_json.city).trim(),
                province: String(address_json.province).trim(),
                postal_code: String(address_json.postal_code).trim(),
                country: String(address_json.country).trim(),
                lat,
                lng,
                place_id: String(address_json.place_id).trim(),
                ...(address_json.formatted ? { formatted: String(address_json.formatted) } : {}),
            }

            orgUpdates.street = normalizedAddress.street1
            orgUpdates.city = normalizedAddress.city
            orgUpdates.region = normalizedAddress.province
            orgUpdates.postal_code = normalizedAddress.postal_code
            orgUpdates.country = normalizedAddress.country
        }

        const updatePayload: Record<string, any> = { ...orgUpdates }

        if (normalizedAddress) {
            updatePayload.address_json = normalizedAddress
            updatePayload.address_text = address_text || normalizedAddress.formatted || normalizedAddress.street1
        } else if (typeof address_text === 'string') {
            updatePayload.address_text = address_text
        }

        // 1. Update organization basic settings
        const { data: organization, error: orgError } = await supabase
            .from('organizations')
            .update(updatePayload)
            .eq('id', profile.org_id)
            .select()
            .single()

        if (orgError) {
            return new Response(JSON.stringify({ error: 'Failed to update organization', details: orgError.message }), { status: 400, headers: corsHeaders })
        }

        // 2. Update business hours if provided
        if (business_hours && Array.isArray(business_hours)) {
            for (const hour of business_hours) {
                const { day_of_week, open_time, close_time, is_closed } = hour
                const { error: hourError } = await supabase
                    .from('business_hours')
                    .upsert({
                        org_id: profile.org_id,
                        day_of_week,
                        open_time,
                        close_time,
                        is_closed
                    }, { onConflict: 'org_id,day_of_week' })

                if (hourError) {
                    console.error('Failed to update business hour:', hourError)
                }
            }
        }

        // Fetch final state of hours
        const { data: finalHours } = await supabase
            .from('business_hours')
            .select('*')
            .eq('org_id', profile.org_id)
            .order('day_of_week', { ascending: true })

        return new Response(JSON.stringify({
            organization: {
                ...organization,
                business_hours: finalHours || []
            }
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }
})
