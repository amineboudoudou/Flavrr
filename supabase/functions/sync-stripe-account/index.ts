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
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    console.log('Starting Stripe account sync...');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all seller payout accounts
    const { data: accounts, error: fetchError } = await supabase
      .from('seller_payout_accounts')
      .select('workspace_id, stripe_connect_account_id');

    if (fetchError) {
      throw new Error(`Failed to fetch accounts: ${fetchError.message}`);
    }

    const results = [];

    for (const account of accounts || []) {
      try {
        // Retrieve account from Stripe
        const stripeAccount = await stripe.accounts.retrieve(account.stripe_connect_account_id);

        // Update database
        const { error: updateError } = await supabase
          .from('seller_payout_accounts')
          .update({
            charges_enabled: stripeAccount.charges_enabled || false,
            payouts_enabled: stripeAccount.payouts_enabled || false,
            requirements_due: stripeAccount.requirements?.currently_due || [],
            details_submitted: stripeAccount.details_submitted || false,
            onboarding_status: stripeAccount.details_submitted ? 'complete' : 'pending',
          })
          .eq('workspace_id', account.workspace_id);

        if (updateError) {
          throw new Error(`Failed to update account: ${updateError.message}`);
        }

        results.push({
          workspace_id: account.workspace_id,
          stripe_account_id: account.stripe_connect_account_id,
          charges_enabled: stripeAccount.charges_enabled,
          payouts_enabled: stripeAccount.payouts_enabled,
          details_submitted: stripeAccount.details_submitted,
          requirements_due: stripeAccount.requirements?.currently_due || [],
          status: 'synced',
        });
      } catch (error) {
        console.error(`Error syncing account ${account.stripe_connect_account_id}:`, error);
        results.push({
          workspace_id: account.workspace_id,
          stripe_account_id: account.stripe_connect_account_id,
          status: 'error',
          error: error.message,
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      synced: results.filter(r => r.status === 'synced').length,
      errors: results.filter(r => r.status === 'error').length,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in sync-stripe-account:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
