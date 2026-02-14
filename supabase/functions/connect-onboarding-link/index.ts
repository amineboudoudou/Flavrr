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
  let allowedOrigin = 'https://flavrr-snowy.vercel.app';
  
  if (origin) {
    if (ALLOWED_ORIGINS.includes(origin)) {
      allowedOrigin = origin;
    }
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

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Verify JWT using Supabase client with ANON key
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

    // Parse optional body
    let bodyData: any = {};
    try {
      const text = await req.text();
      if (text) bodyData = JSON.parse(text);
    } catch (e) {
      // Empty body is fine
    }

    const { refresh_url, return_url } = bodyData;

    // Derive workspace from authenticated user
    console.log('Fetching profile for user:', user.id);
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('org_id, role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile not found:', profileError);
      return new Response(JSON.stringify({ error: 'User profile not found' }), { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!['owner', 'admin'].includes(profile.role)) {
      return new Response(JSON.stringify({ error: 'Only owners and admins can access onboarding' }), { 
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!profile.org_id) {
      return new Response(JSON.stringify({ error: 'User profile missing organization' }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Find workspace for this organization
    console.log('Finding workspace for org:', profile.org_id);
    const { data: workspaces, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, slug, name')
      .eq('org_id', profile.org_id)
      .order('created_at', { ascending: false });

    if (workspaceError || !workspaces || workspaces.length === 0) {
      console.error('No workspace found for org:', profile.org_id, workspaceError);
      return new Response(JSON.stringify({ error: 'No workspace found for your organization' }), { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const workspace = workspaces[0];
    if (workspaces.length > 1) {
      console.warn(`Multiple workspaces found for org ${profile.org_id}, using most recent:`, workspace.id);
    }

    const workspace_id = workspace.id;
    console.log('Using workspace:', workspace_id, workspace.slug);

    const baseUrl = Deno.env.get('APP_URL') || 'http://localhost:5173';
    const defaultRefreshUrl = refresh_url || `${baseUrl}/app/${workspace.slug}/settings/payouts`;
    const defaultReturnUrl = return_url || `${baseUrl}/app/${workspace.slug}/settings/payouts?onboarding=complete`;

    // Get payout account
    const { data: payoutAccount, error: accountError } = await supabase
      .from('seller_payout_accounts')
      .select('*')
      .eq('workspace_id', workspace_id)
      .single();

    if (accountError || !payoutAccount) {
      return new Response(JSON.stringify({ error: 'Payout account not found. Create account first.' }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in connect-onboarding-link:', error);
    const origin = req.headers.get('origin');
    const errorCorsHeaders = getCorsHeaders(origin);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...errorCorsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
