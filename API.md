# API Documentation

Complete API reference for Café Du Griot backend Edge Functions.

## Base URL

```
https://your-project-ref.supabase.co/functions/v1
```

## Authentication

Most endpoints require JWT authentication via Supabase Auth:

```
Authorization: Bearer <jwt-token>
```

Public endpoints (no auth required):
- `public_get_menu`
- `get_order_by_token`
- `stripe_webhook` (signature verified)
- `uber_webhook` (signature verified)

---

## Customer-Facing APIs

### GET /public_get_menu

Get active menu for an organization.

**Authentication**: None required

**Query Parameters**:
- `org_slug` (required): Organization slug (e.g., `cafe-du-griot`)

**Response**:
```json
{
  "organization": {
    "name": "Café Du Griot",
    "slug": "cafe-du-griot",
    "settings": { ... }
  },
  "menu": [
    {
      "id": "uuid",
      "name_fr": "Entrées",
      "name_en": "Appetizers",
      "sort_order": 1,
      "items": [
        {
          "id": "uuid",
          "name_fr": "Salade de Crevettes Grillées",
          "name_en": "Grilled Shrimp Salad",
          "description_fr": "...",
          "description_en": "...",
          "price_cents": 1495,
          "image_url": "https://...",
          "allergens": ["shellfish"],
          "ingredients": ["shrimp", "lettuce", ...]
        }
      ]
    }
  ]
}
```

**Cache**: 60-120 seconds

---

### POST /create_checkout_session

Create an order and Stripe checkout session.

**Authentication**: None required

**Request Body**:
```json
{
  "org_slug": "cafe-du-griot",
  "cart": [
    {
      "menu_item_id": "uuid",
      "quantity": 2,
      "modifiers": {},
      "notes": "No onions please"
    }
  ],
  "customer": {
    "name": "John Doe",
    "phone": "+15145551234",
    "email": "john@example.com"
  },
  "fulfillment": {
    "type": "delivery",
    "address": {
      "street": "123 Main St",
      "city": "Montreal",
      "region": "QC",
      "postal_code": "H1A 1A1",
      "country": "CA"
    }
  },
  "notes": "Please ring doorbell"
}
```

**Response**:
```json
{
  "checkout_url": "https://checkout.stripe.com/...",
  "public_token": "ABC12345",
  "order_id": "uuid"
}
```

**Error Codes**:
- `400`: Missing required fields or invalid cart
- `404`: Organization not found
- `500`: Internal server error

---

### GET /get_order_by_token

Get order status by public token (for customer tracking).

**Authentication**: None required

**Query Parameters**:
- `token` (required): Public order token

**Response**:
```json
{
  "order": {
    "public_token": "ABC12345",
    "status": "preparing",
    "fulfillment_type": "delivery",
    "customer_name": "John Doe",
    "subtotal_cents": 2990,
    "tax_cents": 448,
    "tip_cents": 450,
    "delivery_fee_cents": 500,
    "total_cents": 4388,
    "created_at": "2026-01-24T16:30:00Z",
    "paid_at": "2026-01-24T16:31:00Z",
    "accepted_at": "2026-01-24T16:32:00Z"
  },
  "items": [
    {
      "name_snapshot": "Griot & Riz Collé",
      "price_cents_snapshot": 1895,
      "quantity": 1,
      "notes": "Extra spicy"
    }
  ],
  "delivery": {
    "status": "picked_up",
    "tracking_url": "https://track.uber.com/...",
    "dropoff_eta": "2026-01-24T17:00:00Z"
  }
}
```

---

## Owner Portal APIs

### GET /owner_list_orders

List orders for authenticated user's organization.

**Authentication**: Required (JWT)

**Query Parameters**:
- `status` (optional): Comma-separated status filters (e.g., `paid,accepted`)
- `date_from` (optional): ISO 8601 date
- `date_to` (optional): ISO 8601 date
- `limit` (optional): Default 50, max 100
- `offset` (optional): Default 0

**Response**:
```json
{
  "orders": [
    {
      "id": "uuid",
      "public_token": "ABC12345",
      "status": "preparing",
      "fulfillment_type": "delivery",
      "customer_name": "John Doe",
      "customer_phone": "+15145551234",
      "customer_email": "john@example.com",
      "total_cents": 4388,
      "created_at": "2026-01-24T16:30:00Z",
      "items": [...]
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0
  }
}
```

---

### POST /owner_update_order_status

Update order status with state machine enforcement.

**Authentication**: Required (JWT)

**Request Body**:
```json
{
  "order_id": "uuid",
  "new_status": "accepted"
}
```

**Valid Status Transitions**:
- `awaiting_payment` → `paid`, `canceled`
- `paid` → `accepted`, `canceled`
- `accepted` → `preparing`
- `preparing` → `ready`
- `ready` → `completed`, `out_for_delivery`
- `out_for_delivery` → `completed`
- Any → `refunded` (admin only)

**Response**:
```json
{
  "success": true,
  "order": { ... }
}
```

**Error Codes**:
- `400`: Invalid status transition
- `403`: Insufficient permissions
- `404`: Order not found

---

## Uber Direct APIs

### POST /uber_quote

Request delivery quote from Uber Direct.

**Authentication**: Required (JWT)

**Request Body**:
```json
{
  "order_id": "uuid"
}
```

**Response**:
```json
{
  "success": true,
  "quote": {
    "id": "uuid",
    "quote_id": "uber-quote-id",
    "fee_cents": 500,
    "eta_minutes": 30,
    "expires_at": "2026-01-24T17:00:00Z"
  }
}
```

**Requirements**:
- Order must be for delivery
- Order must belong to user's organization

---

### POST /uber_create_delivery

Create delivery with Uber Direct from a quote.

**Authentication**: Required (JWT)

**Request Body**:
```json
{
  "order_id": "uuid",
  "quote_id": "uuid"
}
```

**Response**:
```json
{
  "success": true,
  "delivery": {
    "id": "uuid",
    "delivery_id": "uber-delivery-id",
    "status": "created",
    "tracking_url": "https://track.uber.com/...",
    "pickup_eta": "2026-01-24T16:45:00Z",
    "dropoff_eta": "2026-01-24T17:15:00Z"
  }
}
```

**Error Codes**:
- `400`: Quote expired or invalid
- `403`: Unauthorized
- `500`: Uber API error

---

## Webhook Endpoints

### POST /stripe_webhook

Stripe webhook handler.

**Authentication**: Signature verification

**Events Handled**:
- `checkout.session.completed`: Mark order as paid
- `payment_intent.succeeded`: Update payment status
- `payment_intent.payment_failed`: Mark payment as failed
- `charge.refunded`: Mark order as refunded

**Response**:
```json
{
  "received": true
}
```

---

### POST /uber_webhook

Uber Direct webhook handler.

**Authentication**: Signature verification (if available)

**Events Handled**:
- `pickup`: Courier assigned
- `pickup_complete`: Order picked up → `out_for_delivery`
- `delivered`: Order delivered → `completed`
- `canceled`: Delivery canceled

**Response**:
```json
{
  "received": true
}
```

---

## Error Response Format

All endpoints return errors in this format:

```json
{
  "error": "Human-readable error message",
  "details": "Technical details (development only)"
}
```

**Common HTTP Status Codes**:
- `400`: Bad Request (validation error)
- `401`: Unauthorized (missing or invalid JWT)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `500`: Internal Server Error

---

## Example Usage

### Create Order and Complete Checkout

```javascript
// 1. Fetch menu
const menuResponse = await fetch(
  `${FUNCTIONS_URL}/public_get_menu?org_slug=cafe-du-griot`
)
const { menu } = await menuResponse.json()

// 2. Create checkout session
const checkoutResponse = await fetch(
  `${FUNCTIONS_URL}/create_checkout_session`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      org_slug: 'cafe-du-griot',
      cart: [{ menu_item_id: 'uuid', quantity: 2 }],
      customer: { name: 'John', email: 'john@example.com' },
      fulfillment: { type: 'pickup' }
    })
  }
)
const { checkout_url, public_token } = await checkoutResponse.json()

// 3. Redirect to Stripe
window.location.href = checkout_url

// 4. Track order
const orderResponse = await fetch(
  `${FUNCTIONS_URL}/get_order_by_token?token=${public_token}`
)
const { order } = await orderResponse.json()
```

### Owner Portal - List and Update Orders

```javascript
// Get JWT token from Supabase Auth
const { data: { session } } = await supabase.auth.getSession()
const token = session.access_token

// List recent paid orders
const ordersResponse = await fetch(
  `${FUNCTIONS_URL}/owner_list_orders?status=paid&limit=20`,
  {
    headers: { 'Authorization': `Bearer ${token}` }
  }
)
const { orders } = await ordersResponse.json()

// Accept an order
await fetch(`${FUNCTIONS_URL}/owner_update_order_status`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    order_id: orders[0].id,
    new_status: 'accepted'
  })
})
```

### Realtime Subscription (Owner Portal)

```javascript
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Subscribe to new orders
const channel = supabase
  .channel('orders')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'orders',
      filter: `org_id=eq.${orgId}`
    },
    (payload) => {
      console.log('New order!', payload.new)
      // Play sound, show notification, etc.
    }
  )
  .subscribe()
```
