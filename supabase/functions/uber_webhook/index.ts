import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const webhookSecret = Deno.env.get('UBER_WEBHOOK_SECRET') ?? Deno.env.get('UBER_DIRECT_WEBHOOK_SECRET') ?? ''

// HMAC SHA256 verification for Uber webhook signature
async function verifySignature(payload: string, signature: string | null, secret: string): Promise<boolean> {
    if (!signature || !secret) return false
    
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    )
    
    const signatureData = encoder.encode(payload)
    const computed = await crypto.subtle.sign('HMAC', key, signatureData)
    const computedHex = Array.from(new Uint8Array(computed))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
    
    // Timing-safe comparison
    if (computedHex.length !== signature.length) return false
    let result = 0
    for (let i = 0; i < computedHex.length; i++) {
        result |= computedHex.charCodeAt(i) ^ signature.charCodeAt(i)
    }
    return result === 0
}

// Map Uber status to our delivery status
const STATUS_MAPPING: Record<string, string> = {
    'pending': 'delivery_requested',
    'pickup': 'pickup',
    'pickup_complete': 'dropoff',
    'dropoff': 'dropoff',
    'delivered': 'delivered',
    'canceled': 'canceled',
    'returned': 'failed',
}

async function sha256Hex(input: string): Promise<string> {
    const data = new TextEncoder().encode(input)
    const hash = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

serve(async (req) => {
    try {
        console.log('🔔 UBER WEBHOOK RECEIVED', {
            method: req.method,
            url: req.url,
            timestamp: new Date().toISOString(),
        })

        // Get raw body for signature verification
        const rawBody = await req.text()
        
        // Verify webhook signature (HMAC SHA256)
        const signature = req.headers.get('x-uber-signature')
        console.log('📝 Webhook signature:', signature || 'none')
        console.log('🔐 Webhook secret configured:', !!webhookSecret)
        
        if (webhookSecret) {
            const isValid = await verifySignature(rawBody, signature, webhookSecret)
            if (!isValid) {
                console.error('❌ INVALID SIGNATURE - Rejecting webhook')
                return new Response(JSON.stringify({ error: 'Invalid signature' }), { 
                    status: 401,
                    headers: { 'Content-Type': 'application/json' }
                })
            }
            console.log('✅ SIGNATURE VERIFIED')
        } else {
            console.warn('⚠️ No webhook secret configured - skipping signature verification')
        }

        const body = JSON.parse(rawBody)
        console.log('📦 WEBHOOK PAYLOAD:', JSON.stringify(body, null, 2))

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Parse webhook payload
        const deliveryId = body.delivery_id || body.id
        const eventType = body.event_type || body.status
        const status = body.status

        console.log('🔍 PARSED WEBHOOK DATA:', {
            deliveryId,
            eventType,
            status,
        })

        if (!deliveryId) {
            console.error('❌ No delivery_id in webhook payload')
            return new Response(JSON.stringify({ error: 'No delivery_id' }), { status: 400 })
        }

        // IDEMPOTENCY: Insert event first, no-op on replay
        const rawEventId = body.event_id || body.eventId || body.id || null
        const rawTimestamp = body.timestamp || body.created_at || body.createdAt || ''
        const deterministicEventId = rawEventId
            ? `uber_${rawEventId}`
            : `uber_${await sha256Hex(`${deliveryId}|${status}|${rawTimestamp}`)}`

        console.log('📝 Event ID:', deterministicEventId)

        const { error: uberEventInsertError } = await supabaseAdmin
            .from('uber_events')
            .insert({
                event_id: deterministicEventId,
                delivery_id: deliveryId,
                type: eventType,
                payload: body,
                processing_result: 'processing'
            })

        if (uberEventInsertError) {
            if ((uberEventInsertError as any).code === '23505') {
                console.log('⏭️ Uber event already processed:', deterministicEventId)
                return new Response(JSON.stringify({ received: true, already_processed: true }), {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200,
                })
            }
            console.error('❌ Failed to insert uber event:', uberEventInsertError)
            throw uberEventInsertError
        }

        console.log('✅ Event recorded:', deterministicEventId)

        // Fetch delivery from database
        console.log('🔍 Looking up delivery by uber_delivery_id:', deliveryId)
        const { data: delivery, error: deliveryError } = await supabaseAdmin
            .from('deliveries')
            .select('id, order_id, status')
            .eq('uber_delivery_id', deliveryId)
            .single()

        if (deliveryError || !delivery) {
            console.error('❌ Delivery not found:', deliveryId, 'Error:', deliveryError)
            return new Response(JSON.stringify({ error: 'Delivery not found' }), { status: 404 })
        }

        console.log('✅ Delivery found:', {
            delivery_db_id: delivery.id,
            order_id: delivery.order_id,
            current_status: delivery.status,
        })

        // Map Uber status to our status
        const newStatus = STATUS_MAPPING[status] || delivery.status
        console.log('🔄 STATUS MAPPING:', {
            uber_status: status,
            mapped_status: newStatus,
            previous_status: delivery.status,
        })

        // Update delivery record
        const updateData: Record<string, any> = {
            status: newStatus,
        }

        const { error: updateError } = await supabaseAdmin
            .from('deliveries')
            .update(updateData)
            .eq('id', delivery.id)

        if (updateError) {
            console.error('❌ Failed to update delivery:', updateError)
            throw updateError
        }

        console.log('✅ Delivery record updated:', delivery.id)

        // Update order status based on delivery status
        let orderStatus: string | null = null
        if (newStatus === 'pickup' || newStatus === 'dropoff') {
            orderStatus = 'out_for_delivery'
        } else if (newStatus === 'delivered') {
            orderStatus = 'completed'
        }

        console.log('🔄 ORDER STATUS UPDATE:', {
            order_id: delivery.order_id,
            new_order_status: orderStatus,
            reason: newStatus,
        })

        if (orderStatus) {
            const orderUpdateData: Record<string, any> = { 
                status: orderStatus,
                delivery_status: newStatus,
                uber_status: status,
                last_uber_sync_at: new Date().toISOString(),
            }
            if (orderStatus === 'completed') {
                orderUpdateData.delivered_at = new Date().toISOString()
                orderUpdateData.completed_at = new Date().toISOString()
            }

            const { error: orderUpdateError } = await supabaseAdmin
                .from('orders')
                .update(orderUpdateData)
                .eq('id', delivery.order_id)

            if (orderUpdateError) {
                console.error('❌ Failed to update order status:', orderUpdateError)
            } else {
                console.log('✅ Order status updated:', delivery.order_id, '→', orderStatus)
            }
        }

        console.log(`✅ WEBHOOK COMPLETE: Delivery ${deliveryId} updated to status: ${newStatus}`)

        await supabaseAdmin
            .from('uber_events')
            .update({ processing_result: 'success' })
            .eq('event_id', deterministicEventId)

        return new Response(JSON.stringify({ 
            received: true,
            delivery_id: deliveryId,
            status: newStatus,
            order_id: delivery.order_id,
        }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        console.error('❌ Uber webhook error:', error)
        return new Response(
            JSON.stringify({ error: error.message, timestamp: new Date().toISOString() }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
    }
})
