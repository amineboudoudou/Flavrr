# Guest Checkout Implementation Guide

## Overview
This implements Shopify-style guest checkout where customers can order without creating an account, then optionally claim past orders after signup.

---

## 1. Database Migrations

### Run in order:

```bash
# Apply migrations
supabase db push

# Or manually:
psql $DATABASE_URL -f src/supabase/migrations/028_guest_checkout_system.sql
psql $DATABASE_URL -f src/supabase/migrations/029_guest_checkout_rls.sql
```

**What changed:**
- `customers` table now has `auth_user_id` (nullable for guests)
- `orders.customer_id` links to `customers.id` (not auth.users)
- New SQL helpers: `upsert_customer_guest()`, `claim_customer_account()`
- RLS policies allow public order tracking + authenticated customer access

---

## 2. Edge Functions Deployment

### Deploy new/updated functions:

```bash
# Updated: now PUBLIC (no auth required)
supabase functions deploy create_checkout_session --no-verify-jwt

# New: account claim endpoint
supabase functions deploy claim_customer_account

# Existing functions (no changes needed)
supabase functions deploy stripe_webhook --no-verify-jwt
supabase functions deploy get_order_by_token --no-verify-jwt
```

**Critical changes:**
- `create_checkout_session` is now PUBLIC (removed auth guard)
- Uses service role key internally for all DB operations
- Validates email format before processing
- Uses `upsert_customer_guest()` SQL helper

---

## 3. Frontend Integration

### A) Update checkout flow

**File: `src/pages/checkout.tsx` (or wherever checkout lives)**

Remove any auth requirements. Checkout should work for anonymous users.

```tsx
// OLD (remove this):
const { session } = useAuth();
if (!session) navigate('/login');

// NEW (no auth check):
// Just collect email, name, phone
```

### B) Post-payment success page

**File: `src/pages/order-confirmation.tsx` or similar**

Add CTA after successful payment:

```tsx
import { useAuth } from '../contexts/AuthContext';

export default function OrderConfirmation() {
  const { session } = useAuth();
  const [orderToken] = useState(/* from URL or state */);

  return (
    <div>
      <h1>Order confirmed!</h1>
      <p>Track your order: <a href={`/t/${orderToken}`}>Click here</a></p>

      {!session && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
          <h3 className="font-semibold mb-2">Create an account?</h3>
          <p className="text-sm text-gray-700 mb-3">
            Track your orders faster next time and get exclusive offers.
          </p>
          <a 
            href="/signup?claim=true" 
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded"
          >
            Create account
          </a>
        </div>
      )}
    </div>
  );
}
```

### C) Signup flow with auto-claim

**File: `src/pages/signup.tsx`**

After successful signup, redirect to `/claim-account`:

```tsx
const handleSignup = async (email: string, password: string) => {
  const { error } = await supabase.auth.signUp({ email, password });
  
  if (!error) {
    // Redirect to claim page
    navigate('/claim-account');
  }
};
```

### D) Add route for claim page

**File: `src/App.tsx` or router config**

```tsx
<Route path="/claim-account" element={<ClaimAccountPage />} />
```

---

## 4. Seller Dashboard Updates

### Customer list view

**File: `src/pages/owner/Customers.tsx`**

Add "Guest" badge for customers without `auth_user_id`:

```tsx
{customers.map(customer => (
  <tr key={customer.id}>
    <td>{customer.email}</td>
    <td>
      {!customer.auth_user_id && (
        <span className="text-xs bg-gray-200 px-2 py-1 rounded">Guest</span>
      )}
    </td>
  </tr>
))}
```

---

## 5. Security Checklist

### ✅ Verify these are in place:

1. **Public tracking works**
   - Visit `/t/{any_public_token}` without login
   - Should see order status

2. **Guest checkout works**
   - Place order without account
   - Payment succeeds
   - Order appears in seller dashboard

3. **Account claim works**
   - Create account with same email as guest order
   - Visit `/claim-account`
   - Past orders now visible in authenticated view

4. **No data leaks**
   - User A cannot see User B's orders
   - Seller A cannot see Seller B's customers
   - Test with different auth tokens

5. **Service role key is server-side only**
   - Search frontend bundle for `service_role`
   - Should return ZERO results

---

## 6. Testing Flow

### End-to-end test:

```bash
# 1. Guest checkout
curl -X POST https://xxx.supabase.co/functions/v1/create_checkout_session \
  -H "Content-Type: application/json" \
  -d '{
    "org_slug": "test-restaurant",
    "cart": [{"menu_item_id": "...", "quantity": 1}],
    "customer": {"name": "Test User", "email": "test@example.com"},
    "fulfillment": {"type": "pickup"}
  }'

# 2. Complete Stripe TEST payment
# (use Stripe test card 4242 4242 4242 4242)

# 3. Create account
# Signup with test@example.com

# 4. Claim orders
curl -X POST https://xxx.supabase.co/functions/v1/claim_customer_account \
  -H "Authorization: Bearer {user_jwt}" \
  -H "Content-Type: application/json"

# Expected: orders_claimed > 0
```

---

## 7. Rollback Plan

If issues arise:

```sql
-- Revert RLS policies
DROP POLICY IF EXISTS "Public view order by token" ON orders;
DROP POLICY IF EXISTS "Customers view own orders" ON orders;

-- Restore old auth-based policies
-- (copy from backup or previous migration)

-- Remove auth_user_id column (optional, keeps data)
ALTER TABLE customers DROP COLUMN IF EXISTS auth_user_id;
```

---

## 8. Final Verification

**Can a guest:**
- ✅ Browse menu without login
- ✅ Add items to cart
- ✅ Complete checkout with just email
- ✅ Pay with Stripe TEST
- ✅ Track order via `/t/{token}` link
- ✅ Create account later
- ✅ Claim past orders
- ✅ See all orders in authenticated view

**Can a seller:**
- ✅ See all customers (guest + registered)
- ✅ Distinguish guest vs registered
- ✅ View order history per customer
- ✅ NOT see other restaurants' data

**Security:**
- ✅ Service role key never exposed to client
- ✅ RLS prevents cross-org data access
- ✅ Email verification required before claim
- ✅ No auth bypass via email guessing

---

## Notes

- Stripe remains in TEST mode (`sk_test_...`)
- Uber Direct remains in TEST mode (`UBER_ENV=test`)
- All checkout endpoints are public (no JWT required)
- Customer identity managed via `customers` table, not `auth.users`
- Orders link to `customers.id`, enabling guest + registered flow
