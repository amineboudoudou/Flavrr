-- Add Stripe Connect fields to organizations
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS stripe_account_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS stripe_account_status TEXT DEFAULT 'pending', -- 'pending', 'active', 'restricted'
ADD COLUMN IF NOT EXISTS stripe_account_created_at TIMESTAMPTZ;

-- Add fee tracking to orders
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS application_fee_cents INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_method_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_account_id ON organizations(stripe_account_id);
