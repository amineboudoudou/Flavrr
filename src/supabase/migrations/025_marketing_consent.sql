-- Add marketing consent timestamp to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS marketing_opt_in_at TIMESTAMPTZ;

-- Update the trigger function to handle marketing consent from orders
CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_id UUID;
  v_customer_email TEXT;
  v_marketing_consent BOOLEAN;
BEGIN
  -- Only process paid/incoming orders
  IF NEW.status IN ('incoming', 'paid', 'completed') THEN
    v_customer_email := NEW.customer_email;
    
    -- Extract marketing consent from order metadata if available
    v_marketing_consent := COALESCE((NEW.notes::jsonb->>'marketing_consent')::boolean, false);
    
    -- Find or create customer record
    INSERT INTO customers (org_id, name, email, phone, first_order_at, last_order_at, email_marketing_consent, marketing_opt_in_at)
    VALUES (
      NEW.org_id, 
      NEW.customer_name, 
      NEW.customer_email, 
      NEW.customer_phone, 
      NEW.created_at, 
      NEW.created_at,
      v_marketing_consent,
      CASE WHEN v_marketing_consent THEN NEW.created_at ELSE NULL END
    )
    ON CONFLICT (org_id, email) 
    DO UPDATE SET
      name = EXCLUDED.name,
      phone = COALESCE(EXCLUDED.phone, customers.phone),
      last_order_at = EXCLUDED.last_order_at,
      email_marketing_consent = CASE 
        WHEN EXCLUDED.email_marketing_consent = true THEN true 
        ELSE customers.email_marketing_consent 
      END,
      marketing_opt_in_at = CASE 
        WHEN EXCLUDED.email_marketing_consent = true AND customers.email_marketing_consent = false 
        THEN EXCLUDED.marketing_opt_in_at 
        ELSE customers.marketing_opt_in_at 
      END
    RETURNING id INTO v_customer_id;
    
    -- Update statistics
    UPDATE customers
    SET
      total_orders = (
        SELECT COUNT(*) 
        FROM orders 
        WHERE org_id = NEW.org_id 
          AND customer_email = v_customer_email 
          AND status IN ('incoming', 'paid', 'completed')
      ),
      total_spent_cents = (
        SELECT COALESCE(SUM(total_cents), 0)
        FROM orders 
        WHERE org_id = NEW.org_id 
          AND customer_email = v_customer_email 
          AND status IN ('incoming', 'paid', 'completed')
      ),
      average_order_cents = (
        SELECT COALESCE(AVG(total_cents)::INTEGER, 0)
        FROM orders 
        WHERE org_id = NEW.org_id 
          AND customer_email = v_customer_email 
          AND status IN ('incoming', 'paid', 'completed')
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

-- Recreate trigger
DROP TRIGGER IF EXISTS update_customer_stats_on_order ON orders;
CREATE TRIGGER update_customer_stats_on_order
AFTER INSERT OR UPDATE OF status ON orders
FOR EACH ROW
EXECUTE FUNCTION update_customer_stats();
