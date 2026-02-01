
// Run with: deno run --allow-net --allow-env scripts/setup_manual_connect.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno'
// Load .env logic omitted for brevity in Deno, assuming env vars set or passed

const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!STRIPE_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing required ENV vars: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    Deno.exit(1);
}

const stripe = new Stripe(STRIPE_KEY, { apiVersion: '2023-10-16', httpClient: Stripe.createFetchHttpClient() });
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log('🚀 Starting Manual Connect Setup...');

    // 1. Get first organization
    const { data: org, error } = await supabase.from('organizations').select('*').limit(1).single();
    if (error) {
        console.error('Error fetching org:', error);
        return;
    }
    console.log(`found Org: ${org.name} (${org.id})`);

    // 2. Create Account
    const account = await stripe.accounts.create({
        type: 'express',
        country: 'CA',
        email: 'test_restaurant@example.com',
        capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
        },
    });
    console.log(`✅ Created Stripe Account: ${account.id}`);

    // 3. Update DB
    await supabase.from('organizations').update({
        stripe_account_id: account.id,
        stripe_account_status: 'pending'
    }).eq('id', org.id);
    console.log('✅ Updated Database');

    // 4. Create Link
    const accountLink = await stripe.accountLinks.create({
        account: account.id,
        refresh_url: 'http://localhost:3000/return',
        return_url: 'http://localhost:3000/return',
        type: 'account_onboarding',
    });

    console.log('\n=============================================');
    console.log('🔗 ONBOARDING LINK (Click to verify in Test Mode):');
    console.log(accountLink.url);
    console.log('=============================================\n');
}

main();
