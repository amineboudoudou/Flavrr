-- Payments table (tracks payment attempts and status)
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  provider payment_provider NOT NULL DEFAULT 'stripe',
  status payment_status NOT NULL DEFAULT 'pending',
  
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'CAD',
  
  -- Provider-specific reference
  provider_ref TEXT, -- e.g., payment_intent_id
  
  -- Store full provider response for debugging
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_provider_ref ON payments(provider_ref);

-- Update trigger
CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
