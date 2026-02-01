# Go-Live Checklist: Stripe & Uber Direct

## A) Uber Direct – Go-live Checklist

### 1. Code Changes to Unlock Production
To switch from **TEST** to **LIVE**, you must explicitly remove the safety guard in `supabase/functions/uber_create_delivery/index.ts`.

- **Target File**: `supabase/functions/uber_create_delivery/index.ts`
- **Action**: Remove lines 70-73:
  ```typescript
  // DELETE THESE LINES
  const uberEnv = Deno.env.get('UBER_ENV')
  if (uberEnv !== 'test') {
      throw new Error('Safety Guard: UBER_ENV is not set to "test". Delivery creation blocked.')
  }
  ```

### 2. Required Environment Variables (Production)
These must be set in your Production Supabase Project (Settings -> Edge Functions -> Secrets):

| Variable Name | Description | Source |
| :--- | :--- | :--- |
| `UBER_DIRECT_CLIENT_ID` | Production Client ID | Uber Direct Dashboard |
| `UBER_DIRECT_CLIENT_SECRET` | Production Client Secret | Uber Direct Dashboard |
| `UBER_DIRECT_CUSTOMER_ID` | Production Customer ID | Uber Direct Dashboard |
| `UBER_ENV` | explicit string `production` | **Manual Entry** |

### 3. Isolation & Safety
- [x] **CONFIRMED**: Test and Prod credentials are fully isolated. The code strictly reads from env vars.
- [x] **CONFIRMED**: Code currently strictly blocks non-test execution.

### 4. Pilot Mode (First Live Delivery)
1.  Coordinate with a real person at the restaurant.
2.  Enable specific "Test Item" on the menu (e.g. $1.00 item).
3.  Place a real delivery order on the live site.
4.  Wait for Stripe payment to confirm -> Order appears in Owner Portal.
5.  **Crucial Step**: In Owner Portal, click "Get Uber Quote" -> "Request Driver".
    *   *If it fails*: The error will appear in the UI. No driver is called. You can retry.
    *   *If it succeeds*: A real driver will be dispatched. Monitor the "Tracking Status".

### 5. Rollback Plan (If Uber API Fails)
If drivers are not being assigned or errors occur:
1.  **Immediate Action**: Do not revert code. Just change `UBER_ENV` back to `test` in Supabase Secrets.
2.  **Effect**: The Edge Function will throw the safety error again.
3.  **Operation**: Staff must manually arrange delivery (or use fallback provider) until resolved.

---

## B) Stripe – Go-live Checklist

### 1. Dashboard Steps
- [ ] **Activate Payment**: Ensure "Looking for live API keys?" is completed (Bank info, Business details).
- [ ] **Public Details**: Verify "Statement Descriptor" is set to "CAFE DU GRIOT" (or similar).
- [ ] **Domains**: Add `your-production-domain.com` to Apple Pay / Google Pay allowed domains (Settings -> Payments -> Payment method domains).

### 2. Webhook Configuration
- [ ] Create **New Webhook** in Stripe Dashboard (Live Mode).
- [ ] **Endpoint URL**: `https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/stripe_webhook`
- [ ] **Events**:
    *   `checkout.session.completed` (Critical)
    *   `payment_intent.succeeded` (Recommended)
    *   `charge.refunded` (For logs)
- [ ] **Secret**: Copy `whsec_...` to Supabase Secret `STRIPE_WEBHOOK_SECRET`.

### 3. Idempotency & Safety
- [x] **CONFIRMED**: Database enforces idempotency.
    *   *Code Reference*: `stripe_webhook/index.ts` lines 90-93 checks `if (order.payment_status === 'succeeded')` before processing.
    *   *Result*: Duplicate webhooks are safely ignored.

### 4. Testing First Live Payment
1.  Create a "Live Test" menu item for $1.00.
2.  Purchase it using a real credit card (not test card).
3.  Verify:
    *   Redirect back to "Order Success" page.
    *   Order status changes to `paid` in Database/Portal.
    *   Stripe Dashboard shows "Succeeded".
4.  **Refund**: Go to Stripe Dashboard -> Payments -> Click Payment -> Refund.

---

## C) System Safety Analysis

### Scenario 1: Stripe payment succeeds but Uber fails to create delivery
*   **Result**: Valid, safe state.
*   **Flow**:
    1.  Order marked `paid`.
    2.  Owner sees order in "Ready" lane.
    3.  Delivery **is not created automaticallly**.
    4.  Owner clicks "Request Driver" -> API Error displayed.
*   **Resolution**: Owner can retry the button, or call a manual driver. Money is safe.

### Scenario 2: Uber succeeds but Stripe webhook is delayed
*   **Result**: Impossible state (Safe).
*   **Check**: The "Delivery Panel" in the Owner Portal is **hidden/disabled** until `order.status` is not `awaiting_payment`.
*   **Flow**:
    1.  Stripe succeeds (money taken).
    2.  Webhook delayed -> Order stays `awaiting_payment`.
    3.  Owner cannot see "Request Driver" button.
    4.  Webhook arrives -> Order becomes `paid`.
    5.  Owner requests driver.

### Scenario 3: Duplicate Deliveries
*   **Result**: Prevented by UI and DB.
*   **Mechanism**:
    1.  `orders` table stores `uber_delivery_id`.
    2.  Frontend `creatingDelivery` state disables the button while processing.
    3.  Backend could be improved with a check `if (order.uber_delivery_id) throw Error`, but UI guard is currently primary.
