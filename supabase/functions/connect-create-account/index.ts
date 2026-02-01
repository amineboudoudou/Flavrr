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

    const { workspace_id, email, business_name, country = 'CA' } = await req.json();

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
      return new Response(JSON.stringify({ error: 'Only workspace owners can create payout accounts' }), { status: 403 });
    }

    // Check if account already exists
    const { data: existingAccount } = await supabase
      .from('seller_payout_accounts')
      .select('*')
      .eq('workspace_id', workspace_id)
      .single();

    if (existingAccount) {
      return new Response(JSON.stringify({
        account_id: existingAccount.stripe_connect_account_id,
        onboarding_status: existingAccount.onboarding_status,
        charges_enabled: existingAccount.charges_enabled,
        payouts_enabled: existingAccount.payouts_enabled,
        already_exists: true
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Create Stripe Connect account
    console.log('Creating Stripe Connect account for workspace:', workspace_id);
    
    const account = await stripe.accounts.create({
      type: 'express',
      country: country,
      email: email || user.email,
      business_type: 'individual',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: {
        workspace_id: workspace_id,
        user_id: user.id,
      },
    });

    console.log('Stripe account created:', account.id);

    // Store in database
    const { data: payoutAccount, error: insertError } = await supabase
      .from('seller_payout_accounts')
      .insert({
        workspace_id: workspace_id,
        stripe_connect_account_id: account.id,
        onboarding_status: 'pending',
        charges_enabled: account.charges_enabled || false,
        payouts_enabled: account.payouts_enabled || false,
        requirements_due: account.requirements?.currently_due || [],
        details_submitted: account.details_submitted || false,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error storing payout account:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to store payout account' }), { status: 500 });
    }

    return new Response(JSON.stringify({
      account_id: account.id,
      onboarding_status: 'pending',
      charges_enabled: account.charges_enabled || false,
      payouts_enabled: account.payouts_enabled || false,
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (error) {
    console.error('Error in connect-create-account:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
});
