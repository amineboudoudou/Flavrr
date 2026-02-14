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

    // Parse optional body (for email, country overrides)
    let bodyData: any = {};
    try {
      const text = await req.text();
      if (text) bodyData = JSON.parse(text);
    } catch (e) {
      // Empty or invalid body is fine
    }

    const { email, country = 'CA' } = bodyData;

    // Derive workspace from authenticated user (multi-tenant safe)
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

    // Verify user has owner/admin role
    if (!['owner', 'admin'].includes(profile.role)) {
      return new Response(JSON.stringify({ error: 'Only owners and admins can manage payout accounts' }), { 
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

    // Use first workspace (most recent if multiple)
    const workspace = workspaces[0];
    if (workspaces.length > 1) {
      console.warn(`Multiple workspaces found for org ${profile.org_id}, using most recent:`, workspace.id);
    }

    const workspace_id = workspace.id;
    console.log('Using workspace:', workspace_id, workspace.slug);

    // Check if account already exists for this workspace
    const { data: existingAccount } = await supabase
      .from('seller_payout_accounts')
      .select('*')
      .eq('workspace_id', workspace_id)
      .single();

    if (existingAccount) {
      console.log('Payout account already exists:', existingAccount.stripe_connect_account_id);
      return new Response(JSON.stringify({
        account_id: existingAccount.stripe_connect_account_id,
        onboarding_status: existingAccount.onboarding_status,
        charges_enabled: existingAccount.charges_enabled,
        payouts_enabled: existingAccount.payouts_enabled,
        already_exists: true,
        workspace_id: workspace_id,
        workspace_slug: workspace.slug
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
      workspace_id: workspace_id,
      workspace_slug: workspace.slug
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
