-- Delivery quotes from Uber Direct or other providers
CREATE TABLE delivery_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  provider delivery_provider NOT NULL DEFAULT 'uber_direct',
  quote_id TEXT NOT NULL, -- Provider's quote ID
  
  fee_cents INTEGER NOT NULL CHECK (fee_cents >= 0),
  eta_minutes INTEGER,
  expires_at TIMESTAMPTZ,
  
  -- Store full provider response
  raw JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Active deliveries
CREATE TABLE deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  provider delivery_provider NOT NULL DEFAULT 'uber_direct',
  delivery_id TEXT NOT NULL, -- Provider's delivery ID
  
  status delivery_status NOT NULL DEFAULT 'created',
  
  pickup_eta TIMESTAMPTZ,
  dropoff_eta TIMESTAMPTZ,
  
  tracking_url TEXT,
  
  -- Store full provider response for debugging
  raw JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_delivery_quotes_order_id ON delivery_quotes(order_id);
CREATE INDEX idx_deliveries_order_id ON deliveries(order_id);
CREATE INDEX idx_deliveries_delivery_id ON deliveries(delivery_id);
CREATE INDEX idx_deliveries_status ON deliveries(status);

-- Update trigger
CREATE TRIGGER update_deliveries_updated_at
BEFORE UPDATE ON deliveries
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
