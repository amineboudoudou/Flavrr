-- Add business hours table and scheduled_for column to orders

-- 1. Create business hours table
CREATE TABLE business_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday, 1 = Monday, etc.
    open_time TIME NOT NULL DEFAULT '09:00',
    close_time TIME NOT NULL DEFAULT '22:00',
    is_closed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(org_id, day_of_week)
);

CREATE INDEX idx_business_hours_org_id ON business_hours(org_id);

-- 2. Add scheduled_for column to orders
ALTER TABLE orders ADD COLUMN scheduled_for TIMESTAMPTZ;

-- 3. Add prep time buffer to organizations settings via JSONB if not already implicitly used
-- (The UI will manage this inside the existing settings JSONB field)

-- 4. Enable RLS on business_hours
ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;

-- 5. Add RLS policies for business_hours
CREATE POLICY "Public read for business hours" 
    ON business_hours FOR SELECT 
    USING (true);

CREATE POLICY "Owners manage business hours" 
    ON business_hours FOR ALL 
    TO authenticated
    USING (check_same_org(org_id))
    WITH CHECK (check_same_org(org_id));

-- Trigger for updated_at
CREATE TRIGGER update_business_hours_updated_at
BEFORE UPDATE ON business_hours
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 6. Add default hours for existing organization (Café Du Griot)
INSERT INTO business_hours (org_id, day_of_week, open_time, close_time, is_closed)
SELECT 
    id as org_id,
    d as day_of_week,
    '10:00'::TIME as open_time,
    '21:00'::TIME as close_time,
    false as is_closed
FROM organizations, generate_series(0, 6) d
WHERE slug = 'cafe-du-griot'
ON CONFLICT (org_id, day_of_week) DO NOTHING;
