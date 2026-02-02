-- Add idempotency key for public checkout order creation (workspace-scoped)

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Enforce idempotency per workspace (nullable for non-public flows)
CREATE UNIQUE INDEX IF NOT EXISTS orders_workspace_idempotency_key_unique
  ON public.orders (workspace_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
