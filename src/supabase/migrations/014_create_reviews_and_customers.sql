-- ============================================
-- REVIEWS TABLE
-- ============================================

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Customer info (denormalized for easier querying)
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  
  -- Review content
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  images TEXT[] DEFAULT '{}', -- Array of image URLs
  
  -- Moderation
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  moderated_at TIMESTAMPTZ,
  moderated_by UUID REFERENCES profiles(user_id),
  
  -- Engagement
  helpful_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_reviews_org_id ON reviews(org_id);
CREATE INDEX idx_reviews_order_id ON reviews(order_id);
CREATE INDEX idx_reviews_status ON reviews(status);
CREATE INDEX idx_reviews_rating ON reviews(rating);

CREATE TRIGGER update_reviews_updated_at
BEFORE UPDATE ON reviews
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- CUSTOMERS TABLE
-- ============================================

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Customer info (aggregated from orders)
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  
  -- Statistics
  total_orders INTEGER DEFAULT 0,
  total_spent_cents INTEGER DEFAULT 0,
  average_order_cents INTEGER DEFAULT 0,
  last_order_at TIMESTAMPTZ,
  first_order_at TIMESTAMPTZ,
  
  -- Preferences
  favorite_items JSONB DEFAULT '[]'::jsonb,
  preferred_fulfillment_type fulfillment_type,
  
  -- Marketing
  email_marketing_consent BOOLEAN DEFAULT false,
  sms_marketing_consent BOOLEAN DEFAULT false,
  
  -- Internal notes
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Ensure unique customer per org
  UNIQUE(org_id, email)
);

CREATE INDEX idx_customers_org_id ON customers(org_id);
CREATE INDEX idx_customers_email ON customers(org_id, email);
CREATE INDEX idx_customers_phone ON customers(org_id, phone);
CREATE INDEX idx_customers_total_spent ON customers(org_id, total_spent_cents DESC);
CREATE INDEX idx_customers_last_order ON customers(org_id, last_order_at DESC);

CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- EMAIL CAMPAIGNS TABLE
-- ============================================

CREATE TABLE email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(user_id),
  
  -- Campaign details
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  
  -- Recipient filtering
  recipient_filter JSONB DEFAULT '{}'::jsonb,
  -- Example: {"min_orders": 3, "last_order_days_ago": 30, "tags": ["vip"]}
  
  -- Scheduling
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  
  -- Statistics
  recipients_count INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  
  -- Error tracking
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_email_campaigns_org_id ON email_campaigns(org_id);
CREATE INDEX idx_email_campaigns_status ON email_campaigns(status);
CREATE INDEX idx_email_campaigns_scheduled_for ON email_campaigns(scheduled_for);

CREATE TRIGGER update_email_campaigns_updated_at
BEFORE UPDATE ON email_campaigns
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PROMO CODES TABLE
-- ============================================

CREATE TABLE promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(user_id),
  
  -- Code details
  code TEXT NOT NULL,
  description TEXT,
  
  -- Discount configuration
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value INTEGER NOT NULL CHECK (discount_value > 0),
  -- For percentage: value is 1-100 (e.g., 10 = 10%)
  -- For fixed_amount: value is in cents (e.g., 500 = $5.00)
  
  -- Restrictions
  min_order_cents INTEGER DEFAULT 0,
  max_discount_cents INTEGER, -- Cap for percentage discounts
  
  -- Usage limits
  max_uses INTEGER, -- NULL = unlimited
  max_uses_per_customer INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,
  
  -- Validity
  is_active BOOLEAN DEFAULT true,
  starts_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  
  -- Applicable items (NULL = all items)
  applicable_category_ids UUID[] DEFAULT NULL,
  applicable_item_ids UUID[] DEFAULT NULL,
  
  -- Statistics
  total_revenue_cents INTEGER DEFAULT 0,
  total_discount_given_cents INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Ensure unique code per org
  UNIQUE(org_id, code)
);

CREATE INDEX idx_promo_codes_org_id ON promo_codes(org_id);
CREATE INDEX idx_promo_codes_code ON promo_codes(org_id, code);
CREATE INDEX idx_promo_codes_active ON promo_codes(org_id, is_active);
CREATE INDEX idx_promo_codes_expires_at ON promo_codes(expires_at);

CREATE TRIGGER update_promo_codes_updated_at
BEFORE UPDATE ON promo_codes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PROMO CODE USAGE TRACKING
-- ============================================

CREATE TABLE promo_code_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  
  discount_applied_cents INTEGER NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_promo_code_usage_promo_id ON promo_code_usage(promo_code_id);
CREATE INDEX idx_promo_code_usage_order_id ON promo_code_usage(order_id);
CREATE INDEX idx_promo_code_usage_customer ON promo_code_usage(promo_code_id, customer_email);

-- ============================================
-- CUSTOMER ADDRESSES (for delivery history)
-- ============================================

CREATE TABLE customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Address details
  label TEXT, -- e.g., "Home", "Work"
  street TEXT NOT NULL,
  city TEXT NOT NULL,
  region TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT DEFAULT 'CA',
  
  -- Usage tracking
  use_count INTEGER DEFAULT 1,
  last_used_at TIMESTAMPTZ DEFAULT now(),
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_customer_addresses_customer_id ON customer_addresses(customer_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update customer statistics when an order is created/updated
CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_id UUID;
  v_customer_email TEXT;
BEGIN
  -- Only process paid orders
  IF NEW.status = 'paid' OR NEW.status = 'completed' THEN
    v_customer_email := NEW.customer_email;
    
    -- Find or create customer record
    INSERT INTO customers (org_id, name, email, phone, first_order_at, last_order_at)
    VALUES (NEW.org_id, NEW.customer_name, NEW.customer_email, NEW.customer_phone, NEW.created_at, NEW.created_at)
    ON CONFLICT (org_id, email) 
    DO UPDATE SET
      name = EXCLUDED.name,
      phone = COALESCE(EXCLUDED.phone, customers.phone),
      last_order_at = EXCLUDED.last_order_at
    RETURNING id INTO v_customer_id;
    
    -- Update statistics
    UPDATE customers
    SET
      total_orders = (
        SELECT COUNT(*) 
        FROM orders 
        WHERE org_id = NEW.org_id 
          AND customer_email = v_customer_email 
          AND status IN ('paid', 'completed')
      ),
      total_spent_cents = (
        SELECT COALESCE(SUM(total_cents), 0)
        FROM orders 
        WHERE org_id = NEW.org_id 
          AND customer_email = v_customer_email 
          AND status IN ('paid', 'completed')
      ),
      average_order_cents = (
        SELECT COALESCE(AVG(total_cents)::INTEGER, 0)
        FROM orders 
        WHERE org_id = NEW.org_id 
          AND customer_email = v_customer_email 
          AND status IN ('paid', 'completed')
      )
    WHERE id = v_customer_id;
    
    -- Track delivery address if applicable
    IF NEW.fulfillment_type = 'delivery' AND NEW.delivery_address IS NOT NULL THEN
      INSERT INTO customer_addresses (
        customer_id,
        street,
        city,
        region,
        postal_code,
        country
      )
      SELECT
        v_customer_id,
        NEW.delivery_address->>'street',
        NEW.delivery_address->>'city',
        NEW.delivery_address->>'province',
        NEW.delivery_address->>'postal_code',
        COALESCE(NEW.delivery_address->>'country', 'CA')
      WHERE NOT EXISTS (
        SELECT 1 FROM customer_addresses
        WHERE customer_id = v_customer_id
          AND street = NEW.delivery_address->>'street'
          AND postal_code = NEW.delivery_address->>'postal_code'
      );
      
      -- Update use count if address exists
      UPDATE customer_addresses
      SET 
        use_count = use_count + 1,
        last_used_at = now()
      WHERE customer_id = v_customer_id
        AND street = NEW.delivery_address->>'street'
        AND postal_code = NEW.delivery_address->>'postal_code';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customer_stats_on_order
AFTER INSERT OR UPDATE OF status ON orders
FOR EACH ROW
EXECUTE FUNCTION update_customer_stats();

-- Function to update promo code usage
CREATE OR REPLACE FUNCTION update_promo_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE promo_codes
  SET current_uses = current_uses + 1
  WHERE id = NEW.promo_code_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_promo_usage_on_insert
AFTER INSERT ON promo_code_usage
FOR EACH ROW
EXECUTE FUNCTION update_promo_usage();
