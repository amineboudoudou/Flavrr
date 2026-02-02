-- Durable delivery error tracking for safe retries

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS error_message TEXT;
