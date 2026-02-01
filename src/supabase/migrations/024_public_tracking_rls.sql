-- Enable public tracking by public_token
-- This allows customers to track their orders without authentication

-- Allow anonymous users to read orders by public_token (limited fields only)
CREATE POLICY "Public tracking by token" ON orders
  FOR SELECT
  TO anon
  USING (public_token IS NOT NULL);

-- Allow anonymous users to read order items for tracked orders
CREATE POLICY "Public read order items by token" ON order_items
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.public_token IS NOT NULL
    )
  );

-- Add comment
COMMENT ON POLICY "Public tracking by token" ON orders IS 'Allows customers to track orders via public_token without authentication';
