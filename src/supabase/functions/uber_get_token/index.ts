import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TokenCache {
    access_token: string;
    expires_at: number;
}

let tokenCache: TokenCache | null = null;

async function getUberAccessToken(): Promise<string> {
    const clientId = Deno.env.get('UBER_CLIENT_ID')
    const clientSecret = Deno.env.get('UBER_CLIENT_SECRET')
    const tokenUrl = 'https://auth.uber.com/oauth/v2/token'

    if (!clientId || !clientSecret) {
        throw new Error('Missing Uber credentials (UBER_CLIENT_ID or UBER_CLIENT_SECRET)')
    }

    // Check cache first (with 5 minute buffer before expiry)
    const now = Date.now()
    if (tokenCache && tokenCache.expires_at > now + 300000) {
        console.log('✅ Using cached Uber token')
        return tokenCache.access_token
    }

    console.log('🔄 Requesting new Uber access token...')

    try {
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

        if (!response.ok) {
            const errorText = await response.text()
            console.error(`❌ Uber Token Error (${response.status}):`, errorText)
            throw new Error(`Uber Token Failed: ${response.status} ${errorText}`)
        }

        const data = await response.json()
        console.log('✅ Uber access token received (expires in ' + data.expires_in + 's)')

        // Cache the token
        tokenCache = {
            access_token: data.access_token,
            expires_at: now + (data.expires_in * 1000)
        }

        return data.access_token

    } catch (error) {
        console.error('❌ Exception requesting Uber token:', error)
        throw error
    }
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // This endpoint requires authentication
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            throw new Error('Missing authorization header')
        }

        const accessToken = await getUberAccessToken()

        return new Response(
            JSON.stringify({ 
                success: true, 
                access_token: accessToken,
                cached: tokenCache !== null
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('🚨 Handler Error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
