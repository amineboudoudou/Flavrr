-- Function to generate short public tokens
CREATE OR REPLACE FUNCTION generate_public_token(length INTEGER DEFAULT 8)
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Avoid ambiguous chars
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Orders table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Public tracking token (short, unique, customer-facing)
  public_token TEXT NOT NULL UNIQUE DEFAULT generate_public_token(),
  
  status order_status NOT NULL DEFAULT 'draft',
  fulfillment_type fulfillment_type NOT NULL,
  
  -- Customer info (no auth required)
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  
  -- Delivery address (nullable for pickup orders)
  delivery_address JSONB,
  
  -- Order notes
  notes TEXT,
  
  -- Pricing breakdown (all in cents)
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  tax_cents INTEGER NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
  tip_cents INTEGER NOT NULL DEFAULT 0 CHECK (tip_cents >= 0),
  delivery_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  
  -- Stripe references
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  
  -- Lifecycle timestamps
  paid_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Order items (snapshot pattern - preserve item details even if menu changes)
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  
  -- Snapshot fields (preserve at order time)
  name_snapshot TEXT NOT NULL,
  price_cents_snapshot INTEGER NOT NULL CHECK (price_cents_snapshot >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  
  -- Optional modifiers and notes
  modifiers JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_orders_org_id_created_at ON orders(org_id, created_at DESC);
CREATE INDEX idx_orders_public_token ON orders(public_token);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_stripe_session ON orders(stripe_checkout_session_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- Update trigger
CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
