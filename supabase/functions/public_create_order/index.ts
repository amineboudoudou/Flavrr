import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const {
            org_id,
            customer,
            items,
            fulfillment_type,
            scheduled_for,
            delivery_address,
            instructions
        } = await req.json()

        if (!org_id || !items || items.length === 0) {
            throw new Error('Missing required fields')
        }

        // Initialize Supabase client
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Fetch organization settings (for tax/fees)
        const { data: org, error: orgError } = await supabaseAdmin
            .from('organizations')
            .select('settings')
            .eq('id', org_id)
            .single()

        if (orgError || !org) throw new Error('Organization not found')

        // 2. Fetch menu items to verify prices
        const itemIds = items.map((i: any) => i.id)
        const { data: menuItems, error: menuItemsError } = await supabaseAdmin
            .from('menu_items')
            .select('*')
            .in('id', itemIds)

        if (menuItemsError) throw new Error('Failed to fetch menu items')

        // 3. Calculate Totals
        let subtotal = 0
        const snapshotItems = []

        for (const itemRequest of items) {
            const menuItem = menuItems.find((mi: any) => mi.id === itemRequest.id)
            if (menuItem) {
                const quantity = itemRequest.quantity || 1
                subtotal += menuItem.price_cents * quantity

                snapshotItems.push({
                    menu_item_id: menuItem.id,
                    name_snapshot: menuItem.name_fr, // Defaulting to FR for snapshot name, or we could store both JSON
                    price_cents_snapshot: menuItem.price_cents,
                    quantity: quantity
                })
            }
        }

        const taxRate = org.settings?.tax_rate ? org.settings.tax_rate / 100 : 0.14975
        const tax = Math.round(subtotal * taxRate)
        const deliveryFee = fulfillment_type === 'delivery' ? 599 : 0 // 5.99 fixed for V1 simulation
        const total = subtotal + tax + deliveryFee

        // 4. Create Order
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .insert({
                org_id,
                status: 'accepted', // "INCOMING"
                fulfillment_type,
                payment_status: 'pending', // Simulated as pending/unpaid
                customer_name: customer.name,
                customer_email: customer.email,
                customer_phone: customer.phone,
                delivery_address: delivery_address || null,
                notes: instructions,
                scheduled_for: scheduled_for || null,

                subtotal_cents: subtotal,
                tax_cents: tax,
                tip_cents: 0, // No tip for simulation
                delivery_fee_cents: deliveryFee,
                total_cents: total
            })
            .select()
            .single()

        if (orderError) throw orderError

        // 5. Create Order Items
        const orderItemsData = snapshotItems.map(item => ({
            order_id: order.id,
            ...item
        }))

        const { error: itemsInsertError } = await supabaseAdmin
            .from('order_items')
            .insert(orderItemsData)

        if (itemsInsertError) {
            // Rollback order? For now, just log.
            console.error('Failed to create order items:', itemsInsertError)
        }

        // 6. Create Initial Event
        await supabaseAdmin
            .from('order_events')
            .insert({
                order_id: order.id,
                new_status: 'accepted',
                metadata: { source: 'checkout_simulation' }
            })

        return new Response(
            JSON.stringify({
                success: true,
                order: {
                    id: order.id,
                    public_token: order.public_token,
                    total_cents: order.total_cents
                }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Order creation error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
