-- =====================================================
-- STRIPE CONNECT READINESS & SELLER LEDGER ENHANCEMENTS
-- Production-ready multi-tenant implementation
-- =====================================================

-- =====================================================
-- 1. ADD STRIPE CAPABILITIES TO SELLER PAYOUT ACCOUNTS
-- =====================================================

ALTER TABLE public.seller_payout_accounts
ADD COLUMN IF NOT EXISTS stripe_capabilities JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS last_capability_check_at TIMESTAMPTZ;

COMMENT ON COLUMN public.seller_payout_accounts.stripe_capabilities IS 'Stripe account capabilities (card_payments, transfers, etc.)';
COMMENT ON COLUMN public.seller_payout_accounts.last_capability_check_at IS 'Last time we checked Stripe account status';

-- =====================================================
-- 2. ADD READY_AT TIMESTAMP TO ORDERS
-- =====================================================

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_orders_org ON public.orders(org_id);
CREATE INDEX IF NOT EXISTS idx_orders_ready_at ON public.orders(ready_at);

COMMENT ON COLUMN public.orders.ready_at IS 'When seller marked order as ready for delivery';
COMMENT ON COLUMN public.orders.org_id IS 'Organization that owns this order (for multi-tenant isolation)';

-- =====================================================
-- 3. ADD FULFILLMENT TYPE TO ORDERS
-- =====================================================

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS fulfillment_type TEXT CHECK (fulfillment_type IN ('delivery', 'pickup', 'dine_in')) DEFAULT 'delivery';

CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_type ON public.orders(fulfillment_type);

COMMENT ON COLUMN public.orders.fulfillment_type IS 'How the order will be fulfilled';

-- =====================================================
-- 4. ADD IDEMPOTENCY KEY TO ORDERS (if not exists)
-- =====================================================

-- Check if column exists, add if not
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'idempotency_key'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN idempotency_key TEXT UNIQUE;
        CREATE INDEX idx_orders_idempotency ON public.orders(idempotency_key);
    END IF;
END $$;

-- =====================================================
-- 5. CREATE SELLER_LEDGER TABLE (Shopify-style)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.seller_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    
    -- Entry type
    type TEXT NOT NULL CHECK (type IN (
        'sale',           -- Revenue from completed order
        'refund',         -- Money returned to customer
        'adjustment',     -- Manual correction
        'payout'          -- Transfer to seller bank account
    )),
    
    -- Money breakdown (all in cents)
    gross_amount_cents INTEGER NOT NULL,      -- Total order amount
    fees_amount_cents INTEGER NOT NULL,       -- Platform + delivery fees
    net_amount_cents INTEGER NOT NULL,        -- Amount owed to seller
    currency TEXT NOT NULL DEFAULT 'cad',
    
    -- Payout status
    status TEXT NOT NULL CHECK (status IN (
        'pending',        -- Not yet available for payout
        'available',      -- Ready to be paid out
        'paid',           -- Transferred to seller
        'failed'          -- Payout failed
    )) DEFAULT 'pending',
    
    -- Payout timing
    available_on TIMESTAMPTZ,                 -- When funds become available
    paid_at TIMESTAMPTZ,                      -- When actually paid out
    
    -- Stripe references
    stripe_transfer_id TEXT,                  -- If using Stripe Transfers
    stripe_payout_id TEXT,                    -- If using Stripe Payouts
    
    -- Metadata
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_net_amount CHECK (net_amount_cents = gross_amount_cents - fees_amount_cents)
);

CREATE INDEX idx_seller_ledger_workspace ON public.seller_ledger(workspace_id);
CREATE INDEX idx_seller_ledger_org ON public.seller_ledger(org_id);
CREATE INDEX idx_seller_ledger_order ON public.seller_ledger(order_id);
CREATE INDEX idx_seller_ledger_type ON public.seller_ledger(type);
CREATE INDEX idx_seller_ledger_status ON public.seller_ledger(status);
CREATE INDEX idx_seller_ledger_available_on ON public.seller_ledger(available_on);
CREATE INDEX idx_seller_ledger_created_at ON public.seller_ledger(created_at DESC);

COMMENT ON TABLE public.seller_ledger IS 'Shopify-style seller payout ledger with gross/fees/net breakdown';

-- =====================================================
-- 6. ADD UPDATED_AT TRIGGER FOR SELLER_LEDGER
-- =====================================================

CREATE TRIGGER update_seller_ledger_updated_at
    BEFORE UPDATE ON public.seller_ledger
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 7. RLS POLICIES FOR SELLER_LEDGER
-- =====================================================

ALTER TABLE public.seller_ledger ENABLE ROW LEVEL SECURITY;

-- Workspace owners can view their ledger
CREATE POLICY "Workspace owners can view seller ledger"
    ON public.seller_ledger
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_memberships
            WHERE workspace_memberships.workspace_id = seller_ledger.workspace_id
            AND workspace_memberships.user_id = auth.uid()
            AND workspace_memberships.role IN ('owner', 'admin')
        )
    );

-- Service role full access
CREATE POLICY "Service role full access to seller ledger"
    ON public.seller_ledger
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- 8. HELPER FUNCTION: GET SELLER PAYOUT BALANCES
-- =====================================================

CREATE OR REPLACE FUNCTION get_seller_payout_balances(workspace_uuid UUID)
RETURNS TABLE (
    pending_cents BIGINT,
    available_cents BIGINT,
    paid_cents BIGINT,
    total_gross_cents BIGINT,
    total_fees_cents BIGINT,
    total_net_cents BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(CASE WHEN status = 'pending' THEN net_amount_cents ELSE 0 END), 0) as pending_cents,
        COALESCE(SUM(CASE WHEN status = 'available' THEN net_amount_cents ELSE 0 END), 0) as available_cents,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN net_amount_cents ELSE 0 END), 0) as paid_cents,
        COALESCE(SUM(gross_amount_cents), 0) as total_gross_cents,
        COALESCE(SUM(fees_amount_cents), 0) as total_fees_cents,
        COALESCE(SUM(net_amount_cents), 0) as total_net_cents
    FROM public.seller_ledger
    WHERE workspace_id = workspace_uuid
    AND type IN ('sale', 'refund', 'adjustment');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_seller_payout_balances(UUID) TO authenticated;

-- =====================================================
-- 9. GRANT PERMISSIONS
-- =====================================================

GRANT SELECT ON public.seller_ledger TO authenticated;

-- =====================================================
-- 10. ADD ERROR_MESSAGE COLUMN TO DELIVERIES (if not exists)
-- =====================================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'deliveries' 
        AND column_name = 'error_message'
    ) THEN
        ALTER TABLE public.deliveries ADD COLUMN error_message TEXT;
    END IF;
END $$;

COMMENT ON COLUMN public.deliveries.error_message IS 'Error message if delivery creation or update failed';
