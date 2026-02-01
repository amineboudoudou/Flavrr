# Uber Direct TEST Integration - Complete Guide

## Overview
This document provides complete setup, testing, and verification instructions for the Uber Direct TEST integration.

## 🔧 Setup Instructions

### 1. Apply Database Migration

First, apply the database migration to create the deliveries table and update the orders table:

```bash
# Navigate to your project directory
cd /Users/amineboudoudou/Desktop/lumière-dining-swipe-menu

# Apply migration using Supabase CLI or MCP
# Option A: Using apply-migration.mjs script
node apply-migration.mjs 021_uber_direct_deliveries

# Option B: Using Supabase MCP (if connected)
# Call mcp2_apply_migration with:
# - project_id: your_project_id
# - name: uber_direct_deliveries
# - query: <contents of 021_uber_direct_deliveries.sql>
```

### 2. Set Supabase Edge Function Secrets

You need to configure the following secrets in your Supabase project:

```bash
# Using Supabase CLI
supabase secrets set UBER_CLIENT_ID="your_test_client_id"
supabase secrets set UBER_CLIENT_SECRET="your_test_client_secret"
supabase secrets set UBER_CUSTOMER_ID="your_test_customer_id"
supabase secrets set UBER_ENV="test"

# Or via Supabase Dashboard:
# 1. Go to Project Settings > Edge Functions
# 2. Add each secret with the values from your Uber Direct TEST dashboard
```

**IMPORTANT**: 
- Use only TEST credentials from Uber Direct
- Set `UBER_ENV=test` to ensure safety guard is active
- Never use production credentials

### 3. Deploy Edge Functions

Deploy the new and updated Edge Functions:

```bash
# Deploy uber_get_token (new)
supabase functions deploy uber_get_token

# Deploy updated uber_create_delivery
supabase functions deploy uber_create_delivery

# Verify deployment
supabase functions list
```

### 4. Verify Restaurant Address

Ensure your restaurant organization has a complete address with lat/lng:

```sql
-- Check current address
SELECT id, name, street, city, region, postal_code, country, address_json
FROM organizations
WHERE id = 'your_org_id';

-- Update if needed (example)
UPDATE organizations
SET 
  street = '123 Main St',
  city = 'Montreal',
  region = 'QC',
  postal_code = 'H1A 1A1',
  country = 'CA',
  phone = '+15141234567',
  address_json = jsonb_build_object(
    'lat', 45.5017,
    'lng', -73.5673,
    'place_id', 'ChIJDbdkHFQayUwR7-8fITgxTmU'
  )
WHERE id = 'your_org_id';
```

## 🧪 Testing Instructions

### Test 1: Get Uber Access Token

Test the OAuth token endpoint:

```bash
# Get your Supabase URL and anon key
SUPABASE_URL="https://your-project.supabase.co"
ANON_KEY="your_anon_key"

# Get your auth token (login as owner first)
AUTH_TOKEN="your_jwt_token"

# Test uber_get_token
curl -X POST "${SUPABASE_URL}/functions/v1/uber_get_token" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json"

# Expected Response:
# {
#   "success": true,
#   "access_token": "eyJ...",
#   "cached": false
# }
```

### Test 2: Create Test Delivery Order

Create a test order with delivery:

```bash
# 1. Create a delivery order via the storefront
# 2. Note the order_id
# 3. Accept the order and move it to "preparing" status
# 4. Click "Mark Ready & Request Delivery" in the Owner Portal

# Or test via API directly:
ORDER_ID="your_order_id"

curl -X POST "${SUPABASE_URL}/functions/v1/uber_create_delivery" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"order_id\": \"${ORDER_ID}\"}"

# Expected Response:
# {
#   "success": true,
#   "delivery_id": "uuid-of-delivery-record",
#   "external_id": "uber-delivery-id",
#   "status": "created",
#   "eta_minutes": 30,
#   "tracking_url": "https://m.uber.com/..."
# }
```

### Test 3: Verify Database Records

Check that the delivery was properly saved:

```sql
-- Check deliveries table
SELECT 
  d.id,
  d.order_id,
  d.provider,
  d.external_id,
  d.status,
  d.eta_minutes,
  d.tracking_url,
  d.created_at,
  o.order_number,
  o.status as order_status
FROM deliveries d
JOIN orders o ON o.id = d.order_id
ORDER BY d.created_at DESC
LIMIT 5;

-- Check order was linked
SELECT 
  id,
  order_number,
  status,
  delivery_id,
  uber_delivery_id,
  uber_tracking_url,
  uber_status,
  last_uber_sync_at
FROM orders
WHERE delivery_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
```

### Test 4: Frontend UI Verification

1. **Owner Portal - Order Details Page**:
   - Navigate to an order with delivery
   - Move order to "preparing" status
   - Click "Mark Ready & Request Delivery"
   - Verify:
     - ✅ Button shows loading state
     - ✅ Order status updates to "ready"
     - ✅ Delivery Status panel appears in sidebar
     - ✅ Shows delivery ID, status, and tracking link
     - ✅ "Open Tracking" button is clickable

2. **Error Handling**:
   - Try creating delivery with incomplete restaurant address
   - Verify error message displays clearly
   - Verify order still marks as "ready" even if delivery fails

3. **Delivery Status Display**:
   - Check that tracking URL opens in new tab
   - Verify delivery status badge shows correct status
   - Check last sync timestamp displays

## ✅ Success Checklist

### Database
- [ ] Migration 021 applied successfully
- [ ] `deliveries` table exists with all required columns
- [ ] `orders.delivery_id` foreign key exists
- [ ] RLS policies allow owners to read their deliveries

### Edge Functions
- [ ] `uber_get_token` deployed and returns access token
- [ ] `uber_create_delivery` deployed and creates deliveries
- [ ] Secrets configured: `UBER_CLIENT_ID`, `UBER_CLIENT_SECRET`, `UBER_CUSTOMER_ID`, `UBER_ENV`
- [ ] `UBER_ENV=test` safety guard active

### Frontend
- [ ] "Mark Ready" button shows "Mark Ready & Request Delivery" for delivery orders
- [ ] Clicking button calls `uber_create_delivery` Edge Function
- [ ] Order status updates to "ready"
- [ ] Delivery record created in database
- [ ] DeliveryStatus component displays in sidebar
- [ ] Tracking URL button works
- [ ] Error messages display if delivery creation fails

### Supabase Logs
- [ ] Check Edge Function logs for successful execution
- [ ] No errors in `uber_get_token` logs
- [ ] No errors in `uber_create_delivery` logs
- [ ] Uber API responses logged correctly

## 🔍 Debugging

### Check Edge Function Logs

```bash
# View logs for uber_get_token
supabase functions logs uber_get_token --tail

# View logs for uber_create_delivery
supabase functions logs uber_create_delivery --tail
```

### Common Issues

**Issue**: "Missing Uber credentials"
- **Solution**: Verify secrets are set correctly in Supabase project settings

**Issue**: "Restaurant address incomplete"
- **Solution**: Update organization record with complete address (street, city, region, postal_code, country, phone)

**Issue**: "Uber Token Failed: 401"
- **Solution**: Check that `UBER_CLIENT_ID` and `UBER_CLIENT_SECRET` are correct TEST credentials

**Issue**: "Failed to create Uber delivery: 400"
- **Solution**: Check Uber API response in logs. Common causes:
  - Invalid address format
  - Missing required fields
  - Test mode restrictions

**Issue**: Delivery created but not showing in UI
- **Solution**: 
  - Check browser console for errors
  - Verify `handleDeliveryCreated` callback is firing
  - Refresh the order details page

## 📊 Monitoring

### Key Metrics to Track

1. **Delivery Success Rate**:
```sql
SELECT 
  COUNT(*) as total_deliveries,
  COUNT(*) FILTER (WHERE status != 'failed') as successful,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status != 'failed') / COUNT(*), 2) as success_rate
FROM deliveries
WHERE created_at > NOW() - INTERVAL '7 days';
```

2. **Average ETA**:
```sql
SELECT 
  AVG(eta_minutes) as avg_eta,
  MIN(eta_minutes) as min_eta,
  MAX(eta_minutes) as max_eta
FROM deliveries
WHERE eta_minutes IS NOT NULL
  AND created_at > NOW() - INTERVAL '7 days';
```

3. **Failed Deliveries**:
```sql
SELECT 
  d.id,
  d.external_id,
  d.status,
  d.raw_response->>'message' as error_message,
  o.order_number,
  d.created_at
FROM deliveries d
JOIN orders o ON o.id = d.order_id
WHERE d.status = 'failed'
ORDER BY d.created_at DESC;
```

## 🚀 Going Live (Production)

**DO NOT** use these test credentials in production. When ready to go live:

1. Get production credentials from Uber Direct
2. Update secrets to production values
3. Change `UBER_ENV` from `test` to `production`
4. Update `delivery_provider` enum to use `uber_direct` instead of `uber_direct_test`
5. Test thoroughly in staging environment first
6. Monitor closely after launch

## 📧 Email Notifications (Future Enhancement)

The current implementation includes a stub for email notifications. To implement:

1. Add email provider (e.g., SendGrid, Resend)
2. Create email template with tracking link
3. Send email in `uber_create_delivery` after successful creation:

```typescript
// Example email sending code
if (order.customer_email) {
  await sendEmail({
    to: order.customer_email,
    subject: `Your order #${order.order_number} is ready for delivery!`,
    html: `
      <p>Your order is ready and a courier has been dispatched.</p>
      <p>Track your delivery: <a href="${deliveryData.tracking_url}">Click here</a></p>
    `
  });
}
```

## 📝 Notes

- All deliveries are created in TEST mode (no charges)
- Uber Direct test environment may use simulated couriers
- Tracking URLs work in test mode but show test data
- Keep `UBER_ENV=test` until ready for production
- Monitor Supabase Edge Function logs regularly
- RLS policies ensure owners can only see their own deliveries

## 🆘 Support

If you encounter issues:

1. Check Supabase Edge Function logs
2. Verify all secrets are set correctly
3. Ensure restaurant address is complete
4. Check browser console for frontend errors
5. Review database records for delivery creation
6. Consult Uber Direct API documentation: https://developer.uber.com/docs/deliveries

---

**Last Updated**: January 2026
**Integration Version**: 1.0.0
**Status**: TEST MODE ONLY
