-- =====================================================
-- FINANCIAL IDEMPOTENCY PROTECTION
-- Prevents duplicate seller_ledger entries for same order
-- =====================================================

-- Add unique constraint to prevent duplicate sale entries per order
-- This ensures one and only one ledger entry per order for type='sale'

DO $$
BEGIN
    -- Check if partial unique index already exists
    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND indexname = 'uniq_seller_ledger_order_sale'
    ) THEN
        -- Create partial unique index (only for type='sale')
        CREATE UNIQUE INDEX uniq_seller_ledger_order_sale
        ON public.seller_ledger (order_id, type)
        WHERE type = 'sale';

        RAISE NOTICE 'Partial unique index uniq_seller_ledger_order_sale created successfully';
    ELSE
        RAISE NOTICE 'Partial unique index uniq_seller_ledger_order_sale already exists';
    END IF;
END $$;

COMMENT ON INDEX uniq_seller_ledger_order_sale 
IS 'Prevents duplicate sale ledger entries for the same order - financial idempotency protection';
