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
    email?: string
}

interface FulfillmentInfo {
    type: 'pickup' | 'delivery'
    address?: {
        street: string
        city: string
        region: string
        postal_code: string
        country?: string
    }
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const {
            org_slug,
            cart,
            customer,
            fulfillment,
            notes
        }: {
            org_slug: string
            cart: CartItem[]
            customer: CustomerInfo
            fulfillment: FulfillmentInfo
            notes?: string
        } = await req.json()

        // Validate required fields
        if (!org_slug || !cart || cart.length === 0 || !customer || !fulfillment) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

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

        // 4. Create order record
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .insert({
                org_id: org.id,
                status: 'awaiting_payment',
                fulfillment_type: fulfillment.type,
                customer_name: customer.name,
                customer_phone: customer.phone || null,
                customer_email: customer.email || null,
                delivery_address: fulfillment.type === 'delivery' ? fulfillment.address : null,
                notes: notes || null,
                subtotal_cents: subtotalCents,
                tax_cents: taxCents,
                tip_cents: tipCents,
                delivery_fee_cents: deliveryFeeCents,
                total_cents: totalCents,
            })
            .select()
            .single()

        if (orderError) {
            throw orderError
        }

        // 5. Insert order items
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

        // 6. Create Stripe Checkout Session
        const baseUrl = Deno.env.get('APP_BASE_URL') ?? 'http://localhost:3000'

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            line_items: menuItems.map(item => {
                const cartItem = cart.find(ci => ci.menu_item_id === item.id)!
                return {
                    price_data: {
                        currency: org.currency.toLowerCase(),
                        unit_amount: item.price_cents,
                        product_data: {
                            name: item.name_fr,
                        },
                    },
                    quantity: cartItem.quantity,
                }
            }).concat([
                // Add tax as line item
                {
                    price_data: {
                        currency: org.currency.toLowerCase(),
                        unit_amount: taxCents,
                        product_data: {
                            name: 'Taxes',
                        },
                    },
                    quantity: 1,
                },
                // Add delivery fee if applicable
                ...(deliveryFeeCents > 0 ? [{
                    price_data: {
                        currency: org.currency.toLowerCase(),
                        unit_amount: deliveryFeeCents,
                        product_data: {
                            name: 'Delivery Fee',
                        },
                    },
                    quantity: 1,
                }] : []),
            ]),
            metadata: {
                order_id: order.id,
                org_id: org.id,
                public_token: order.public_token,
            },
            customer_email: customer.email,
            success_url: `${baseUrl}/order-confirmation?token=${order.public_token}`,
            cancel_url: `${baseUrl}/checkout?canceled=true`,
            payment_intent_data: {
                metadata: {
                    order_id: order.id,
                    org_id: org.id,
                },
            },
        })

        // 7. Update order with Stripe session ID
        await supabaseAdmin
            .from('orders')
            .update({
                stripe_checkout_session_id: session.id,
            })
            .eq('id', order.id)

        // Return checkout URL and order token
        return new Response(
            JSON.stringify({
                checkout_url: session.url,
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
