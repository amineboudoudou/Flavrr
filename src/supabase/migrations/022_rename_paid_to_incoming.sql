-- Rename 'paid' status to 'incoming' for clearer order lifecycle
-- This aligns with Shopify-style order management where 'incoming' represents
-- a paid order that hasn't been accepted by the restaurant yet

-- Step 1: Add 'incoming' to the enum
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'incoming' BEFORE 'accepted';

-- Step 2: Update all existing 'paid' orders to 'incoming'
UPDATE orders SET status = 'incoming' WHERE status = 'paid';

-- Step 3: Update order_events to reflect the rename
UPDATE order_events SET new_status = 'incoming' WHERE new_status = 'paid';
UPDATE order_events SET previous_status = 'incoming' WHERE previous_status = 'paid';

-- Note: We cannot remove 'paid' from the enum directly in PostgreSQL
-- But we can add a constraint to prevent its use going forward
-- The application code will no longer reference 'paid'

COMMENT ON TYPE order_status IS 'Order lifecycle: draft → awaiting_payment → incoming (paid) → accepted → preparing → ready → out_for_delivery → completed';
