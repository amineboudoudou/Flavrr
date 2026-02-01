-- Organizations (restaurants/businesses)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  phone TEXT,
  email TEXT,
  
  -- Address fields
  street TEXT,
  city TEXT,
  region TEXT, -- Province/State
  postal_code TEXT,
  country TEXT DEFAULT 'CA',
  
  -- Business settings
  timezone TEXT DEFAULT 'America/Montreal',
  currency TEXT DEFAULT 'CAD',
  
  -- Settings stored as JSONB for flexibility
  -- Example structure:
  -- {
  --   "prep_time_default": 30,
  --   "taxes": {"gst": 5, "qst": 9.975},
  --   "tips": {"enabled": true, "presets": [10, 15, 20]},
  --   "hours": {"monday": {"open": "09:00", "close": "21:00"}, ...},
  --   "delivery_zones": [...],
  --   "minimum_order_cents": 1500
  -- }
  settings JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizations_updated_at
BEFORE UPDATE ON organizations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Index for fast slug lookups
CREATE INDEX idx_organizations_slug ON organizations(slug);
