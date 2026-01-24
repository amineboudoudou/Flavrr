import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
        const { order_id, quote_id }: { order_id: string; quote_id: string } = await req.json()

        if (!order_id || !quote_id) {
            return new Response(
                JSON.stringify({ error: 'Missing order_id or quote_id' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Fetch quote
        const { data: quote, error: quoteError } = await supabaseAdmin
            .from('delivery_quotes')
            .select('id, quote_id, expires_at, order_id, raw')
            .eq('id', quote_id)
            .eq('order_id', order_id)
            .single()

        if (quoteError || !quote) {
            return new Response(
                JSON.stringify({ error: 'Quote not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Check if quote expired
        if (new Date(quote.expires_at) < new Date()) {
            return new Response(
                JSON.stringify({ error: 'Quote has expired, please request a new quote' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Fetch order with organization details
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .select(`
        id,
        org_id,
        delivery_address,
        customer_name,
        customer_phone,
        organizations!inner(name, street, city, region, postal_code, country, phone, settings)
      `)
            .eq('id', order_id)
            .single()

        if (orderError || !order) {
            return new Response(
                JSON.stringify({ error: 'Order not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Verify org
        if (order.org_id !== profile.org_id) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Get Uber access token
        const accessToken = await getUberAccessToken()

        // Prepare delivery request
        const org = order.organizations
        const deliveryAddress = order.delivery_address as any
        const prepTime = org.settings?.prep_time_default || 30

        const deliveryRequest = {
            quote_id: quote.quote_id,
            pickup: {
                location: {
                    address: `${org.street}, ${org.city}, ${org.region} ${org.postal_code}, ${org.country}`,
                },
                contact: {
                    name: org.name,
                    phone_number: org.phone,
                },
                instructions: 'Please call upon arrival',
                ready_time: new Date(Date.now() + prepTime * 60 * 1000).toISOString(), // prep time from now
            },
            dropoff: {
                location: {
                    address: `${deliveryAddress.street}, ${deliveryAddress.city}, ${deliveryAddress.region} ${deliveryAddress.postal_code}, ${deliveryAddress.country || 'CA'}`,
                },
                contact: {
                    name: order.customer_name,
                    phone_number: order.customer_phone || '',
                },
                instructions: deliveryAddress.instructions || 'Leave at door',
            },
            manifest: {
                description: 'Food delivery',
            },
        }

        // Create delivery via Uber Direct
        const deliveryResponse = await fetch(
            `${UBER_API_BASE}/${UBER_CUSTOMER_ID}/deliveries`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(deliveryRequest),
            }
        )

        if (!deliveryResponse.ok) {
            const errorData = await deliveryResponse.json()
            throw new Error(`Uber API error: ${JSON.stringify(errorData)}`)
        }

        const deliveryData = await deliveryResponse.json()

        // Save delivery to database
        const { data: savedDelivery, error: deliveryError } = await supabaseAdmin
            .from('deliveries')
            .insert({
                order_id: order_id,
                provider: 'uber_direct',
                delivery_id: deliveryData.id,
                status: 'created',
                pickup_eta: deliveryData.pickup?.eta,
                dropoff_eta: deliveryData.dropoff?.eta,
                tracking_url: deliveryData.tracking_url,
                raw: deliveryData,
            })
            .select()
            .single()

        if (deliveryError) {
            throw deliveryError
        }

        // Update order status to out_for_delivery (or keep as ready until picked up)
        await supabaseAdmin
            .from('orders')
            .update({
                status: 'ready', // Will change to out_for_delivery when courier picks up
            })
            .eq('id', order_id)

        return new Response(
            JSON.stringify({
                success: true,
                delivery: {
                    id: savedDelivery.id,
                    delivery_id: savedDelivery.delivery_id,
                    status: savedDelivery.status,
                    tracking_url: savedDelivery.tracking_url,
                    pickup_eta: savedDelivery.pickup_eta,
                    dropoff_eta: savedDelivery.dropoff_eta,
                },
            }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )

    } catch (error) {
        console.error('Error creating Uber delivery:', error)
        return new Response(
            JSON.stringify({ error: 'Internal server error', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
