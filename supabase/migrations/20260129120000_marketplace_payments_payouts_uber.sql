-- =====================================================
-- MARKETPLACE PAYMENTS, PAYOUTS & DELIVERY SYSTEM
-- Production-grade multi-tenant implementation
-- =====================================================

-- =====================================================
-- 1. STRIPE CONNECT ACCOUNTS (Seller Payouts)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.seller_payout_accounts (
    workspace_id UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
    stripe_connect_account_id TEXT UNIQUE NOT NULL,
    onboarding_status TEXT NOT NULL CHECK (onboarding_status IN ('not_started', 'pending', 'complete')) DEFAULT 'not_started',
    charges_enabled BOOLEAN NOT NULL DEFAULT false,
    payouts_enabled BOOLEAN NOT NULL DEFAULT false,
    requirements_due JSONB DEFAULT '[]'::jsonb,
    details_submitted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_seller_payout_accounts_stripe_id ON public.seller_payout_accounts(stripe_connect_account_id);
CREATE INDEX idx_seller_payout_accounts_status ON public.seller_payout_accounts(onboarding_status);

-- =====================================================
-- 2. ORDERS (Workspace-scoped)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    customer_email TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    
    -- Order status state machine
    status TEXT NOT NULL CHECK (status IN (
        'draft',
        'pending_payment',
        'paid',
        'preparing',
        'out_for_delivery',
        'delivered',
        'canceled',
        'refunded'
    )) DEFAULT 'draft',
    
    -- Money breakdown (all in cents)
    subtotal_cents INTEGER NOT NULL DEFAULT 0,
    delivery_fee_cents INTEGER NOT NULL DEFAULT 0,
    service_fee_cents INTEGER NOT NULL DEFAULT 0,
    tax_cents INTEGER NOT NULL DEFAULT 0,
    total_cents INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'cad',
    
    -- Delivery details
    delivery_address JSONB,
    delivery_instructions TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT positive_amounts CHECK (
        subtotal_cents >= 0 AND
        delivery_fee_cents >= 0 AND
        service_fee_cents >= 0 AND
        tax_cents >= 0 AND
        total_cents >= 0
    )
);

CREATE INDEX idx_orders_workspace ON public.orders(workspace_id);
CREATE INDEX idx_orders_customer ON public.orders(customer_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);

-- =====================================================
-- 3. ORDER ITEMS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID, -- nullable for deleted products
    
    -- Snapshot at time of order (immutable)
    name_snapshot TEXT NOT NULL,
    description_snapshot TEXT,
    unit_price_cents INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    
    -- Line total
    line_total_cents INTEGER NOT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT positive_quantity CHECK (quantity > 0),
    CONSTRAINT positive_price CHECK (unit_price_cents >= 0),
    CONSTRAINT valid_line_total CHECK (line_total_cents = unit_price_cents * quantity)
);

CREATE INDEX idx_order_items_order ON public.order_items(order_id);
CREATE INDEX idx_order_items_product ON public.order_items(product_id);

-- =====================================================
-- 4. PAYMENTS (Stripe Payment Intents)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID UNIQUE NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    
    -- Stripe identifiers
    stripe_payment_intent_id TEXT UNIQUE NOT NULL,
    stripe_charge_id TEXT,
    
    -- Money flow
    amount_total_cents INTEGER NOT NULL,
    application_fee_cents INTEGER NOT NULL DEFAULT 0,
    destination_account_id TEXT, -- Stripe Connect account
    
    -- Status tracking
    status TEXT NOT NULL CHECK (status IN (
        'pending',
        'processing',
        'succeeded',
        'failed',
        'canceled'
    )) DEFAULT 'pending',
    
    -- Metadata
    payment_method_type TEXT,
    failure_reason TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    succeeded_at TIMESTAMPTZ,
    
    CONSTRAINT positive_payment_amounts CHECK (
        amount_total_cents >= 0 AND
        application_fee_cents >= 0
    )
);

CREATE INDEX idx_payments_order ON public.payments(order_id);
CREATE INDEX idx_payments_workspace ON public.payments(workspace_id);
CREATE INDEX idx_payments_stripe_pi ON public.payments(stripe_payment_intent_id);
CREATE INDEX idx_payments_status ON public.payments(status);

-- =====================================================
-- 5. REFUNDS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
    
    -- Stripe identifiers
    stripe_refund_id TEXT UNIQUE NOT NULL,
    
    -- Refund details
    amount_cents INTEGER NOT NULL,
    reason TEXT,
    status TEXT NOT NULL CHECK (status IN (
        'pending',
        'succeeded',
        'failed',
        'canceled'
    )) DEFAULT 'pending',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    succeeded_at TIMESTAMPTZ,
    
    CONSTRAINT positive_refund_amount CHECK (amount_cents > 0)
);

CREATE INDEX idx_refunds_order ON public.refunds(order_id);
CREATE INDEX idx_refunds_payment ON public.refunds(payment_id);
CREATE INDEX idx_refunds_stripe_id ON public.refunds(stripe_refund_id);

-- =====================================================
-- 6. LEDGER ENTRIES (Shopify-grade reconciliation)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    
    -- Entry type
    type TEXT NOT NULL CHECK (type IN (
        'sale',                      -- Revenue from order
        'platform_fee',              -- Flavrr's commission
        'delivery_fee_collected',    -- Customer paid delivery fee
        'delivery_cost',             -- Actual Uber cost
        'refund',                    -- Money returned to customer
        'adjustment'                 -- Manual correction
    )),
    
    -- Money (positive = credit to workspace, negative = debit)
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'cad',
    
    -- Settlement status
    status TEXT NOT NULL CHECK (status IN (
        'pending',   -- Not yet settled
        'settled',   -- Paid out to seller
        'reversed'   -- Refunded/canceled
    )) DEFAULT 'pending',
    
    -- Metadata
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settled_at TIMESTAMPTZ,
    
    CONSTRAINT non_zero_amount CHECK (amount_cents != 0)
);

CREATE INDEX idx_ledger_workspace ON public.ledger_entries(workspace_id);
CREATE INDEX idx_ledger_order ON public.ledger_entries(order_id);
CREATE INDEX idx_ledger_type ON public.ledger_entries(type);
CREATE INDEX idx_ledger_status ON public.ledger_entries(status);
CREATE INDEX idx_ledger_created_at ON public.ledger_entries(created_at DESC);

-- =====================================================
-- 7. DELIVERIES (Uber Direct)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID UNIQUE NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    
    -- Uber identifiers
    uber_delivery_id TEXT UNIQUE,
    quote_id TEXT,
    
    -- Status tracking
    status TEXT NOT NULL CHECK (status IN (
        'pending',
        'quote_requested',
        'quote_received',
        'delivery_requested',
        'pickup',
        'dropoff',
        'delivered',
        'canceled',
        'failed'
    )) DEFAULT 'pending',
    
    -- Cost tracking
    uber_cost_cents INTEGER NOT NULL DEFAULT 0,
    customer_delivery_fee_cents INTEGER NOT NULL DEFAULT 0,
    
    -- Idempotency
    idempotency_key TEXT UNIQUE NOT NULL,
    
    -- Delivery details
    pickup_address JSONB,
    dropoff_address JSONB,
    tracking_url TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,
    
    CONSTRAINT positive_delivery_costs CHECK (
        uber_cost_cents >= 0 AND
        customer_delivery_fee_cents >= 0
    )
);

CREATE INDEX idx_deliveries_order ON public.deliveries(order_id);
CREATE INDEX idx_deliveries_workspace ON public.deliveries(workspace_id);
CREATE INDEX idx_deliveries_uber_id ON public.deliveries(uber_delivery_id);
CREATE INDEX idx_deliveries_status ON public.deliveries(status);
CREATE INDEX idx_deliveries_idempotency ON public.deliveries(idempotency_key);

-- =====================================================
-- 8. WEBHOOK EVENT IDEMPOTENCY
-- =====================================================

-- Stripe webhook events
CREATE TABLE IF NOT EXISTS public.stripe_events (
    event_id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    payload JSONB NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processing_result TEXT,
    error_message TEXT
);

CREATE INDEX idx_stripe_events_type ON public.stripe_events(type);
CREATE INDEX idx_stripe_events_processed_at ON public.stripe_events(processed_at DESC);

-- Uber webhook events
CREATE TABLE IF NOT EXISTS public.uber_events (
    event_id TEXT PRIMARY KEY,
    delivery_id TEXT,
    type TEXT,
    payload JSONB NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processing_result TEXT,
    error_message TEXT
);

CREATE INDEX idx_uber_events_delivery ON public.uber_events(delivery_id);
CREATE INDEX idx_uber_events_processed_at ON public.uber_events(processed_at DESC);

-- =====================================================
-- 9. UPDATED_AT TRIGGERS
-- =====================================================

CREATE TRIGGER update_seller_payout_accounts_updated_at
    BEFORE UPDATE ON public.seller_payout_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_refunds_updated_at
    BEFORE UPDATE ON public.refunds
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deliveries_updated_at
    BEFORE UPDATE ON public.deliveries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.seller_payout_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uber_events ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- SELLER PAYOUT ACCOUNTS POLICIES
-- =====================================================

-- Only workspace owners can view payout account details
CREATE POLICY "Workspace owners can view payout accounts"
    ON public.seller_payout_accounts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_memberships
            WHERE workspace_memberships.workspace_id = seller_payout_accounts.workspace_id
            AND workspace_memberships.user_id = auth.uid()
            AND workspace_memberships.role = 'owner'
        )
    );

-- Only workspace owners can update payout accounts
CREATE POLICY "Workspace owners can update payout accounts"
    ON public.seller_payout_accounts
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_memberships
            WHERE workspace_memberships.workspace_id = seller_payout_accounts.workspace_id
            AND workspace_memberships.user_id = auth.uid()
            AND workspace_memberships.role = 'owner'
        )
    );

-- Service role can insert/update (for Edge Functions)
CREATE POLICY "Service role full access to payout accounts"
    ON public.seller_payout_accounts
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- ORDERS POLICIES
-- =====================================================

-- Workspace members can view their workspace orders
CREATE POLICY "Workspace members can view orders"
    ON public.orders
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_memberships
            WHERE workspace_memberships.workspace_id = orders.workspace_id
            AND workspace_memberships.user_id = auth.uid()
        )
    );

-- Customers can view their own orders
CREATE POLICY "Customers can view their orders"
    ON public.orders
    FOR SELECT
    USING (customer_id = auth.uid());

-- Service role can manage orders (for Edge Functions)
CREATE POLICY "Service role full access to orders"
    ON public.orders
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- ORDER ITEMS POLICIES
-- =====================================================

-- Workspace members can view order items for their orders
CREATE POLICY "Workspace members can view order items"
    ON public.order_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.orders
            JOIN public.workspace_memberships ON workspace_memberships.workspace_id = orders.workspace_id
            WHERE orders.id = order_items.order_id
            AND workspace_memberships.user_id = auth.uid()
        )
    );

-- Customers can view items from their orders
CREATE POLICY "Customers can view their order items"
    ON public.order_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.orders
            WHERE orders.id = order_items.order_id
            AND orders.customer_id = auth.uid()
        )
    );

-- Service role full access
CREATE POLICY "Service role full access to order items"
    ON public.order_items
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- PAYMENTS POLICIES
-- =====================================================

-- Workspace owners and admins can view payments
CREATE POLICY "Workspace owners/admins can view payments"
    ON public.payments
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_memberships
            WHERE workspace_memberships.workspace_id = payments.workspace_id
            AND workspace_memberships.user_id = auth.uid()
            AND workspace_memberships.role IN ('owner', 'admin')
        )
    );

-- Service role full access
CREATE POLICY "Service role full access to payments"
    ON public.payments
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- REFUNDS POLICIES
-- =====================================================

-- Workspace owners/admins can view refunds
CREATE POLICY "Workspace owners/admins can view refunds"
    ON public.refunds
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.orders
            JOIN public.workspace_memberships ON workspace_memberships.workspace_id = orders.workspace_id
            WHERE orders.id = refunds.order_id
            AND workspace_memberships.user_id = auth.uid()
            AND workspace_memberships.role IN ('owner', 'admin')
        )
    );

-- Service role full access
CREATE POLICY "Service role full access to refunds"
    ON public.refunds
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- LEDGER ENTRIES POLICIES
-- =====================================================

-- Only workspace owners can view ledger entries
CREATE POLICY "Workspace owners can view ledger"
    ON public.ledger_entries
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_memberships
            WHERE workspace_memberships.workspace_id = ledger_entries.workspace_id
            AND workspace_memberships.user_id = auth.uid()
            AND workspace_memberships.role = 'owner'
        )
    );

-- Service role full access
CREATE POLICY "Service role full access to ledger"
    ON public.ledger_entries
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- DELIVERIES POLICIES
-- =====================================================

-- Workspace members can view deliveries
CREATE POLICY "Workspace members can view deliveries"
    ON public.deliveries
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_memberships
            WHERE workspace_memberships.workspace_id = deliveries.workspace_id
            AND workspace_memberships.user_id = auth.uid()
        )
    );

-- Service role full access
CREATE POLICY "Service role full access to deliveries"
    ON public.deliveries
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- WEBHOOK EVENTS POLICIES (Admin only)
-- =====================================================

-- Only service role can access webhook events
CREATE POLICY "Service role only for stripe events"
    ON public.stripe_events
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role only for uber events"
    ON public.uber_events
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- 11. HELPER FUNCTIONS
-- =====================================================

-- Get workspace balance (sum of ledger entries)
CREATE OR REPLACE FUNCTION get_workspace_balance(workspace_uuid UUID)
RETURNS TABLE (
    total_pending_cents BIGINT,
    total_settled_cents BIGINT,
    total_balance_cents BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount_cents ELSE 0 END), 0) as total_pending_cents,
        COALESCE(SUM(CASE WHEN status = 'settled' THEN amount_cents ELSE 0 END), 0) as total_settled_cents,
        COALESCE(SUM(amount_cents), 0) as total_balance_cents
    FROM public.ledger_entries
    WHERE workspace_id = workspace_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get order summary with payment and delivery status
CREATE OR REPLACE FUNCTION get_order_summary(order_uuid UUID)
RETURNS TABLE (
    order_id UUID,
    workspace_id UUID,
    status TEXT,
    total_cents INTEGER,
    payment_status TEXT,
    delivery_status TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id,
        o.workspace_id,
        o.status,
        o.total_cents,
        p.status as payment_status,
        d.status as delivery_status,
        o.created_at
    FROM public.orders o
    LEFT JOIN public.payments p ON p.order_id = o.id
    LEFT JOIN public.deliveries d ON d.order_id = o.id
    WHERE o.id = order_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 12. GRANT PERMISSIONS
-- =====================================================

GRANT SELECT, INSERT, UPDATE ON public.seller_payout_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT SELECT, INSERT ON public.order_items TO authenticated;
GRANT SELECT ON public.payments TO authenticated;
GRANT SELECT ON public.refunds TO authenticated;
GRANT SELECT ON public.ledger_entries TO authenticated;
GRANT SELECT ON public.deliveries TO authenticated;

GRANT EXECUTE ON FUNCTION get_workspace_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_order_summary(UUID) TO authenticated;

-- =====================================================
-- 13. COMMENTS
-- =====================================================

COMMENT ON TABLE public.seller_payout_accounts IS 'Stripe Connect accounts for seller payouts';
COMMENT ON TABLE public.orders IS 'Customer orders with workspace isolation';
COMMENT ON TABLE public.order_items IS 'Line items for orders with price snapshots';
COMMENT ON TABLE public.payments IS 'Stripe payment intents and charges';
COMMENT ON TABLE public.refunds IS 'Stripe refunds linked to payments';
COMMENT ON TABLE public.ledger_entries IS 'Shopify-grade money ledger for reconciliation';
COMMENT ON TABLE public.deliveries IS 'Uber Direct delivery tracking';
COMMENT ON TABLE public.stripe_events IS 'Stripe webhook event idempotency log';
COMMENT ON TABLE public.uber_events IS 'Uber webhook event idempotency log';
