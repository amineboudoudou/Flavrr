import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

// CORS helper: Allow production + Vercel preview domains
const ALLOWED_ORIGINS = [
  'https://flavrr-snowy.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  let allowedOrigin = 'https://flavrr-snowy.vercel.app'; // default to prod
  
  if (origin) {
    // Allow exact matches from allowlist
    if (ALLOWED_ORIGINS.includes(origin)) {
      allowedOrigin = origin;
    }
    // Allow any Vercel preview domain
    else if (origin.endsWith('.vercel.app')) {
      allowedOrigin = origin;
    }
  }
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
  };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle OPTIONS preflight - return 200 immediately with CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    // Manual JWT verification (since verify_jwt=false at gateway)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify JWT using Supabase client with ANON key (secure verification)
    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth verification failed:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Use service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { workspace_id, email, business_name, country = 'CA' } = await req.json();

    if (!workspace_id) {
      return new Response(JSON.stringify({ error: 'workspace_id is required' }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify user is owner of workspace
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_memberships')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership || membership.role !== 'owner') {
      return new Response(JSON.stringify({ error: 'Only workspace owners can create payout accounts' }), { 
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
      return new Response(JSON.stringify({ error: 'Failed to store payout account' }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      account_id: account.id,
      onboarding_status: 'pending',
      charges_enabled: account.charges_enabled || false,
      payouts_enabled: account.payouts_enabled || false,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in connect-create-account:', error);
    const origin = req.headers.get('origin');
    const errorCorsHeaders = getCorsHeaders(origin);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...errorCorsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
