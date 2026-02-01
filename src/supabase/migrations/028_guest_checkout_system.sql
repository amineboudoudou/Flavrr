-- ============================================
-- GUEST-FIRST CHECKOUT SYSTEM
-- ============================================
-- This migration enables Shopify-style guest checkout where:
-- 1. Customers can order without creating an account
-- 2. After first order, they can create account and claim past orders
-- 3. All customer identity is managed via customers table
-- 4. Orders link to customers.id, NOT auth.users

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
-- Returns true if customer has no linked auth account
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

-- Helper function: claim customer account (link auth user to existing customer)
CREATE OR REPLACE FUNCTION claim_customer_account(
  p_auth_user_id UUID,
  p_email TEXT
) RETURNS JSONB AS $$
DECLARE
  v_customer_record RECORD;
  v_normalized_email TEXT;
BEGIN
  v_normalized_email := lower(trim(p_email));
  
  -- Find customer by email (must not already be claimed)
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
  
  -- Link auth user to customer
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

-- Add comment for clarity
COMMENT ON COLUMN customers.auth_user_id IS 'Links customer to auth.users after account creation. NULL = guest customer.';
COMMENT ON FUNCTION upsert_customer_guest IS 'Creates or updates guest customer record during checkout (no auth required)';
COMMENT ON FUNCTION claim_customer_account IS 'Links authenticated user to existing guest customer by email';
