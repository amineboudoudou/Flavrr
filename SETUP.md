# Café Du Griot Backend Setup Guide

This guide walks you through setting up the complete backend for the Café Du Griot ordering system.

## Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) installed
- Stripe account (test mode for development)
- Uber Direct account (sandbox for development)
- Node.js 18+ (for local development)

## Step 1: Supabase Project Setup

### 1.1 Create a New Supabase Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - Name: `cafe-du-griot` (or your preferred name)
   - Database Password: (save this securely)
   - Region: Choose closest to Montreal (e.g., `us-east-1`)
5. Click "Create new project"

### 1.2 Link Local Project

```bash
cd /path/to/lumière-dining-swipe-menu
supabase login
supabase link --project-ref your-project-ref
```

### 1.3 Run Migrations

Apply all database migrations in order:

```bash
# Run all migrations
supabase db push

# Or apply them individually
for file in supabase/migrations/*.sql; do
  echo "Applying $file..."
  supabase db execute -f "$file"
done
```

### 1.4 Seed Demo Data

```bash
supabase db execute -f supabase/seed.sql
```

### 1.5 Enable Realtime

Realtime is configured in migration `011_realtime_configuration.sql`. Verify it's enabled:

1. Go to Database → Replication in Supabase Dashboard
2. Ensure `orders`, `deliveries`, and `notifications` tables are enabled for realtime

## Step 2: Configure Environment Variables

### 2.1 Get Supabase Credentials

From your Supabase Dashboard → Settings → API:
- `SUPABASE_URL`: Project URL
- `SUPABASE_ANON_KEY`: Anon (public) key
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (keep secret!)

### 2.2 Create .env File

Copy `.env.example` to `.env` and fill in all values:

```bash
cp .env.example .env
```

Edit `.env` with your credentials.

## Step 3: Stripe Configuration

### 3.1 Get Stripe Keys

1. Sign in to [Stripe Dashboard](https://dashboard.stripe.com)
2. Switch to Test Mode (toggle in top right)
3. Go to Developers → API keys
4. Copy:
   - **Publishable key** (for frontend)
   - **Secret key** → `STRIPE_SECRET_KEY`

### 3.2 Configure Webhook

1. Go to Developers → Webhooks
2. Click "Add endpoint"
3. Set endpoint URL:
   ```
   https://your-project-ref.supabase.co/functions/v1/stripe_webhook
   ```
4. Select events to listen for:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
5. Click "Add endpoint"
6. Copy the **Signing secret** → `STRIPE_WEBHOOK_SECRET`

### 3.3 Deploy stripe_webhook Function

```bash
supabase functions deploy stripe_webhook --no-verify-jwt
```

**Note**: We use `--no-verify-jwt` because Stripe webhooks don't include a JWT token.

## Step 4: Deploy Edge Functions

Deploy all Edge Functions:

```bash
# Deploy all functions
supabase functions deploy public_get_menu
supabase functions deploy create_checkout_session
supabase functions deploy get_order_by_token
supabase functions deploy owner_list_orders
supabase functions deploy owner_update_order_status
supabase functions deploy uber_quote
supabase functions deploy uber_create_delivery
supabase functions deploy uber_webhook --no-verify-jwt
```

### Set Function Secrets

```bash
# Set all environment variables for Edge Functions
supabase secrets set \
  STRIPE_SECRET_KEY="sk_test_xxx" \
  STRIPE_WEBHOOK_SECRET="whsec_xxx" \
  UBER_DIRECT_CLIENT_ID="xxx" \
  UBER_DIRECT_CLIENT_SECRET="xxx" \
  UBER_DIRECT_CUSTOMER_ID="xxx" \
  APP_BASE_URL="https://cafedugriot.com" \
  RESEND_API_KEY="re_xxx"
```

## Step 5: Uber Direct Setup

### 5.1 Create Uber Direct Account

1. Sign up at [Uber Direct](https://www.uber.com/us/en/business/delivery/)
2. Complete business verification
3. Switch to **Sandbox mode** for development

### 5.2 Get API Credentials

1. Go to Uber Developer Portal
2. Create an app with `eats.deliveries` scope
3. Copy:
   - `UBER_DIRECT_CLIENT_ID`
   - `UBER_DIRECT_CLIENT_SECRET`
   - `UBER_DIRECT_CUSTOMER_ID`

### 5.3 Configure Webhook (Optional)

If Uber supports webhooks for your account:

1. Set webhook URL:
   ```
   https://your-project-ref.supabase.co/functions/v1/uber_webhook
   ```
2. Save the webhook secret → `UBER_DIRECT_WEBHOOK_SECRET`

## Step 6: Create Owner Portal User

### 6.1 Create Auth User

1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add user"
3. Enter email and password
4. Copy the user ID (UUID)

### 6.2 Create Profile Record

Execute this SQL in Supabase SQL Editor:

```sql
INSERT INTO profiles (user_id, org_id, role, full_name)
VALUES (
  '<user-uuid-from-step-6.1>',
  '00000000-0000-0000-0000-000000000001', -- Café Du Griot org ID from seed
  'owner',
  'Restaurant Owner'
);
```

## Step 7: Test Everything

### 7.1 Test Public Menu API

```bash
curl "https://your-project-ref.supabase.co/functions/v1/public_get_menu?org_slug=cafe-du-griot"
```

Should return menu categories and items.

### 7.2 Test Checkout Flow

Use your frontend or Postman to:

1. Call `create_checkout_session` with a test cart
2. Complete payment in Stripe test mode (use card `4242 4242 4242 4242`)
3. Verify webhook marks order as `paid`

### 7.3 Test Owner Portal

1. Login with owner credentials
2. Call `owner_list_orders` with JWT token
3. Verify you can see the test order

### 7.4 Test Order Status Update

```bash
curl -X POST \
  https://your-project-ref.supabase.co/functions/v1/owner_update_order_status \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"order_id": "<order-uuid>", "new_status": "accepted"}'
```

## Step 8: Frontend Integration

Update your frontend with:

```typescript
// Supabase client
const supabase = createClient(
  'https://your-project-ref.supabase.co',
  'your-anon-key'
)

// Edge Function URLs
const FUNCTIONS_URL = 'https://your-project-ref.supabase.co/functions/v1'
```

## Production Checklist

Before going live:

- [ ] Switch Stripe to live mode with live keys
- [ ] Switch Uber Direct to production mode
- [ ] Update all URLs in `.env` to production domains
- [ ] Configure custom domain for Supabase
- [ ] Set up error monitoring (Sentry, LogDNA)
- [ ] Enable database backups
- [ ] Configure rate limiting on Edge Functions
- [ ] Test full order flow end-to-end
- [ ] Set up SSL certificates
- [ ] Configure CORS properly

## Troubleshooting

### Edge Functions Not Working

Check logs:
```bash
supabase functions logs <function-name> --tail
```

### RLS Policies Blocking Requests

Test with service role temporarily:
```bash
# In Supabase Dashboard → SQL Editor
SET ROLE service_role;
SELECT * FROM orders;
```

### Realtime Not Updating

Verify publication:
```sql
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```

## Next Steps

- Implement email notifications with Resend
- Add Web Push notifications for owner portal
- Set up monitoring and alerting
- Configure backup strategy
- Performance optimization
