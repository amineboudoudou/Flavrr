-- Create custom enums for type safety

-- User roles within an organization
CREATE TYPE user_role AS ENUM ('owner', 'manager', 'kitchen', 'admin');

-- Order lifecycle status
CREATE TYPE order_status AS ENUM (
  'draft',
  'awaiting_payment',
  'paid',
  'accepted',
  'preparing',
  'ready',
  'out_for_delivery',
  'completed',
  'canceled',
  'refunded'
);

-- Fulfillment type
CREATE TYPE fulfillment_type AS ENUM ('pickup', 'delivery');

-- Payment providers
CREATE TYPE payment_provider AS ENUM ('stripe');

-- Payment status
CREATE TYPE payment_status AS ENUM ('pending', 'succeeded', 'failed', 'refunded');

-- Delivery providers
CREATE TYPE delivery_provider AS ENUM ('uber_direct');

-- Delivery status
CREATE TYPE delivery_status AS ENUM (
  'created',
  'courier_assigned',
  'picked_up',
  'dropped_off',
  'canceled',
  'failed'
);

-- Notification types
CREATE TYPE notification_type AS ENUM (
  'order_new',
  'order_paid',
  'order_status',
  'delivery_update'
);
