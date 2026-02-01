import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Uber Direct API configuration
const UBER_API_BASE = 'https://api.uber.com/v1/customers'
const UBER_CUSTOMER_ID = Deno.env.get('UBER_DIRECT_CUSTOMER_ID') ?? ''

async function getUberAccessToken(): Promise<string> {
    const clientId = Deno.env.get('UBER_DIRECT_CLIENT_ID') ?? ''
    const clientSecret = Deno.env.get('UBER_DIRECT_CLIENT_SECRET') ?? ''

    const response = await fetch('https://login.uber.com/oauth/v2/token', {
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

    const data = await response.json()
    return data.access_token
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Verify authentication
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

        const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
        if (userError || !user) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Get user's profile
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('org_id, role')
            .eq('user_id', user.id)
            .single()

        if (profileError || !profile) {
            return new Response(
                JSON.stringify({ error: 'Profile not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Parse request
        const { order_id }: { order_id: string } = await req.json()

        if (!order_id) {
            return new Response(
                JSON.stringify({ error: 'Missing order_id' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Use service role to fetch order details
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Fetch order with organization
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .select(`
        id,
        org_id,
        delivery_address,
        fulfillment_type,
        organizations!inner(street, city, region, postal_code, country, phone)
      `)
            .eq('id', order_id)
            .single()

        if (orderError || !order) {
            return new Response(
                JSON.stringify({ error: 'Order not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Verify user belongs to org
        if (order.org_id !== profile.org_id) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Validate it's a delivery order
        if (order.fulfillment_type !== 'delivery') {
            return new Response(
                JSON.stringify({ error: 'Order is not for delivery' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Check for Sandbox Mode
        const IS_SANDBOX = !Deno.env.get('UBER_DIRECT_CLIENT_ID') || Deno.env.get('UBER_SANDBOX_MODE') === 'true'

        let quoteData;

        if (IS_SANDBOX) {
            console.log('🚚 Simulation Mode: Creating mock quote')
            quoteData = {
                quotes: [{
                    id: `quo_${crypto.randomUUID()}`,
                    fee: 5.99,
                    duration: 45,
                    currency_code: 'CAD',
                    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
                }]
            }
        } else {
            // Get Uber access token
            const accessToken = await getUberAccessToken()

            // Prepare quote request
            const org = order.organizations
            const deliveryAddress = order.delivery_address as any

            const quoteRequest = {
                pickup: {
                    location: {
                        address: `${org.street}, ${org.city}, ${org.region} ${org.postal_code}, ${org.country}`,
                    },
                    contact: {
                        phone_number: org.phone,
                    },
                },
                dropoff: {
                    location: {
                        address: `${deliveryAddress.street}, ${deliveryAddress.city}, ${deliveryAddress.region} ${deliveryAddress.postal_code}, ${deliveryAddress.country || 'CA'}`,
                    },
                },
            }

            // Request quote from Uber Direct
            const quoteResponse = await fetch(
                `${UBER_API_BASE}/${UBER_CUSTOMER_ID}/delivery_quotes`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(quoteRequest),
                }
            )

            if (!quoteResponse.ok) {
                const errorData = await quoteResponse.json()
                throw new Error(`Uber API error: ${JSON.stringify(errorData)}`)
            }

            quoteData = await quoteResponse.json()
        }

        // Parse quote data
        const quote = quoteData.quotes?.[0] // Take first quote
        if (!quote) {
            throw new Error('No quote available from Uber Direct')
        }

        // Calculate expiration (quotes typically valid for 5 minutes)
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

        // Store quote in database
        const { data: savedQuote, error: quoteError } = await supabaseAdmin
            .from('delivery_quotes')
            .insert({
                order_id: order_id,
                provider: 'uber_direct',
                quote_id: quote.id,
                fee_cents: Math.round(quote.fee * 100), // Convert dollars to cents
                eta_minutes: quote.duration,
                expires_at: expiresAt,
                raw: quote,
            })
            .select()
            .single()

        if (quoteError) {
            throw quoteError
        }

        return new Response(
            JSON.stringify({
                success: true,
                quote: {
                    id: savedQuote.id,
                    quote_id: savedQuote.quote_id,
                    fee_cents: savedQuote.fee_cents,
                    eta_minutes: savedQuote.eta_minutes,
                    expires_at: savedQuote.expires_at,
                },
            }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )

    } catch (error) {
        console.error('Error getting Uber quote:', error)
        return new Response(
            JSON.stringify({ error: 'Internal server error', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
