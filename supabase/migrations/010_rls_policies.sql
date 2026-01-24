-- RLS Policies
-- Security model:
-- - Customers: Anonymous, all operations via Edge Functions (service role)
-- - Owners: Authenticated, can only access their org's data
-- - Public menu: Readable by anyone (controlled via Edge Function)

-- =============================================================================
-- ORGANIZATIONS
-- =============================================================================

-- Authenticated users can read their own organization
CREATE POLICY "Users can read own organization" ON organizations
  FOR SELECT
  TO authenticated
  USING (id = get_user_org_id());

-- Only owners can update their organization
CREATE POLICY "Owners can update organization" ON organizations
  FOR UPDATE
  TO authenticated
  USING (id = get_user_org_id() AND user_has_role('owner'));

-- =============================================================================
-- PROFILES
-- =============================================================================

-- Users can read their own profile
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can update their own profile (limited fields)
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Owners can read all profiles in their org
CREATE POLICY "Owners can read org profiles" ON profiles
  FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id());

-- Owners can insert new profiles in their org
CREATE POLICY "Owners can create org profiles" ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_user_org_id() AND user_has_role('owner'));

-- =============================================================================
-- MENU CATEGORIES
-- =============================================================================

-- Public read access for active categories (via service role in Edge Function)
-- Owner portal users can read their org's categories
CREATE POLICY "Read own org categories" ON menu_categories
  FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id());

-- Owners and managers can manage categories
CREATE POLICY "Owners manage categories" ON menu_categories
  FOR ALL
  TO authenticated
  USING (org_id = get_user_org_id() AND (user_has_role('owner') OR user_has_role('manager')))
  WITH CHECK (org_id = get_user_org_id() AND (user_has_role('owner') OR user_has_role('manager')));

-- =============================================================================
-- MENU ITEMS
-- =============================================================================

-- Owner portal users can read their org's items
CREATE POLICY "Read own org menu items" ON menu_items
  FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id());

-- Owners and managers can manage items
CREATE POLICY "Owners manage menu items" ON menu_items
  FOR ALL
  TO authenticated
  USING (org_id = get_user_org_id() AND (user_has_role('owner') OR user_has_role('manager')))
  WITH CHECK (org_id = get_user_org_id() AND (user_has_role('owner') OR user_has_role('manager')));

-- =============================================================================
-- ORDERS & ORDER ITEMS
-- =============================================================================

-- Orders are created via Edge Function (service role only)
-- Owner portal users can read their org's orders
CREATE POLICY "Read own org orders" ON orders
  FOR SELECT
  TO authenticated
  USING (org_id = get_user_org_id());

-- Owner portal users can update order status
CREATE POLICY "Update own org orders" ON orders
  FOR UPDATE
  TO authenticated
  USING (org_id = get_user_org_id())
  WITH CHECK (org_id = get_user_org_id());

-- Order items follow order permissions
CREATE POLICY "Read own org order items" ON order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.org_id = get_user_org_id()
    )
  );

-- =============================================================================
-- PAYMENTS
-- =============================================================================

-- Read-only for owner portal
CREATE POLICY "Read own org payments" ON payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = payments.order_id
      AND orders.org_id = get_user_org_id()
    )
  );

-- Payments are written via Edge Function (service role)

-- =============================================================================
-- DELIVERIES & DELIVERY QUOTES
-- =============================================================================

-- Owner portal can read and manage deliveries
CREATE POLICY "Read own org delivery quotes" ON delivery_quotes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = delivery_quotes.order_id
      AND orders.org_id = get_user_org_id()
    )
  );

CREATE POLICY "Manage own org deliveries" ON deliveries
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = deliveries.order_id
      AND orders.org_id = get_user_org_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = deliveries.order_id
      AND orders.org_id = get_user_org_id()
    )
  );

-- =============================================================================
-- NOTIFICATIONS
-- =============================================================================

-- Users can read their own notifications
CREATE POLICY "Read own notifications" ON notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR (org_id = get_user_org_id() AND user_id IS NULL));

-- Users can update their own notifications (mark as read)
CREATE POLICY "Update own notifications" ON notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Notifications are created via Edge Functions (service role)
