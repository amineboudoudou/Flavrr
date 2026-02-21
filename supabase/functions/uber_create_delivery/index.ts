import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getUberAccessToken } from '../_shared/uber-auth.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UBER_API_BASE = 'https://api.uber.com/v1/customers'
const UBER_CUSTOMER_ID = Deno.env.get('UBER_CUSTOMER_ID') ?? Deno.env.get('UBER_DIRECT_CUSTOMER_ID')

function getServiceRoleHeader(req: Request) {
    return req.headers.get('X-Service-Role-Key')
}

async function sha256Hex(input: string): Promise<string> {
    const data = new TextEncoder().encode(input)
    const hash = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const authHeader = req.headers.get('Authorization')
        const serviceRoleHeader = getServiceRoleHeader(req)

        const hasServiceRole = !!serviceRoleHeader && serviceRoleHeader === (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

        // If not internal call, require a real user JWT
        if (!hasServiceRole && !authHeader) {
            return new Response(JSON.stringify({ error: 'Missing authorization' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const { order_id, quote_id } = await req.json()
        if (!order_id) throw new Error('Missing order_id')

        console.log('🔍 UBER CREATE DELIVERY STARTED', { order_id, hasServiceRole: !!serviceRoleHeader })

        // Fetch order (workspace-scoped)
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .select('id, workspace_id, org_id, status, delivery_address, delivery_fee_cents')
            .eq('id', order_id)
            .single()

        console.log('📦 Order fetched:', { order_id: order?.id, org_id: order?.org_id, has_delivery_address: !!order?.delivery_address })

        if (orderError || !order) throw new Error('Order not found')

        if (!order.delivery_address) {
            throw new Error('Order has no delivery_address')
        }

        // If called by a user, verify they are workspace owner/admin
        if (!hasServiceRole && authHeader) {
            const supabaseClient = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_ANON_KEY') ?? '',
                { global: { headers: { Authorization: authHeader } } }
            )

            const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
            if (userError || !user) throw new Error('Unauthorized')

            const { data: membership, error: membershipError } = await supabaseAdmin
                .from('workspace_memberships')
                .select('role')
                .eq('workspace_id', order.workspace_id)
                .eq('user_id', user.id)
                .single()

            if (membershipError || !membership || !['owner', 'admin'].includes(membership.role)) {
                throw new Error('Forbidden')
            }
        }

        // Check Uber environment (allow both test and production)
        const uberEnv = Deno.env.get('UBER_ENV') || 'production'
        const isTestMode = uberEnv === 'test'
        
        console.log(`🚚 Uber Delivery Mode: ${uberEnv}`)

        console.log('🔍 Checking existing delivery...')

        // IDEMPOTENCY: one delivery per order
        const { data: existingDelivery } = await supabaseAdmin
            .from('deliveries')
            .select('id, uber_delivery_id, status, tracking_url')
            .eq('order_id', order_id)
            .maybeSingle()

        if (existingDelivery?.id) {
            return new Response(JSON.stringify({
                success: true,
                delivery_id: existingDelivery.id,
                uber_delivery_id: existingDelivery.uber_delivery_id,
                status: existingDelivery.status,
                tracking_url: existingDelivery.tracking_url,
                already_exists: true,
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        console.log('📝 Reserving delivery row...')

        // Reserve delivery row first (DB-level idempotency_key)
        const { data: reservedDelivery, error: reserveError } = await supabaseAdmin
            .from('deliveries')
            .insert({
                order_id: order_id,
                workspace_id: order.workspace_id,
                idempotency_key: order_id,
                quote_id: quote_id || null,
                status: 'delivery_requested',
                customer_delivery_fee_cents: order.delivery_fee_cents || 0,
                uber_cost_cents: 0,
                dropoff_address: order.delivery_address,
            })
            .select('id')
            .single()

        if (reserveError || !reservedDelivery) {
            if ((reserveError as any)?.code === '23505') {
                const { data: conflictedDelivery, error: conflictFetchError } = await supabaseAdmin
                    .from('deliveries')
                    .select('id, uber_delivery_id, status, tracking_url')
                    .eq('idempotency_key', order_id)
                    .single()

                if (conflictFetchError || !conflictedDelivery) throw new Error('Delivery idempotency conflict')

                return new Response(JSON.stringify({
                    success: true,
                    delivery_id: conflictedDelivery.id,
                    uber_delivery_id: conflictedDelivery.uber_delivery_id,
                    status: conflictedDelivery.status,
                    tracking_url: conflictedDelivery.tracking_url,
                    already_exists: true,
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }
            throw new Error('Failed to reserve delivery')
        }

        console.log('✅ Delivery row reserved:', reservedDelivery?.id)

        const accessToken = await getUberAccessToken()

        console.log('🔑 Got Uber access token')

        // Fetch organization details for pickup address using org_id
        const { data: org, error: orgError } = await supabaseAdmin
            .from('organizations')
            .select('name, street, city, region, postal_code, country, phone')
            .eq('id', order.org_id)
            .single()
        
        console.log('🏢 Organization found:', { name: org?.name, has_address: !!(org?.street && org?.city) })

        if (orgError || !org) {
            throw new Error('Organization not found for pickup address')
        }

        // Use real organization address for pickup
        const pickupAddressText = `${org.street}, ${org.city}, ${org.region} ${org.postal_code}, ${org.country || 'CA'}`
        const pickupPhone = org.phone || '+15145550000'

        const dropoff = order.delivery_address as any
        const dropoffAddressText = dropoff?.address || `${dropoff?.street}, ${dropoff?.city}, ${dropoff?.region} ${dropoff?.postal_code}`

        console.log('📍 Building delivery request:', { pickup: pickupAddressText, dropoff: dropoffAddressText })

        const deliveryRequest: any = {
            pickup: {
                location: {
                    address: pickupAddressText,
                },
                contact: {
                    company_name: org.name,
                    phone_number: pickupPhone,
                },
            },
            dropoff: {
                location: {
                    address: dropoffAddressText,
                    ...(dropoff?.lat && dropoff?.lng ? { latitude: dropoff.lat, longitude: dropoff.lng } : {}),
                },
                contact: {
                    first_name: order.customer_name?.split(' ')[0] || 'Customer',
                    phone_number: order.customer_phone || pickupPhone,
                },
                instructions: dropoff?.instructions || '',
            },
            manifest: {
                description: `Order #${order_id}`,
            },
        }
        
        // Add test specifications only in test mode
        if (isTestMode) {
            deliveryRequest.test_specifications = {
                robo_courier_specification: {
                    mode: "auto"
                }
            }
        }

        console.log('🚀 Calling Uber API...')

        const response = await fetch(`${UBER_API_BASE}/${UBER_CUSTOMER_ID}/deliveries`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'Idempotency-Key': await sha256Hex(order_id),
            },
            body: JSON.stringify(deliveryRequest)
        })

        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
        console.log('❌ Uber API Error:', response.status, JSON.stringify(err))

            await supabaseAdmin
                .from('deliveries')
                .update({ status: 'failed' })
                .eq('id', reservedDelivery.id)

            throw new Error('Failed to create Uber delivery')
        }

        const deliveryData = await response.json()

        const { error: finalizeError } = await supabaseAdmin
            .from('deliveries')
            .update({
                uber_delivery_id: deliveryData.id,
                tracking_url: deliveryData.tracking_url || null,
                status: deliveryData.status || 'delivery_requested',
                pickup_address: { address: pickupAddressText },
            })
            .eq('id', reservedDelivery.id)

        if (finalizeError) {
            throw new Error('Failed to finalize delivery record')
        }

        return new Response(JSON.stringify({
            success: true,
            delivery_id: reservedDelivery.id,
            uber_delivery_id: deliveryData.id,
            status: deliveryData.status || 'delivery_requested',
            tracking_url: deliveryData.tracking_url || null,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error) {
        console.error('🚨 Handler Error:', error.message, error.stack)
        return new Response(
            JSON.stringify({ error: error.message, stack: error.stack }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
