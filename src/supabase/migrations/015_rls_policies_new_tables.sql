-- ============================================
-- RLS POLICIES FOR NEW TABLES
-- ============================================

-- Enable RLS on all new tables
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_code_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;

-- ============================================
-- REVIEWS POLICIES
-- ============================================

-- Owners can view all reviews for their organization
CREATE POLICY "Owners can view org reviews"
ON reviews FOR SELECT
TO authenticated
USING (
  org_id IN (
    SELECT org_id FROM profiles WHERE user_id = auth.uid()
  )
);

-- Owners can insert reviews (for manual entry)
CREATE POLICY "Owners can insert reviews"
ON reviews FOR INSERT
TO authenticated
WITH CHECK (
  org_id IN (
    SELECT org_id FROM profiles WHERE user_id = auth.uid()
  )
);

-- Owners can update reviews (for moderation)
CREATE POLICY "Owners can update org reviews"
ON reviews FOR UPDATE
TO authenticated
USING (
  org_id IN (
    SELECT org_id FROM profiles WHERE user_id = auth.uid()
  )
);

-- Public can view approved reviews
CREATE POLICY "Public can view approved reviews"
ON reviews FOR SELECT
TO anon
USING (status = 'approved');

-- ============================================
-- CUSTOMERS POLICIES
-- ============================================

-- Owners can view all customers for their organization
CREATE POLICY "Owners can view org customers"
ON customers FOR SELECT
TO authenticated
USING (
  org_id IN (
    SELECT org_id FROM profiles WHERE user_id = auth.uid()
  )
);

-- Owners can update customer records
CREATE POLICY "Owners can update org customers"
ON customers FOR UPDATE
TO authenticated
USING (
  org_id IN (
    SELECT org_id FROM profiles WHERE user_id = auth.uid()
  )
);

-- System can insert customers (via trigger)
CREATE POLICY "System can insert customers"
ON customers FOR INSERT
TO authenticated
WITH CHECK (true);

-- ============================================
-- CUSTOMER ADDRESSES POLICIES
-- ============================================

-- Owners can view customer addresses
CREATE POLICY "Owners can view customer addresses"
ON customer_addresses FOR SELECT
TO authenticated
USING (
  customer_id IN (
    SELECT id FROM customers WHERE org_id IN (
      SELECT org_id FROM profiles WHERE user_id = auth.uid()
    )
  )
);

-- System can insert addresses (via trigger)
CREATE POLICY "System can insert addresses"
ON customer_addresses FOR INSERT
TO authenticated
WITH CHECK (true);

-- System can update addresses
CREATE POLICY "System can update addresses"
ON customer_addresses FOR UPDATE
TO authenticated
USING (true);

-- ============================================
-- EMAIL CAMPAIGNS POLICIES
-- ============================================

-- Owners can view all campaigns for their organization
CREATE POLICY "Owners can view org campaigns"
ON email_campaigns FOR SELECT
TO authenticated
USING (
  org_id IN (
    SELECT org_id FROM profiles WHERE user_id = auth.uid()
  )
);

-- Owners can create campaigns
CREATE POLICY "Owners can create campaigns"
ON email_campaigns FOR INSERT
TO authenticated
WITH CHECK (
  org_id IN (
    SELECT org_id FROM profiles WHERE user_id = auth.uid()
  )
  AND created_by = auth.uid()
);

-- Owners can update their org's campaigns
CREATE POLICY "Owners can update org campaigns"
ON email_campaigns FOR UPDATE
TO authenticated
USING (
  org_id IN (
    SELECT org_id FROM profiles WHERE user_id = auth.uid()
  )
);

-- Owners can delete their org's campaigns
CREATE POLICY "Owners can delete org campaigns"
ON email_campaigns FOR DELETE
TO authenticated
USING (
  org_id IN (
    SELECT org_id FROM profiles WHERE user_id = auth.uid()
  )
);

-- ============================================
-- PROMO CODES POLICIES
-- ============================================

-- Owners can view all promo codes for their organization
CREATE POLICY "Owners can view org promos"
ON promo_codes FOR SELECT
TO authenticated
USING (
  org_id IN (
    SELECT org_id FROM profiles WHERE user_id = auth.uid()
  )
);

-- Owners can create promo codes
CREATE POLICY "Owners can create promos"
ON promo_codes FOR INSERT
TO authenticated
WITH CHECK (
  org_id IN (
    SELECT org_id FROM profiles WHERE user_id = auth.uid()
  )
  AND created_by = auth.uid()
);

-- Owners can update their org's promo codes
CREATE POLICY "Owners can update org promos"
ON promo_codes FOR UPDATE
TO authenticated
USING (
  org_id IN (
    SELECT org_id FROM profiles WHERE user_id = auth.uid()
  )
);

-- Owners can delete their org's promo codes
CREATE POLICY "Owners can delete org promos"
ON promo_codes FOR DELETE
TO authenticated
USING (
  org_id IN (
    SELECT org_id FROM profiles WHERE user_id = auth.uid()
  )
);

-- Public can view active promo codes (for validation)
CREATE POLICY "Public can view active promos"
ON promo_codes FOR SELECT
TO anon
USING (
  is_active = true 
  AND (expires_at IS NULL OR expires_at > now())
  AND (starts_at IS NULL OR starts_at <= now())
);

-- ============================================
-- PROMO CODE USAGE POLICIES
-- ============================================

-- Owners can view promo usage for their org
CREATE POLICY "Owners can view promo usage"
ON promo_code_usage FOR SELECT
TO authenticated
USING (
  promo_code_id IN (
    SELECT id FROM promo_codes WHERE org_id IN (
      SELECT org_id FROM profiles WHERE user_id = auth.uid()
    )
  )
);

-- System can insert promo usage
CREATE POLICY "System can insert promo usage"
ON promo_code_usage FOR INSERT
TO authenticated
WITH CHECK (true);

-- ============================================
-- REALTIME CONFIGURATION
-- ============================================

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE reviews;
ALTER PUBLICATION supabase_realtime ADD TABLE customers;
ALTER PUBLICATION supabase_realtime ADD TABLE email_campaigns;
ALTER PUBLICATION supabase_realtime ADD TABLE promo_codes;
