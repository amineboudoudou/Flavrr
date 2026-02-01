-- Uber fields for orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS uber_delivery_id text,
ADD COLUMN IF NOT EXISTS uber_tracking_url text,
ADD COLUMN IF NOT EXISTS uber_status text,
ADD COLUMN IF NOT EXISTS uber_quote_id text,
ADD COLUMN IF NOT EXISTS last_uber_sync_at timestamptz;
