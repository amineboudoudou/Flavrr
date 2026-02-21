import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    const results: any = {
        timestamp: new Date().toISOString(),
        env_check: {},
        token_test: {},
        api_test: {},
    }

    // Check environment variables
    const clientId = Deno.env.get('UBER_CLIENT_ID') ?? Deno.env.get('UBER_DIRECT_CLIENT_ID')
    const clientSecret = Deno.env.get('UBER_CLIENT_SECRET') ?? Deno.env.get('UBER_DIRECT_CLIENT_SECRET')
    const customerId = Deno.env.get('UBER_CUSTOMER_ID') ?? Deno.env.get('UBER_DIRECT_CUSTOMER_ID')
    const uberEnv = Deno.env.get('UBER_ENV')

    results.env_check = {
        has_client_id: !!clientId,
        has_client_secret: !!clientSecret,
        has_customer_id: !!customerId,
        uber_env: uberEnv || 'not set',
    }

    if (!clientId || !clientSecret) {
        return new Response(JSON.stringify({
            error: 'Missing credentials',
            ...results
        }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    // Test token endpoint
    try {
        const tokenUrl = 'https://auth.uber.com/oauth/v2/token'
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: 'client_credentials',
                scope: 'eats.deliveries',
            }),
        })

        results.token_test = {
            status: response.status,
            status_text: response.statusText,
        }

        if (response.ok) {
            const data = await response.json()
            results.token_test.success = true
            results.token_test.expires_in = data.expires_in
            results.token_test.scope = data.scope

            // Test API endpoint with token
            const accessToken = data.access_token
            const apiBase = 'https://api.uber.com/v1/customers'
            const apiUrl = `${apiBase}/${customerId}/deliveries`

            results.api_test = {
                url: apiUrl,
            }

            // Try a simple GET to check if endpoint exists (or POST with minimal data)
            const apiResponse = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            })

            results.api_test.status = apiResponse.status
            results.api_test.status_text = apiResponse.statusText

            const apiBody = await apiResponse.text()
            results.api_test.response_preview = apiBody.substring(0, 500)

        } else {
            const errorText = await response.text()
            results.token_test.success = false
            results.token_test.error = errorText
        }

        return new Response(JSON.stringify(results, null, 2), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        return new Response(JSON.stringify({
            error: error.message,
            stack: error.stack,
            ...results
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
