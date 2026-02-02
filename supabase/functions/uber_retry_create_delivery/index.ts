import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-service-role-key',
}

function getServiceRoleHeader(req: Request) {
    return req.headers.get('X-Service-Role-Key')
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const authHeader = req.headers.get('Authorization')
        const serviceRoleHeader = getServiceRoleHeader(req)
        const hasServiceRole = !!serviceRoleHeader && serviceRoleHeader === (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

        if (!hasServiceRole && !authHeader) {
            return new Response(JSON.stringify({ error: 'Missing authorization' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const { order_id } = await req.json()
        if (!order_id) {
            return new Response(JSON.stringify({ error: 'Missing order_id' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Validate the caller is allowed (owner/admin) if not service role
        if (!hasServiceRole && authHeader) {
            const supabaseClient = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_ANON_KEY') ?? '',
                { global: { headers: { Authorization: authHeader } } }
            )

            const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
            if (userError || !user) {
                return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                    status: 401,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                })
            }

            const { data: order, error: orderError } = await supabaseAdmin
                .from('orders')
                .select('workspace_id')
                .eq('id', order_id)
                .single()

            if (orderError || !order) {
                return new Response(JSON.stringify({ error: 'Order not found' }), {
                    status: 404,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                })
            }

            const { data: membership, error: membershipError } = await supabaseAdmin
                .from('workspace_memberships')
                .select('role')
                .eq('workspace_id', order.workspace_id)
                .eq('user_id', user.id)
                .single()

            if (membershipError || !membership || !['owner', 'admin'].includes(membership.role)) {
                return new Response(JSON.stringify({ error: 'Forbidden' }), {
                    status: 403,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                })
            }
        }

        // Clear previous error state (best-effort)
        await supabaseAdmin
            .from('deliveries')
            .update({ error_message: null })
            .eq('order_id', order_id)

        // Call the canonical delivery creation function with service role header
        const functionsBase = `${Deno.env.get('SUPABASE_URL')}/functions/v1`
        const res = await fetch(`${functionsBase}/uber_create_delivery`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Service-Role-Key': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            },
            body: JSON.stringify({ order_id }),
        })

        const payload = await res.json().catch(() => ({}))

        if (!res.ok) {
            const msg = payload?.error || res.statusText || 'Delivery retry failed'

            await supabaseAdmin
                .from('deliveries')
                .update({ status: 'failed', error_message: String(msg).slice(0, 240) })
                .eq('order_id', order_id)

            return new Response(JSON.stringify({ success: false, error: msg }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        return new Response(JSON.stringify({ success: true, result: payload }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error: any) {
        console.error('uber_retry_create_delivery error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
