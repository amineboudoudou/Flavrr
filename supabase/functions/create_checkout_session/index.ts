import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
}

interface CartItem {
    menu_item_id: string
    quantity: number
    modifiers?: Record<string, any>
    notes?: string
}

interface CustomerInfo {
    name: string
    phone?: string
    email: string
    marketing_opt_in?: boolean
}

interface FulfillmentInfo {
    type: 'pickup' | 'delivery'
    address?: {
        street: string
        city: string
        region: string
        postal_code: string
        country?: string
        lat?: number
        lng?: number
    }
}

serve(async (req) => {
    // Handle CORS preflight for Safari iOS
    if (req.method === 'OPTIONS') {
        return new Response(null, { 
            status: 204,
            headers: corsHeaders 
        })
    }

    const requestId = crypto.randomUUID()
    
    try {
        // PUBLIC ENDPOINT - NO AUTH REQUIRED
        // Service role key used internally for all DB operations
        console.log(`[${requestId}] Processing checkout request`)
        
        const {
            org_slug,
            cart,
            customer,
            fulfillment,
            notes,
            idempotency_key
        }: {
            org_slug: string
            cart: CartItem[]
            customer: CustomerInfo
            fulfillment: FulfillmentInfo
            notes?: string
            idempotency_key?: string
        } = await req.json()

        // Validate required fields
        if (!org_slug || !cart || cart.length === 0 || !customer || !customer.email || !fulfillment) {
            console.error(`[${requestId}] Missing required fields`)
            return new Response(
                JSON.stringify({ 
                    ok: false,
                    code: 'INVALID_REQUEST',
                    error: 'Missing required fields (email is required)',
                    requestId 
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Normalize email
        const normalizedEmail = customer.email.trim().toLowerCase()

        // Initialize clients
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
            apiVersion: '2023-10-16',
        })

        // 1. Fetch and validate organization
        const { data: org, error: orgError } = await supabaseAdmin
            .from('organizations')
            .select('id, name, slug, currency, settings')
            .eq('slug', org_slug)
            .single()

        if (orgError || !org) {
            console.error(`[${requestId}] Organization not found: ${org_slug}`, orgError)
            return new Response(
                JSON.stringify({ 
                    ok: false,
                    code: 'ORG_NOT_FOUND',
                    error: 'Organization not found',
                    requestId 
                }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 2. Fetch and validate menu items (server-side pricing validation)
        const menuItemIds = cart.map(item => item.menu_item_id)
        const { data: menuItems, error: itemsError } = await supabaseAdmin
            .from('menu_items')
            .select('id, name_fr, name_en, price_cents, is_active')
            .eq('org_id', org.id)
            .in('id', menuItemIds)

        if (itemsError) {
            throw itemsError
        }

        // Validate all items exist and are active
        if (menuItems.length !== menuItemIds.length) {
            console.error(`[${requestId}] Menu items not found`)
            return new Response(
                JSON.stringify({ 
                    ok: false,
                    code: 'ITEMS_NOT_FOUND',
                    error: 'Some menu items not found or inactive',
                    requestId 
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const inactiveItems = menuItems.filter(item => !item.is_active)
        if (inactiveItems.length > 0) {
            console.error(`[${requestId}] Inactive items in cart`)
            return new Response(
                JSON.stringify({ 
                    ok: false,
                    code: 'ITEMS_UNAVAILABLE',
                    error: 'Some menu items are no longer available',
                    requestId 
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 3. Calculate pricing server-side
        const menuItemMap = new Map(menuItems.map(item => [item.id, item]))

        let subtotalCents = 0
        const orderItems = cart.map(cartItem => {
            const menuItem = menuItemMap.get(cartItem.menu_item_id)!
            const itemTotal = menuItem.price_cents * cartItem.quantity
            subtotalCents += itemTotal

            return {
                menu_item_id: menuItem.id,
                name_snapshot: menuItem.name_fr, // Default to French
                price_cents_snapshot: menuItem.price_cents,
                quantity: cartItem.quantity,
                modifiers: cartItem.modifiers || {},
                notes: cartItem.notes || null
            }
        })

        // Calculate tax (from org settings)
        const taxRates = org.settings?.taxes || { gst: 5, qst: 9.975 }
        const totalTaxRate = (taxRates.gst || 0) + (taxRates.qst || 0)
        const taxCents = Math.round(subtotalCents * totalTaxRate / 100)

        // Delivery fee (simplified - could be calculated based on zone)
        const deliveryFeeCents = fulfillment.type === 'delivery' ? 500 : 0

        // Tip will be added at checkout
        const tipCents = 0

        const totalCents = subtotalCents + taxCents + deliveryFeeCents + tipCents

        // 4. UPSERT customer record
        const nameParts = customer.name.trim().split(/\s+/)
        const firstName = nameParts[0] || ''
        const lastName = nameParts.slice(1).join(' ') || ''

        const { data: customerRecord, error: customerError } = await supabaseAdmin
            .from('customers')
            .upsert({
                org_id: org.id,
                email: normalizedEmail,
                first_name: firstName,
                last_name: lastName,
                phone: customer.phone || null,
                marketing_opt_in: customer.marketing_opt_in || false,
                marketing_opt_in_at: customer.marketing_opt_in ? new Date().toISOString() : null,
                source: 'checkout',
                default_address: fulfillment.type === 'delivery' && fulfillment.address ? {
                    street: fulfillment.address.street,
                    city: fulfillment.address.city,
                    region: fulfillment.address.region,
                    postal_code: fulfillment.address.postal_code,
                    country: fulfillment.address.country || 'CA',
                } : null,
            }, {
                onConflict: 'org_id,email',
                ignoreDuplicates: false,
            })
            .select('id')
            .single()

        if (customerError || !customerRecord.id) {
            console.error(`[${requestId}] Customer upsert error:`, customerError)
            return new Response(
                JSON.stringify({ 
                    ok: false,
                    code: 'CUSTOMER_ERROR',
                    error: 'Failed to process customer information',
                    requestId 
                }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 5. Create order record
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .insert({
                org_id: org.id,
                status: 'awaiting_payment',
                fulfillment_type: fulfillment.type,
                customer_id: customerRecord.id,
                customer_email_snapshot: normalizedEmail,
                customer_name: customer.name,
                customer_phone: customer.phone || null,
                customer_email: normalizedEmail,
                delivery_address: fulfillment.type === 'delivery' ? fulfillment.address : null,
                notes: notes || null,
                subtotal_cents: subtotalCents,
                tax_cents: taxCents,
                tip_cents: tipCents,
                delivery_fee_cents: deliveryFeeCents,
                total_cents: totalCents,
                idempotency_key: idempotency_key || null,
            })
            .select()
            .single()

        if (orderError) {
            // Check for idempotency key conflict
            if (orderError.code === '23505' && idempotency_key) {
                console.warn(`[${requestId}] Duplicate order attempt`)
                return new Response(
                    JSON.stringify({ 
                        ok: false,
                        code: 'DUPLICATE_ORDER',
                        error: 'Duplicate order submission detected',
                        requestId 
                    }),
                    { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
            console.error(`[${requestId}] Order creation error:`, orderError)
            return new Response(
                JSON.stringify({ 
                    ok: false,
                    code: 'ORDER_ERROR',
                    error: 'Failed to create order',
                    requestId 
                }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 6. Insert order items
        const orderItemsWithOrderId = orderItems.map(item => ({
            ...item,
            order_id: order.id
        }))

        const { error: orderItemsError } = await supabaseAdmin
            .from('order_items')
            .insert(orderItemsWithOrderId)

        if (orderItemsError) {
            console.error(`[${requestId}] Order items error:`, orderItemsError)
            return new Response(
                JSON.stringify({ 
                    ok: false,
                    code: 'ORDER_ITEMS_ERROR',
                    error: 'Failed to save order items',
                    requestId 
                }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 7. Payment Flow Selection (Session vs Intent)
        // Let's CREATE A PAYMENT INTENT instead of Session.

        // PREPARE CONNECT DATA
        let paymentIntentData: any = {
            metadata: {
                order_id: order.id,
                org_id: org.id,
                public_token: order.public_token, // Add this for easier tracking
            },
            capture_method: 'automatic', // Default
        }

        if (org.stripe_account_id && org.stripe_account_status === 'complete') {
            // Platform Fee: 10%
            const appFee = Math.round(totalCents * 0.10)

            paymentIntentData.application_fee_amount = appFee
            paymentIntentData.transfer_data = {
                destination: org.stripe_account_id,
            }

            console.log(`[${requestId}] Split Payment: Total=${totalCents}, Fee=${appFee}, Dest=${org.stripe_account_id}`)

            // Update order with fee
            await supabaseAdmin
                .from('orders')
                .update({ application_fee_cents: appFee })
                .eq('id', order.id)
        }

        console.log(`[${requestId}] Creating Stripe PaymentIntent...`)

        const paymentIntent = await stripe.paymentIntents.create({
            amount: totalCents,
            currency: org.currency.toLowerCase(),
            automatic_payment_methods: {
                enabled: true,
            },
            metadata: paymentIntentData.metadata,
            ...(paymentIntentData.application_fee_amount ? {
                application_fee_amount: paymentIntentData.application_fee_amount,
                transfer_data: paymentIntentData.transfer_data,
            } : {}),
            description: `Order #${order.order_number} - ${customer.email || 'Guest'}`,
            receipt_email: customer.email || undefined,
        })

        // 8. Update order with Stripe PaymentIntent ID
        await supabaseAdmin
            .from('orders')
            .update({
                stripe_payment_intent_id: paymentIntent.id,
            })
            .eq('id', order.id)

        // Return Client Secret
        console.log(`[${requestId}] Checkout session created successfully`)
        return new Response(
            JSON.stringify({
                ok: true,
                clientSecret: paymentIntent.client_secret,
                public_token: order.public_token,
                order_id: order.id,
                requestId
            }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )

    } catch (error) {
        console.error(`[${requestId}] Unexpected error:`, error)
        return new Response(
            JSON.stringify({ 
                ok: false,
                code: 'SERVER_ERROR',
                error: 'Internal server error',
                requestId,
                details: error.message 
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
