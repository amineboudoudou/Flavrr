# Manual Migration Application

The Supabase CLI migration history is out of sync. Apply the guest checkout migration manually:

## Steps

1. **Go to Supabase SQL Editor:**
   https://supabase.com/dashboard/project/lcgckjfhlvuxnnjylzvk/sql/new

2. **Copy and paste this SQL:**

```sql
-- ============================================
-- GUEST-FIRST CHECKOUT SYSTEM
-- ============================================

-- Add auth_user_id to customers table (nullable for guests)
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create unique index to prevent one auth account claiming multiple customer records
CREATE UNIQUE INDEX IF NOT EXISTS customers_auth_user_id_unique 
  ON customers(auth_user_id) 
  WHERE auth_user_id IS NOT NULL;

-- Ensure customer_id column exists on orders (should already exist from migration 020)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

-- Add index for fast customer lookups
CREATE INDEX IF NOT EXISTS idx_customers_auth_user_id ON customers(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);

-- Computed column helper: is_guest
CREATE OR REPLACE FUNCTION customer_is_guest(customer_row customers)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN customer_row.auth_user_id IS NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper function: find or create customer (guest-first)
CREATE OR REPLACE FUNCTION upsert_customer_guest(
  p_org_id UUID,
  p_email TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_marketing_opt_in BOOLEAN DEFAULT FALSE,
  p_default_address JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_customer_id UUID;
  v_normalized_email TEXT;
BEGIN
  v_normalized_email := lower(trim(p_email));
  
  INSERT INTO customers (
    org_id,
    email,
    first_name,
    last_name,
    phone,
    marketing_opt_in,
    marketing_opt_in_at,
    default_address,
    source
  ) VALUES (
    p_org_id,
    v_normalized_email,
    p_first_name,
    p_last_name,
    p_phone,
    p_marketing_opt_in,
    CASE WHEN p_marketing_opt_in THEN now() ELSE NULL END,
    p_default_address,
    'checkout'
  )
  ON CONFLICT (org_id, email) 
  DO UPDATE SET
    first_name = COALESCE(EXCLUDED.first_name, customers.first_name),
    last_name = COALESCE(EXCLUDED.last_name, customers.last_name),
    phone = COALESCE(EXCLUDED.phone, customers.phone),
    default_address = COALESCE(EXCLUDED.default_address, customers.default_address),
    marketing_opt_in = CASE 
      WHEN EXCLUDED.marketing_opt_in = true THEN true 
      ELSE customers.marketing_opt_in 
    END,
    marketing_opt_in_at = CASE 
      WHEN EXCLUDED.marketing_opt_in = true AND customers.marketing_opt_in = false 
      THEN now() 
      ELSE customers.marketing_opt_in_at 
    END,
    updated_at = now()
  RETURNING id INTO v_customer_id;
  
  RETURN v_customer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: claim customer account
CREATE OR REPLACE FUNCTION claim_customer_account(
  p_auth_user_id UUID,
  p_email TEXT
) RETURNS JSONB AS $$
DECLARE
  v_customer_record RECORD;
  v_normalized_email TEXT;
BEGIN
  v_normalized_email := lower(trim(p_email));
  
  SELECT * INTO v_customer_record
  FROM customers
  WHERE email = v_normalized_email
    AND auth_user_id IS NULL
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No unclaimed customer found with this email'
    );
  END IF;
  
  UPDATE customers
  SET auth_user_id = p_auth_user_id,
      updated_at = now()
  WHERE id = v_customer_record.id;
  
  RETURN jsonb_build_object(
    'success', true,
    'customer_id', v_customer_record.id,
    'orders_claimed', (SELECT count(*) FROM orders WHERE customer_id = v_customer_record.id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RLS POLICIES FOR GUEST CHECKOUT
-- ============================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Read own org delivery quotes" ON delivery_quotes;
DROP POLICY IF EXISTS "Manage own org deliveries" ON deliveries;

-- Customers table RLS
DROP POLICY IF EXISTS "Sellers view own org customers" ON customers;
CREATE POLICY "Sellers view own org customers" ON customers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.org_id = customers.org_id
    )
  );

DROP POLICY IF EXISTS "Customers view own record" ON customers;
CREATE POLICY "Customers view own record" ON customers
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Customers update own record" ON customers;
CREATE POLICY "Customers update own record" ON customers
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- Orders table RLS (PUBLIC + AUTHENTICATED)
DROP POLICY IF EXISTS "Public view order by token" ON orders;
CREATE POLICY "Public view order by token" ON orders
  FOR SELECT TO anon
  USING (public_token IS NOT NULL);

DROP POLICY IF EXISTS "Customers view own orders" ON orders;
CREATE POLICY "Customers view own orders" ON orders
  FOR SELECT TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM customers WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Sellers view own org orders" ON orders;
CREATE POLICY "Sellers view own org orders" ON orders
  FOR ALL TO authenticated
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

-- Deliveries table RLS
DROP POLICY IF EXISTS "Public view delivery by order token" ON deliveries;
CREATE POLICY "Public view delivery by order token" ON deliveries
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = deliveries.order_id
        AND orders.public_token IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Customers view own deliveries" ON deliveries;
CREATE POLICY "Customers view own deliveries" ON deliveries
  FOR SELECT TO authenticated
  USING (
    order_id IN (
      SELECT o.id FROM orders o
      JOIN customers c ON c.id = o.customer_id
      WHERE c.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Sellers manage own org deliveries" ON deliveries;
CREATE POLICY "Sellers manage own org deliveries" ON deliveries
  FOR ALL TO authenticated
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

-- Delivery quotes table RLS
DROP POLICY IF EXISTS "Sellers view own org delivery quotes" ON delivery_quotes;
CREATE POLICY "Sellers view own org delivery quotes" ON delivery_quotes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN profiles p ON p.org_id = o.org_id
      WHERE o.id = delivery_quotes.order_id
        AND p.user_id = auth.uid()
    )
  );

-- Order items table RLS
DROP POLICY IF EXISTS "Public view order items by token" ON order_items;
CREATE POLICY "Public view order items by token" ON order_items
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.public_token IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Customers view own order items" ON order_items;
CREATE POLICY "Customers view own order items" ON order_items
  FOR SELECT TO authenticated
  USING (
    order_id IN (
      SELECT o.id FROM orders o
      JOIN customers c ON c.id = o.customer_id
      WHERE c.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Sellers view own org order items" ON order_items;
CREATE POLICY "Sellers view own org order items" ON order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN profiles p ON p.org_id = o.org_id
      WHERE o.id = order_items.order_id
        AND p.user_id = auth.uid()
    )
  );
```

3. **Click "Run"**

4. **Verify success** - you should see "Success. No rows returned"

## What This Does

- Adds `auth_user_id` column to `customers` table (nullable for guests)
- Creates SQL helper functions for guest checkout and account claiming
- Updates RLS policies to allow:
  - Public order tracking via token
  - Authenticated customers to view their own orders
  - Sellers to view customers in their org

## Test After Applying

Try placing an order at your storefront without logging in. The 401 error should be resolved.
