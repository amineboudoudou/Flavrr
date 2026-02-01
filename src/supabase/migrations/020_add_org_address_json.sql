-- Structured restaurant address for verified Places data
ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS address_json JSONB,
    ADD COLUMN IF NOT EXISTS address_text TEXT;

-- Helpful index when filtering by place id later
CREATE INDEX IF NOT EXISTS idx_organizations_address_place
    ON organizations ((address_json->>'place_id'));
