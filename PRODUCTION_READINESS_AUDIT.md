# Production Readiness Audit - Restaurant Ordering App

**Date**: January 27, 2026  
**Status**: Comprehensive Gap Analysis & Hardening Plan

---

## Executive Summary

This audit evaluates the current state of the restaurant ordering application against production-ready standards (Shopify-level). The system has solid foundations but requires critical hardening in order lifecycle management, delivery system reliability, and customer data handling.

---

## 1. CURRENT STATE ANALYSIS

### ✅ What Already Exists

#### Database Schema
- ✅ Orders table with proper status enum
- ✅ Order items snapshot pattern
- ✅ Customers table with marketing consent fields
- ✅ Deliveries table structure
- ✅ Reviews, promo codes, email campaigns
- ✅ RLS policies for multi-tenant security
- ✅ Trigger-based customer stats aggregation

#### Edge Functions
- ✅ `create_checkout_session` - Creates PaymentIntent
- ✅ `stripe_webhook` - Handles payment confirmation
- ✅ `owner_update_order_status` - State machine with validation
- ✅ `uber_create_delivery` - Uber Direct TEST integration
- ✅ `uber_get_token` - OAuth token management
- ✅ Customer management endpoints
- ✅ Email campaign functionality

#### Frontend
- ✅ Owner portal with order management
- ✅ StatusStepper component for lifecycle
- ✅ DeliveryStatus display
- ✅ Customer list and details
- ✅ Checkout flow with Stripe

---

## 2. CRITICAL GAPS (P0 - Must Fix)

### 🔴 P0-1: Order Status Mismatch
**Issue**: Database enum uses 'paid' but requirements specify 'incoming'  
**Impact**: Confusion in order lifecycle, UI/backend mismatch  
**Current**: `paid → accepted → preparing → ready → out_for_delivery → completed`  
**Required**: `incoming → preparing → ready → out_for_delivery → completed`

**Fix Required**:
- Rename 'paid' to 'incoming' in enum
- Update all references in Edge Functions
- Update Stripe webhook to set status='incoming'
- Update frontend types

---

### 🔴 P0-2: Non-Idempotent Delivery Creation
**Issue**: `uber_create_delivery` can create duplicate deliveries  
**Impact**: Multiple couriers dispatched for same order, cost overruns  
**Current**: No check for existing delivery_id before creation

**Fix Required**:
```typescript
// Check if delivery already exists
const { data: existingDelivery } = await supabase
  .from('deliveries')
  .select('*')
  .eq('order_id', order_id)
  .single()

if (existingDelivery) {
  return { success: true, delivery: existingDelivery, already_exists: true }
}
```

---

### 🔴 P0-3: Missing Restaurant Address Validation
**Issue**: Restaurant address from screenshot not validated with Google Places  
**Impact**: Uber Direct rejects invalid addresses, delivery fails  
**Current**: Manual text input without lat/lng verification

**Fix Required**:
- Add Google Places Autocomplete to restaurant settings
- Store verified address with lat/lng in `organizations.address_json`
- Validate address before allowing delivery creation
- Block "Mark Ready" if address incomplete

---

### 🔴 P0-4: No Delivery Status Polling/Webhook
**Issue**: Delivery status never updates after creation  
**Impact**: Orders stuck in "ready", never transition to "out_for_delivery" or "completed"  
**Current**: Status saved once, never refreshed

**Fix Required**:
- Implement webhook endpoint: `uber_webhook`
- OR implement polling: Edge Function that checks delivery status every 60s
- Auto-transition: `ready → out_for_delivery` when courier assigned
- Auto-transition: `out_for_delivery → completed` when delivered

---

### 🔴 P0-5: Missing Public Tracking Page
**Issue**: No `/t/:token` route for customer order tracking  
**Impact**: Customers cannot track their orders  
**Current**: Only owner can see order status

**Fix Required**:
- Create `PublicTracking.tsx` page
- Route: `/t/:public_token`
- Display: Order status timeline, ETA, tracking link
- RLS: Allow public read by public_token (limited fields)

---

### 🔴 P0-6: Marketing Consent Not Captured
**Issue**: Checkout doesn't ask for marketing consent  
**Impact**: Cannot legally send marketing emails, GDPR/CASL violation  
**Current**: `customers.email_marketing_consent` always false

**Fix Required**:
- Add checkbox to checkout: "I want to receive offers and updates"
- Default: unchecked
- Save consent to customer record on order creation
- Add `marketing_opt_in_at` timestamp

---

### 🔴 P0-7: No Scheduling Validation
**Issue**: Checkout allows past times, times outside business hours  
**Impact**: Orders scheduled impossibly, customer confusion  
**Current**: `scheduled_for` saved without validation

**Fix Required**:
- Add business hours to `organizations.settings`
- Validate: `scheduled_for >= now() + prep_time`
- Validate: time within business hours
- Display available time slots in checkout

---

## 3. HIGH PRIORITY GAPS (P1 - Should Fix)

### 🟡 P1-1: Payment Flow Not Hardened
**Issue**: Order created before payment confirmed  
**Risk**: Unpaid orders in system  
**Current**: Order created in `create_checkout_session`, status set by webhook

**Improvement**:
- Keep current flow (acceptable for Stripe)
- Add cleanup job: Delete orders stuck in 'awaiting_payment' > 1 hour
- Add explicit logging for payment confirmation

---

### 🟡 P1-2: Missing Order Event Logging
**Issue**: Incomplete audit trail  
**Current**: Some events logged, but not all transitions

**Fix Required**:
- Log ALL status transitions in `order_events`
- Log delivery creation, delivery status changes
- Log payment confirmation with Stripe IDs
- Include user_id, timestamp, metadata

---

### 🟡 P1-3: Delivery Status Enum Mismatch
**Issue**: Database uses different status names than Uber API  
**Current**: `created, courier_assigned, picked_up, dropped_off`  
**Uber API**: `pending, pickup, dropoff, delivered, canceled`

**Fix Required**:
- Update enum to match Uber API exactly
- Add mapping function if needed
- Update UI to display human-readable names

---

### 🟡 P1-4: No Customer Export
**Issue**: Cannot export opted-in customers for email campaigns  
**Current**: List view only

**Fix Required**:
- Add "Export CSV" button to customers page
- Filter: `email_marketing_consent = true`
- Include: name, email, total_orders, total_spent, last_order_at

---

### 🟡 P1-5: Race Condition in Status Updates
**Issue**: Concurrent status updates could cause invalid states  
**Current**: No locking mechanism

**Fix Required**:
- Use optimistic locking: check current status before update
- Return error if status changed since read
- Frontend retries with fresh state

---

## 4. MEDIUM PRIORITY (P2 - Nice to Have)

### 🟢 P2-1: Enhanced Error Messages
- User-friendly error messages for address validation failures
- Specific guidance when delivery creation fails

### 🟢 P2-2: Delivery Cost Estimation
- Show estimated delivery cost before checkout
- Use Uber Direct quote API

### 🟢 P2-3: SMS Notifications
- Send SMS when order ready (if phone provided)
- Requires Twilio integration

---

## 5. IMPLEMENTATION PLAN

### Phase 1: Critical Fixes (P0)
**Estimated Time**: 4-6 hours

1. ✅ Rename 'paid' → 'incoming' (migration + code updates)
2. ✅ Add idempotency to delivery creation
3. ✅ Implement Google Places address validation
4. ✅ Add delivery status polling/webhook
5. ✅ Create public tracking page
6. ✅ Add marketing consent to checkout
7. ✅ Implement scheduling validation

### Phase 2: High Priority (P1)
**Estimated Time**: 2-3 hours

1. ✅ Harden payment flow logging
2. ✅ Complete order event logging
3. ✅ Fix delivery status enum
4. ✅ Add customer CSV export
5. ✅ Add optimistic locking

### Phase 3: Polish (P2)
**Estimated Time**: 1-2 hours

1. Enhanced error messages
2. Delivery cost estimation
3. SMS notifications (optional)

---

## 6. VERIFICATION CHECKLIST

### Order Lifecycle
- [ ] Customer pays → Order status = 'incoming'
- [ ] Owner accepts → Status = 'preparing'
- [ ] Owner marks ready (delivery) → Delivery created, status = 'ready'
- [ ] Courier assigned → Status = 'out_for_delivery'
- [ ] Delivered → Status = 'completed'
- [ ] No duplicate deliveries created
- [ ] All transitions logged in order_events

### Delivery System
- [ ] Restaurant address validated with Google Places
- [ ] Delivery creation is idempotent
- [ ] Delivery status updates automatically
- [ ] ETA displayed and updated
- [ ] Tracking link works for customer

### Customer Management
- [ ] Marketing consent captured at checkout
- [ ] Consent timestamp saved
- [ ] Customer stats update on order completion
- [ ] Can export opted-in customers to CSV

### Scheduling
- [ ] Cannot schedule in the past
- [ ] Cannot schedule outside business hours
- [ ] Respects prep_time minimum
- [ ] Time slots displayed correctly

### Security
- [ ] All state transitions validated server-side
- [ ] RLS prevents cross-org access
- [ ] Public tracking limited to safe fields
- [ ] No secrets exposed in frontend

---

## 7. RISK ASSESSMENT

### High Risk
- **Duplicate Deliveries**: Could cost real money even in TEST mode
- **Invalid Addresses**: Causes delivery failures, poor UX
- **Missing Consent**: Legal liability (GDPR/CASL)

### Medium Risk
- **Status Mismatch**: Confusing UX, support burden
- **No Tracking**: Customer calls asking for status

### Low Risk
- **Missing Logs**: Harder to debug, but not customer-facing
- **Race Conditions**: Rare in practice with low traffic

---

## 8. DEPENDENCIES

### External Services
- ✅ Stripe (TEST mode configured)
- ✅ Uber Direct (TEST credentials set)
- ⚠️ Google Places API (needs key for address validation)
- ⚠️ Resend/SendGrid (for emails, partially configured)

### Environment Variables Required
```bash
# Already Set
UBER_CLIENT_ID
UBER_CLIENT_SECRET
UBER_CUSTOMER_ID
UBER_ENV=test
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET

# Need to Add
GOOGLE_PLACES_API_KEY
RESEND_API_KEY (if using Resend)
```

---

## 9. TESTING STRATEGY

### Unit Tests
- Status transition validation
- Delivery idempotency
- Address validation logic

### Integration Tests
- Full order lifecycle (incoming → completed)
- Delivery creation and status updates
- Payment confirmation flow

### Manual Tests
- Create delivery order with invalid address (should fail gracefully)
- Mark ready twice (should return existing delivery)
- Track order via public link
- Export customer CSV

---

## 10. ROLLOUT PLAN

### Pre-Launch
1. Apply all P0 fixes
2. Test full order lifecycle end-to-end
3. Verify no duplicate deliveries
4. Confirm tracking page works
5. Test marketing consent capture

### Launch Day
1. Monitor Supabase logs for errors
2. Watch for failed deliveries
3. Check order_events for complete audit trail
4. Verify customer consent being captured

### Post-Launch
1. Weekly review of delivery success rate
2. Monthly customer export for email campaigns
3. Monitor for any status transition errors

---

## CONCLUSION

The application has a solid foundation but requires critical hardening in 7 key areas (P0). Once these are addressed, the system will be production-ready for TEST mode operations. The most critical fixes are:

1. **Idempotent delivery creation** (prevents duplicate couriers)
2. **Address validation** (prevents delivery failures)
3. **Status polling/webhooks** (keeps orders moving)
4. **Public tracking** (customer visibility)
5. **Marketing consent** (legal compliance)

Estimated total implementation time: **7-11 hours** for all P0 and P1 fixes.

---

**Next Steps**: Begin Phase 1 implementation with database migrations and Edge Function updates.
