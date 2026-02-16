-- =====================================================
-- FINANCIAL IDEMPOTENCY PROTECTION
-- Prevents duplicate seller_ledger entries for same order
-- =====================================================

-- Add unique constraint to prevent duplicate sale entries per order
-- This ensures one and only one ledger entry per order for type='sale'

DO $$ 
BEGIN
    -- Check if constraint already exists
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'unique_order_sale_ledger'
    ) THEN
        -- Add partial unique constraint (only for type='sale')
        ALTER TABLE public.seller_ledger
        ADD CONSTRAINT unique_order_sale_ledger
        UNIQUE (order_id, type)
        WHERE type = 'sale';
        
        RAISE NOTICE 'Unique constraint unique_order_sale_ledger created successfully';
    ELSE
        RAISE NOTICE 'Unique constraint unique_order_sale_ledger already exists';
    END IF;
END $$;

COMMENT ON CONSTRAINT unique_order_sale_ledger ON public.seller_ledger 
IS 'Prevents duplicate sale ledger entries for the same order - financial idempotency protection';
