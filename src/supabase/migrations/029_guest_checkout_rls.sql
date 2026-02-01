-- ============================================
-- RLS POLICIES FOR GUEST CHECKOUT
-- ============================================

-- Drop existing restrictive policies that assume auth
DROP POLICY IF EXISTS "Read own org delivery quotes" ON delivery_quotes;
DROP POLICY IF EXISTS "Manage own org deliveries" ON deliveries;

-- ============================================
-- CUSTOMERS TABLE RLS
-- ============================================

-- Sellers can view customers who have orders in their org
CREATE POLICY "Sellers view own org customers" ON customers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.org_id = customers.org_id
    )
  );

-- Authenticated customers can view their own record
CREATE POLICY "Customers view own record" ON customers
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

-- Customers can update their own record
CREATE POLICY "Customers update own record" ON customers
  FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- ============================================
-- ORDERS TABLE RLS (PUBLIC + AUTHENTICATED)
-- ============================================

-- Public users can view orders via public_token (tracking page)
CREATE POLICY "Public view order by token" ON orders
  FOR SELECT
  TO anon
  USING (public_token IS NOT NULL);

-- Authenticated customers can view their own orders
CREATE POLICY "Customers view own orders" ON orders
  FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM customers WHERE auth_user_id = auth.uid()
    )
  );

-- Sellers can view orders in their org
CREATE POLICY "Sellers view own org orders" ON orders
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.org_id = orders.org_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.org_id = orders.org_id
    )
  );

-- ============================================
-- DELIVERIES TABLE RLS
-- ============================================

-- Public users can view deliveries via order public_token
CREATE POLICY "Public view delivery by order token" ON deliveries
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = deliveries.order_id
        AND orders.public_token IS NOT NULL
    )
  );

-- Authenticated customers can view their own deliveries
CREATE POLICY "Customers view own deliveries" ON deliveries
  FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT o.id FROM orders o
      JOIN customers c ON c.id = o.customer_id
      WHERE c.auth_user_id = auth.uid()
    )
  );

-- Sellers can manage deliveries for their org orders
CREATE POLICY "Sellers manage own org deliveries" ON deliveries
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN profiles p ON p.org_id = o.org_id
      WHERE o.id = deliveries.order_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN profiles p ON p.org_id = o.org_id
      WHERE o.id = deliveries.order_id
        AND p.user_id = auth.uid()
    )
  );

-- ============================================
-- DELIVERY QUOTES TABLE RLS
-- ============================================

-- Sellers can view delivery quotes for their org orders
CREATE POLICY "Sellers view own org delivery quotes" ON delivery_quotes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN profiles p ON p.org_id = o.org_id
      WHERE o.id = delivery_quotes.order_id
        AND p.user_id = auth.uid()
    )
  );

-- ============================================
-- ORDER ITEMS TABLE RLS
-- ============================================

-- Public users can view order items via order public_token
CREATE POLICY "Public view order items by token" ON order_items
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.public_token IS NOT NULL
    )
  );

-- Authenticated customers can view their own order items
CREATE POLICY "Customers view own order items" ON order_items
  FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT o.id FROM orders o
      JOIN customers c ON c.id = o.customer_id
      WHERE c.auth_user_id = auth.uid()
    )
  );

-- Sellers can view order items for their org
CREATE POLICY "Sellers view own org order items" ON order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN profiles p ON p.org_id = o.org_id
      WHERE o.id = order_items.order_id
        AND p.user_id = auth.uid()
    )
  );
