import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getUberAccessToken } from '../_shared/uber-auth.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UBER_API_BASE = 'https://api.uber.com/v1/customers'
const UBER_CUSTOMER_ID = Deno.env.get('UBER_CUSTOMER_ID') ?? Deno.env.get('UBER_DIRECT_CUSTOMER_ID')

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 1. Verify Authentication
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            throw new Error('Missing authorization header')
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
        if (userError || !user) throw new Error('Unauthorized')

        // 2. Parse Request
        const { order_id } = await req.json()
        if (!order_id) throw new Error('Missing order_id')

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 3. Fetch Order & Org
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .select(`
                *,
                organizations (
                    name, street, city, region, postal_code, country, phone, settings
                )
            `)
            .eq('id', order_id)
            .single()

        if (orderError || !order) throw new Error('Order not found')

        // 4. Validate Delivery Eligibility
        if (order.fulfillment_type !== 'delivery') {
            throw new Error('Order is not for delivery')
        }

        const org = order.organizations

        // STRICT VALIDATION: Seller settings are the single source of truth
        const missingFields = []
        if (!org.name) missingFields.push('Restaurant Name')
        if (!org.street) missingFields.push('Street Address')
        if (!org.city) missingFields.push('City')
        if (!org.region) missingFields.push('Province/Region')
        if (!org.postal_code) missingFields.push('Postal Code')
        if (!org.country) missingFields.push('Country')
        if (!org.phone) missingFields.push('Phone Number')

        if (missingFields.length > 0) {
            console.error('❌ Uber Delivery Blocked: Missing Seller Settings', missingFields)
            throw new Error(`Restaurant address incomplete. Please complete Settings before requesting delivery. Missing: ${missingFields.join(', ')}`)
        }

        // User check (for delivery)
        const deliveryAddress = order.delivery_address as any
        if (!deliveryAddress?.street) throw new Error('Delivery address missing')

        // 5. Environment Check & Auth
        const uberEnv = Deno.env.get('UBER_ENV')
        if (uberEnv !== 'test') {
            throw new Error('Safety Guard: UBER_ENV is not set to "test". Delivery creation blocked.')
        }

        // 6. IDEMPOTENCY CHECK: Prevent duplicate deliveries
        const { data: existingDelivery, error: deliveryCheckError } = await supabaseAdmin
            .from('deliveries')
            .select('id, external_id, status, eta_minutes, tracking_url')
            .eq('order_id', order_id)
            .single()

        if (existingDelivery) {
            console.log('✅ Delivery already exists for this order:', existingDelivery.id)
            return new Response(
                JSON.stringify({
                    success: true,
                    delivery_id: existingDelivery.id,
                    external_id: existingDelivery.external_id,
                    status: existingDelivery.status,
                    eta_minutes: existingDelivery.eta_minutes,
                    tracking_url: existingDelivery.tracking_url,
                    already_exists: true
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 7. Access Token
        const accessToken = await getUberAccessToken()

        // 8. Prepare Uber Payload
        const prepTime = org.settings?.prep_time_default || 30
        const pickupData = {
            location: {
                address: `${org.street}, ${org.city}, ${org.region} ${org.postal_code}, ${org.country}`,
            },
            contact: {
                company_name: org.name,
                phone: org.phone,
            },
            pickup_ready_time: new Date(Date.now() + prepTime * 60 * 1000).toISOString(),
        }

        const dropoffData = {
            location: {
                address: `${deliveryAddress.street}, ${deliveryAddress.city}, ${deliveryAddress.region} ${deliveryAddress.postal_code}, ${deliveryAddress.country || 'CA'}`,
            },
            contact: {
                first_name: order.customer_name?.split(' ')[0] || 'Guest',
                last_name: order.customer_name?.split(' ').slice(1).join(' ') || '',
                phone: order.customer_phone || '',
            },
            special_instructions: deliveryAddress.instructions || 'Leave at door',
        }

        const deliveryRequest = {
            pickup_name: org.name,
            pickup_address: JSON.stringify(pickupData.location),
            pickup_phone_number: org.phone,
            dropoff_name: order.customer_name,
            dropoff_address: JSON.stringify(dropoffData.location),
            dropoff_phone_number: order.customer_phone,
            manifest_items: [{
                name: "Food Order #" + order.order_number,
                quantity: 1,
                size: "medium",
                dimensions: {
                    length: 10,
                    height: 10,
                    depth: 10
                }
            }],
            test_specifications: {
                robo_courier_specification: {
                    mode: "auto"
                }
            }
        }

        // Note: The payload above is a simplified version. The real Uber API /v1/customers/{customer_id}/deliveries 
        // has a specific structure. I will use the structure from the existing code (which looked more correct)
        // but ensure it matches the docs or standard practice. 
        // Existing code used:
        /*
          pickup: { location: { address: ... }, contact: { ... }, ... },
          dropoff: { location: { address: ... }, contact: { ... }, ... },
          manifest: { description: ... }
        */
        // I will revert to that structure but keep the logic I added.

        const realDeliveryRequest = {
            pickup: {
                location: {
                    address: `${org.street}, ${org.city}, ${org.region} ${org.postal_code}, ${org.country}`,
                },
                contact: {
                    company_name: org.name,
                    phone_number: org.phone,
                },
            },
            dropoff: {
                location: {
                    address: `${deliveryAddress.street}, ${deliveryAddress.city}, ${deliveryAddress.region} ${deliveryAddress.postal_code}, ${deliveryAddress.country || 'CA'}`,
                    ...(deliveryAddress.lat && deliveryAddress.lng ? {
                        latitude: deliveryAddress.lat,
                        longitude: deliveryAddress.lng
                    } : {})
                },
                contact: {
                    first_name: order.customer_name,
                    phone_number: order.customer_phone || '',
                },
                instructions: deliveryAddress.instructions || '',
            },
            manifest: {
                description: `Order #${order.order_number}`,
            },
            test_specifications: {
                // For test environment to simulate valid flows
            }
        }

        console.log('🚚 Creating Uber Delivery (TEST MODE)...', JSON.stringify(realDeliveryRequest))

        const response = await fetch(`${UBER_API_BASE}/${UBER_CUSTOMER_ID}/deliveries`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(realDeliveryRequest)
        })

        if (!response.ok) {
            const err = await response.json()
            console.error('❌ Uber Create Delivery Error:', JSON.stringify(err))
            throw new Error('Failed to create Uber delivery: ' + (err.message || response.statusText))
        }

        const deliveryData = await response.json()
        console.log('✅ Delivery created:', deliveryData.id)

        // 9. Save to deliveries table
        const { data: deliveryRecord, error: deliveryInsertError } = await supabaseAdmin
            .from('deliveries')
            .insert({
                order_id: order_id,
                provider: 'uber_direct_test',
                external_id: deliveryData.id,
                status: deliveryData.status || 'created',
                eta_minutes: deliveryData.dropoff_eta ? Math.round((new Date(deliveryData.dropoff_eta).getTime() - Date.now()) / 60000) : null,
                tracking_url: deliveryData.tracking_url || null,
                raw_response: deliveryData
            })
            .select()
            .single()

        if (deliveryInsertError) {
            console.error('❌ Failed to insert delivery record:', deliveryInsertError)
            throw new Error('Failed to save delivery record: ' + deliveryInsertError.message)
        }

        // 10. Link delivery to order and update status to ready
        const { error: updateError } = await supabaseAdmin
            .from('orders')
            .update({
                delivery_id: deliveryRecord.id,
                status: 'ready',
                uber_delivery_id: deliveryData.id,
                uber_tracking_url: deliveryData.tracking_url,
                uber_status: deliveryData.status,
                last_uber_sync_at: new Date().toISOString()
            })
            .eq('id', order_id)

        if (updateError) {
            console.error('❌ Failed to update order with delivery info:', updateError)
            throw new Error('Failed to link delivery to order: ' + updateError.message)
        }

        // 11. Return delivery info for frontend
        return new Response(
            JSON.stringify({ 
                success: true, 
                delivery_id: deliveryRecord.id,
                external_id: deliveryData.id,
                status: deliveryData.status,
                eta_minutes: deliveryRecord.eta_minutes,
                tracking_url: deliveryData.tracking_url
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
