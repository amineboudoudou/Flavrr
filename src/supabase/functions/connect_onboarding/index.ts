import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno'

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
            throw new Error('Missing authorization header')
        }

        // Initialize Supabase Client
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        // Get User
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
        if (userError || !user) throw new Error('Unauthorized')

        // Get Profile to verify request matches org
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('org_id')
            .eq('user_id', user.id)
            .single()

        if (!profile?.org_id) throw new Error('Profile not found')

        // Initialize Admin Client (Service Role)
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Initialize Stripe
        const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
            apiVersion: '2023-10-16',
            httpClient: Stripe.createFetchHttpClient(),
        })

        // Check if Org already has Stripe Account
        const { data: org, error: orgError } = await supabaseAdmin
            .from('organizations')
            .select('stripe_account_id')
            .eq('id', profile.org_id)
            .single()

        if (orgError) throw orgError

        let accountId = org.stripe_account_id

        if (!accountId) {
            console.log('Creating new Express account...')
            const account = await stripe.accounts.create({
                type: 'express',
                country: 'CA', // Defaulting to Canada as per user context (Cafe Du Griot)
                email: user.email,
                capabilities: {
                    card_payments: { requested: true },
                    transfers: { requested: true },
                },
                business_type: 'company',
            })
            accountId = account.id

            // Save to DB
            const { error: updateError } = await supabaseAdmin
                .from('organizations')
                .update({
                    stripe_account_id: accountId,
                    stripe_account_created_at: new Date().toISOString(),
                })
                .eq('id', profile.org_id)

            if (updateError) throw updateError
        }

        // Create Account Link
        const origin = req.headers.get('origin') || 'http://localhost:5173'
        const accountLink = await stripe.accountLinks.create({
            account: accountId,
            refresh_url: `${origin}/owner/settings?connect=refresh`,
            return_url: `${origin}/owner/settings?connect=return`,
            type: 'account_onboarding',
        })

        return new Response(
            JSON.stringify({ url: accountLink.url }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
