import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // PUBLIC ENDPOINT - NO AUTH REQUIRED
        // Service role key used internally for all DB operations
        
        const {
            org_slug,
            cart,
            customer,
            fulfillment,
            notes,
            idempotency_key,
            mode
        }: {
            org_slug: string
            cart: CartItem[]
            customer: CustomerInfo
            fulfillment: FulfillmentInfo
            notes?: string
            idempotency_key?: string
            mode?: string
        } = await req.json()

        // Validate required fields
        if (!org_slug || !cart || cart.length === 0 || !customer || !customer.email || !fulfillment) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields (email is required)' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(customer.email)) {
            return new Response(
                JSON.stringify({ error: 'Invalid email format' }),
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
            .select('id, name, slug, currency, settings, stripe_account_id, stripe_account_status')
            .eq('slug', org_slug)
            .single()

        if (orgError || !org) {
            return new Response(
                JSON.stringify({ error: 'Organization not found' }),
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
            return new Response(
                JSON.stringify({ error: 'Some menu items not found or inactive' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const inactiveItems = menuItems.filter(item => !item.is_active)
        if (inactiveItems.length > 0) {
            return new Response(
                JSON.stringify({ error: 'Some menu items are no longer available' }),
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

        // 4. UPSERT customer record (guest-first via SQL helper)
        const nameParts = customer.name.trim().split(/\s+/)
        const firstName = nameParts[0] || ''
        const lastName = nameParts.slice(1).join(' ') || ''

        const { data: customerId, error: customerError } = await supabaseAdmin
            .rpc('upsert_customer_guest', {
                p_org_id: org.id,
                p_email: normalizedEmail,
                p_first_name: firstName,
                p_last_name: lastName,
                p_phone: customer.phone || null,
                p_marketing_opt_in: customer.marketing_opt_in || false,
                p_default_address: fulfillment.type === 'delivery' && fulfillment.address ? {
                    street: fulfillment.address.street,
                    city: fulfillment.address.city,
                    region: fulfillment.address.region,
                    postal_code: fulfillment.address.postal_code,
                    country: fulfillment.address.country || 'CA',
                } : null,
            })

        if (customerError || !customerId) {
            console.error('Customer upsert error:', customerError)
            throw customerError || new Error('Failed to create customer')
        }

        // 5. Create order record
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .insert({
                org_id: org.id,
                status: 'awaiting_payment',
                fulfillment_type: fulfillment.type,
                customer_id: customerId,
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
                return new Response(
                    JSON.stringify({ error: 'Duplicate order submission detected' }),
                    { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
            throw orderError
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
            throw orderItemsError
        }

        // 7. Create Stripe PaymentIntent
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

            console.log(`💸 Split Payment: Total=${totalCents}, Fee=${appFee}, Dest=${org.stripe_account_id}`)

            // Update order with fee
            await supabaseAdmin
                .from('orders')
                .update({ application_fee_cents: appFee })
                .eq('id', order.id)
        }

        console.log('💳 Creating Stripe PaymentIntent...')

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
        return new Response(
            JSON.stringify({
                clientSecret: paymentIntent.client_secret,
                public_token: order.public_token,
                order_id: order.id,
            }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )



    } catch (error) {
        console.error('Error creating checkout session:', error)
        return new Response(
            JSON.stringify({ error: 'Internal server error', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
