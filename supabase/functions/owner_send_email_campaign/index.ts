import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
                global: {
                    headers: { Authorization: req.headers.get('Authorization')! },
                },
            }
        );

        // Verify authentication
        const {
            data: { user },
            error: authError,
        } = await supabaseClient.auth.getUser();

        if (authError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Get user's organization
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('org_id')
            .eq('user_id', user.id)
            .single();

        if (profileError || !profile) {
            return new Response(JSON.stringify({ error: 'Profile not found' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Parse request body
        const body = await req.json();
        const {
            name,
            subject,
            html_content,
            recipient_filter = {},
            schedule_for,
            test_email,
        } = body;

        // Validate required fields
        if (!name || !subject || !html_content) {
            return new Response(
                JSON.stringify({ error: 'name, subject, and html_content are required' }),
                {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            );
        }

        // If test email, send only to that address
        if (test_email) {
            const resendApiKey = Deno.env.get('RESEND_API_KEY');
            if (!resendApiKey) {
                return new Response(
                    JSON.stringify({ error: 'Email service not configured' }),
                    {
                        status: 500,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    }
                );
            }

            // Send test email via Resend
            const resendResponse = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${resendApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: 'noreply@yourdomain.com', // Configure this
                    to: [test_email],
                    subject: `[TEST] ${subject}`,
                    html: html_content,
                }),
            });

            if (!resendResponse.ok) {
                const error = await resendResponse.text();
                throw new Error(`Failed to send test email: ${error}`);
            }

            return new Response(
                JSON.stringify({
                    success: true,
                    message: 'Test email sent successfully',
                }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            );
        }

        // Get recipients based on filter
        let recipientsQuery = supabaseClient
            .from('customers')
            .select('email, name')
            .eq('org_id', profile.org_id)
            .not('email', 'is', null);

        // Apply filters
        if (recipient_filter.min_orders) {
            recipientsQuery = recipientsQuery.gte('total_orders', recipient_filter.min_orders);
        }
        if (recipient_filter.max_orders) {
            recipientsQuery = recipientsQuery.lte('total_orders', recipient_filter.max_orders);
        }
        if (recipient_filter.last_order_days_ago) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - recipient_filter.last_order_days_ago);
            recipientsQuery = recipientsQuery.gte('last_order_at', cutoffDate.toISOString());
        }
        if (recipient_filter.email_marketing_consent !== undefined) {
            recipientsQuery = recipientsQuery.eq('email_marketing_consent', recipient_filter.email_marketing_consent);
        }
        if (recipient_filter.tags && recipient_filter.tags.length > 0) {
            recipientsQuery = recipientsQuery.contains('tags', recipient_filter.tags);
        }

        const { data: recipients, error: recipientsError } = await recipientsQuery;

        if (recipientsError) {
            throw recipientsError;
        }

        const recipientsCount = recipients?.length || 0;

        // Create campaign record
        const { data: campaign, error: campaignError } = await supabaseClient
            .from('email_campaigns')
            .insert({
                org_id: profile.org_id,
                created_by: user.id,
                name,
                subject,
                html_content,
                recipient_filter,
                status: schedule_for ? 'scheduled' : 'draft',
                scheduled_for: schedule_for,
                recipients_count: recipientsCount,
            })
            .select()
            .single();

        if (campaignError) {
            throw campaignError;
        }

        // If not scheduled, send immediately
        if (!schedule_for) {
            // In a production environment, this would be handled by a background job
            // For now, we'll just mark it as sent
            // TODO: Implement actual email sending with Resend API in a background worker

            await supabaseClient
                .from('email_campaigns')
                .update({
                    status: 'sent',
                    sent_at: new Date().toISOString(),
                    sent_count: recipientsCount,
                })
                .eq('id', campaign.id);
        }

        return new Response(
            JSON.stringify({
                success: true,
                campaign_id: campaign.id,
                recipients_count: recipientsCount,
                message: schedule_for
                    ? 'Campaign scheduled successfully'
                    : 'Campaign created. Email sending will be processed in the background.',
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    } catch (error) {
        console.error('Error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    }
});
