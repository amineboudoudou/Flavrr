-- Uber Direct Deliveries Integration
-- This migration creates a proper deliveries table and updates orders table

-- Update delivery_provider enum to include test mode
ALTER TYPE delivery_provider ADD VALUE IF NOT EXISTS 'uber_direct_test';

-- Modify existing deliveries table to match requirements
-- First, check if we need to add missing columns
ALTER TABLE deliveries
ADD COLUMN IF NOT EXISTS external_id TEXT,
ADD COLUMN IF NOT EXISTS eta_minutes INTEGER,
ADD COLUMN IF NOT EXISTS raw_response JSONB;

-- Rename columns to match new schema
DO $$ 
BEGIN
  -- Rename delivery_id to external_id if it exists and external_id doesn't
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'deliveries' AND column_name = 'delivery_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'deliveries' AND column_name = 'external_id') THEN
    ALTER TABLE deliveries RENAME COLUMN delivery_id TO external_id;
  END IF;

  -- Rename raw to raw_response if needed
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'deliveries' AND column_name = 'raw')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'deliveries' AND column_name = 'raw_response') THEN
    ALTER TABLE deliveries RENAME COLUMN raw TO raw_response;
  END IF;
END $$;

-- Ensure deliveries table has all required columns
ALTER TABLE deliveries
ALTER COLUMN external_id SET NOT NULL,
ADD COLUMN IF NOT EXISTS eta_minutes INTEGER,
ADD COLUMN IF NOT EXISTS tracking_url TEXT;

-- Add delivery_id foreign key to orders if not exists
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL;

-- Add customer_email_snapshot to orders if not exists (for email notifications)
-- Note: customer_email already exists, so we'll use that

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_deliveries_external_id ON deliveries(external_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_id ON orders(delivery_id);

-- Add comment for clarity
COMMENT ON TABLE deliveries IS 'Tracks third-party delivery provider orders (Uber Direct, etc.)';
COMMENT ON COLUMN deliveries.external_id IS 'Provider delivery ID (e.g., Uber delivery_id)';
COMMENT ON COLUMN deliveries.provider IS 'Delivery provider: uber_direct or uber_direct_test';
COMMENT ON COLUMN deliveries.eta_minutes IS 'Estimated time to delivery in minutes';
COMMENT ON COLUMN deliveries.tracking_url IS 'Customer-facing tracking URL';
COMMENT ON COLUMN deliveries.raw_response IS 'Full API response from provider for debugging';
