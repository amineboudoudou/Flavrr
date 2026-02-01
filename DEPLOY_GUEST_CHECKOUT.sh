#!/bin/bash
set -e

echo "🚀 Deploying Guest Checkout System..."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Deploy edge functions
echo -e "${YELLOW}Step 1: Deploying Edge Functions${NC}"
echo "Deploying create_checkout_session (PUBLIC)..."
supabase functions deploy create_checkout_session --no-verify-jwt

echo "Deploying claim_customer_account..."
supabase functions deploy claim_customer_account

echo ""
echo -e "${GREEN}✅ Edge functions deployed${NC}"
echo ""

# 2. Apply migrations via SQL
echo -e "${YELLOW}Step 2: Apply Database Migrations${NC}"
echo ""
echo "⚠️  MANUAL STEP REQUIRED:"
echo "1. Go to: https://supabase.com/dashboard/project/lcgckjfhlvuxnnjylzvk/sql/new"
echo "2. Copy and paste the contents of these files in order:"
echo "   - src/supabase/migrations/028_guest_checkout_system.sql"
echo "   - src/supabase/migrations/029_guest_checkout_rls.sql"
echo "3. Run each SQL script"
echo ""
echo "Press ENTER when migrations are applied..."
read

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Test guest checkout at your storefront"
echo "2. Complete a test order without logging in"
echo "3. Create an account with the same email"
echo "4. Visit /claim-account to link past orders"
echo ""
echo "See GUEST_CHECKOUT_IMPLEMENTATION.md for full testing guide"
