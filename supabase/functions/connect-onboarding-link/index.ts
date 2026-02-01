import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is authenticated
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { workspace_id, refresh_url, return_url } = await req.json();

    if (!workspace_id) {
      return new Response(JSON.stringify({ error: 'workspace_id is required' }), { status: 400 });
    }

    // Verify user is owner of workspace
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_memberships')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership || membership.role !== 'owner') {
      return new Response(JSON.stringify({ error: 'Only workspace owners can access onboarding' }), { status: 403 });
    }

    // Get workspace slug for URLs
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('slug')
      .eq('id', workspace_id)
      .single();

    const baseUrl = Deno.env.get('APP_URL') || 'http://localhost:5173';
    const defaultRefreshUrl = refresh_url || `${baseUrl}/app/${workspace?.slug}/settings/payouts`;
    const defaultReturnUrl = return_url || `${baseUrl}/app/${workspace?.slug}/settings/payouts?onboarding=complete`;

    // Get payout account
    const { data: payoutAccount, error: accountError } = await supabase
      .from('seller_payout_accounts')
      .select('*')
      .eq('workspace_id', workspace_id)
      .single();

    if (accountError || !payoutAccount) {
      return new Response(JSON.stringify({ error: 'Payout account not found. Create account first.' }), { status: 404 });
    }

    // Create account link
    console.log('Creating onboarding link for account:', payoutAccount.stripe_connect_account_id);
    
    const accountLink = await stripe.accountLinks.create({
      account: payoutAccount.stripe_connect_account_id,
      refresh_url: defaultRefreshUrl,
      return_url: defaultReturnUrl,
      type: 'account_onboarding',
    });

    // Update account status from Stripe
    const account = await stripe.accounts.retrieve(payoutAccount.stripe_connect_account_id);
    
    await supabase
      .from('seller_payout_accounts')
      .update({
        charges_enabled: account.charges_enabled || false,
        payouts_enabled: account.payouts_enabled || false,
        requirements_due: account.requirements?.currently_due || [],
        details_submitted: account.details_submitted || false,
        onboarding_status: account.details_submitted ? 'complete' : 'pending',
      })
      .eq('workspace_id', workspace_id);

    return new Response(JSON.stringify({
      url: accountLink.url,
      expires_at: accountLink.expires_at,
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (error) {
    console.error('Error in connect-onboarding-link:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
});
