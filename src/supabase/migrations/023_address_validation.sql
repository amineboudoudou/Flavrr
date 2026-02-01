-- Add address validation fields and constraints
-- This ensures restaurant addresses are validated before allowing delivery creation

-- Add validation fields to organizations
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS address_validated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS address_validated_at TIMESTAMPTZ;

-- Add business hours to organizations
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{
  "monday": {"open": "09:00", "close": "21:00", "closed": false},
  "tuesday": {"open": "09:00", "close": "21:00", "closed": false},
  "wednesday": {"open": "09:00", "close": "21:00", "closed": false},
  "thursday": {"open": "09:00", "close": "21:00", "closed": false},
  "friday": {"open": "09:00", "close": "21:00", "closed": false},
  "saturday": {"open": "10:00", "close": "22:00", "closed": false},
  "sunday": {"open": "10:00", "close": "20:00", "closed": false}
}'::jsonb;

-- Function to validate address before delivery creation
CREATE OR REPLACE FUNCTION check_delivery_address_valid()
RETURNS TRIGGER AS $$
DECLARE
  org_record RECORD;
BEGIN
  -- Get organization for this order
  SELECT o.address_validated, o.address_json, o.name
  INTO org_record
  FROM organizations o
  JOIN orders ord ON ord.org_id = o.id
  WHERE ord.id = NEW.order_id;
  
  -- Check if address is validated
  IF NOT COALESCE(org_record.address_validated, false) THEN
    RAISE EXCEPTION 'Restaurant address must be validated with Google Places before creating delivery. Please update restaurant settings.';
  END IF;
  
  -- Check if address has lat/lng
  IF org_record.address_json IS NULL OR 
     org_record.address_json->>'lat' IS NULL OR 
     org_record.address_json->>'lng' IS NULL THEN
    RAISE EXCEPTION 'Restaurant address must include latitude and longitude. Please re-validate address in settings.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate address before delivery creation
DROP TRIGGER IF EXISTS validate_address_before_delivery ON deliveries;
CREATE TRIGGER validate_address_before_delivery
BEFORE INSERT ON deliveries
FOR EACH ROW
EXECUTE FUNCTION check_delivery_address_valid();

-- Add comment
COMMENT ON FUNCTION check_delivery_address_valid() IS 'Validates that restaurant address is verified with Google Places before allowing delivery creation';
