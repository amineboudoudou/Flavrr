-- Migration 017: Simulation Mode & Audit Trail

-- Add missing columns for simulation/scheduling
ALTER TABLE orders ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status payment_status DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_status delivery_status;

-- Order Events / Audit Trail
CREATE TABLE IF NOT EXISTS order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  previous_status order_status,
  new_status order_status NOT NULL,
  changed_by UUID, -- nullable (system/customer) or user uuid
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events(order_id);

-- RLS for order_events
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;

-- Owner policy: View events for orders belonging to their org
CREATE POLICY "Owners can view events for their org orders" ON order_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_events.order_id
      AND orders.org_id = (SELECT org_id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Owners can insert events for their org orders" ON order_events
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_events.order_id
      AND orders.org_id = (SELECT org_id FROM profiles WHERE user_id = auth.uid())
    )
  );
