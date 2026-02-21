-- =====================================================
-- UNIFIED PRODUCT CATALOG - Single Source of Truth
-- Shopify-grade product management for manual orders & storefront
-- =====================================================

-- 1. CREATE UNIFIED PRODUCTS TABLE
-- This becomes the single source of truth for all sellable items
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Ownership & scope
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    
    -- Product identification
    sku TEXT, -- Stock keeping unit for inventory tracking
    barcode TEXT, -- EAN/UPC barcode
    
    -- Names (localized)
    name TEXT NOT NULL,
    name_fr TEXT,
    name_en TEXT,
    
    -- Descriptions (localized)
    description TEXT,
    description_fr TEXT,
    description_en TEXT,
    
    -- Pricing (all in cents for precision)
    base_price_cents INTEGER NOT NULL CHECK (base_price_cents >= 0),
    compare_at_price_cents INTEGER CHECK (compare_at_price_cents >= 0), -- "was" price for sales
    cost_cents INTEGER CHECK (cost_cents >= 0), -- Cost of goods for margin calculation
    
    -- Inventory tracking (Shopify-grade)
    track_quantity BOOLEAN NOT NULL DEFAULT false,
    quantity INTEGER NOT NULL DEFAULT 0,
    reserved_quantity INTEGER NOT NULL DEFAULT 0, -- Allocated to pending orders
    low_stock_threshold INTEGER DEFAULT 10, -- Alert when stock drops below this
    allow_overselling BOOLEAN NOT NULL DEFAULT true, -- Allow sales when out of stock
    
    -- Product state
    status TEXT NOT NULL CHECK (status IN ('active', 'draft', 'archived')) DEFAULT 'draft',
    visibility TEXT NOT NULL CHECK (visibility IN ('public', 'private', 'unlisted')) DEFAULT 'private',
    
    -- Categorization
    category_id UUID REFERENCES public.menu_categories(id) ON DELETE SET NULL,
    
    -- Media
    image_url TEXT,
    
    -- Attributes (allergens, ingredients, etc)
    allergens TEXT[] DEFAULT '{}',
    ingredients TEXT[] DEFAULT '{}',
    dietary_tags TEXT[] DEFAULT '{}', -- vegan, gluten-free, etc
    
    -- SEO & metadata
    slug TEXT,
    seo_title TEXT,
    seo_description TEXT,
    
    -- Sorting & display
    sort_order INTEGER DEFAULT 0,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    is_best_seller BOOLEAN NOT NULL DEFAULT false,
    
    -- Physical attributes (for delivery calculations)
    weight_grams INTEGER,
    
    -- Tax settings
    taxable BOOLEAN NOT NULL DEFAULT true,
    tax_code TEXT, -- For specific tax calculations
    
    -- Source tracking (for migrations)
    source TEXT, -- 'manual', 'menu_import', 'api', 'csv'
    source_id TEXT, -- Original ID if imported
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT unique_sku_per_workspace UNIQUE (workspace_id, sku),
    CONSTRAINT unique_slug_per_workspace UNIQUE (workspace_id, slug),
    CONSTRAINT positive_quantities CHECK (
        quantity >= 0 AND 
        reserved_quantity >= 0 AND
        reserved_quantity <= quantity
    )
);

-- Indexes for performance
CREATE INDEX idx_products_workspace ON public.products(workspace_id);
CREATE INDEX idx_products_org ON public.products(org_id);
CREATE INDEX idx_products_status ON public.products(workspace_id, status);
CREATE INDEX idx_products_visibility ON public.products(workspace_id, visibility);
CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_products_active_visible ON public.products(workspace_id, status, visibility) 
    WHERE status = 'active' AND visibility = 'public';
CREATE INDEX idx_products_sku ON public.products(workspace_id, sku);
CREATE INDEX idx_products_source ON public.products(source, source_id);

-- 2. PRODUCT VARIANTS (for items with options like size, flavor)
CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    
    -- Variant identification
    sku TEXT,
    barcode TEXT,
    
    -- Option values (e.g., "Small", "Large" or "Spicy", "Mild")
    option_1 TEXT,
    option_2 TEXT,
    option_3 TEXT,
    
    -- Pricing override (NULL = inherit from product)
    price_cents INTEGER CHECK (price_cents >= 0),
    compare_at_price_cents INTEGER CHECK (compare_at_price_cents >= 0),
    
    -- Inventory per variant
    track_quantity BOOLEAN NOT NULL DEFAULT false,
    quantity INTEGER NOT NULL DEFAULT 0,
    reserved_quantity INTEGER NOT NULL DEFAULT 0,
    allow_overselling BOOLEAN NOT NULL DEFAULT true,
    
    -- State
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Image override
    image_url TEXT,
    
    -- Weight for shipping
    weight_grams INTEGER,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_variant_sku_per_workspace UNIQUE (product_id, sku)
);

CREATE INDEX idx_variants_product ON public.product_variants(product_id);
CREATE INDEX idx_variants_active ON public.product_variants(product_id, is_active);

-- 3. PRODUCT OPTIONS (define what options a product has)
CREATE TABLE IF NOT EXISTS public.product_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL, -- e.g., "Size", "Flavor"
    position INTEGER NOT NULL DEFAULT 1, -- Display order
    
    -- Values (stored as array for simple options)
    values TEXT[] NOT NULL DEFAULT '{}',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_options_product ON public.product_options(product_id);

-- 4. INVENTORY LOG (Track all stock movements)
CREATE TABLE IF NOT EXISTS public.inventory_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
    
    -- Movement details
    movement_type TEXT NOT NULL CHECK (movement_type IN (
        'initial',      -- Starting inventory
        'restock',      -- Added stock
        'sale',         -- Customer order
        'cancellation', -- Order cancelled, stock returned
        'adjustment',   -- Manual count correction
        'return',       -- Customer return
        'transfer',     -- Transfer to/from location
        'damage'        -- Damaged/spoiled
    )),
    
    quantity_change INTEGER NOT NULL, -- Positive = added, Negative = removed
    previous_quantity INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    
    -- Reference
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    notes TEXT,
    
    -- Who did it
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inventory_logs_product ON public.inventory_logs(product_id);
CREATE INDEX idx_inventory_logs_workspace ON public.inventory_logs(workspace_id);
CREATE INDEX idx_inventory_logs_movement ON public.inventory_logs(movement_type);
CREATE INDEX idx_inventory_logs_created_at ON public.inventory_logs(created_at DESC);

-- 5. SYNC MENU_ITEMS TO PRODUCTS
-- Migration: Create products from existing menu_items
INSERT INTO public.products (
    workspace_id,
    org_id,
    name,
    name_fr,
    name_en,
    description,
    description_fr,
    description_en,
    base_price_cents,
    category_id,
    image_url,
    is_active,
    allergens,
    ingredients,
    sort_order,
    is_best_seller,
    status,
    visibility,
    source,
    source_id,
    taxable,
    track_quantity,
    allow_overselling,
    created_at,
    updated_at
)
SELECT 
    w.id as workspace_id,
    mi.org_id,
    COALESCE(mi.name_en, mi.name_fr) as name,
    mi.name_fr,
    mi.name_en,
    COALESCE(mi.description_en, mi.description_fr) as description,
    mi.description_fr,
    mi.description_en,
    mi.price_cents as base_price_cents,
    mi.category_id,
    mi.image_url,
    mi.is_active,
    mi.allergens,
    mi.ingredients,
    mi.sort_order,
    COALESCE(mi.is_best_seller, false) as is_best_seller,
    CASE WHEN mi.is_active THEN 'active' ELSE 'draft' END as status,
    CASE WHEN mi.is_active THEN 'public' ELSE 'private' END as visibility,
    'menu_import' as source,
    mi.id::text as source_id,
    true as taxable,
    false as track_quantity,
    true as allow_overselling,
    mi.created_at,
    mi.updated_at
FROM menu_items mi
JOIN workspaces w ON w.org_id = mi.org_id
ON CONFLICT (workspace_id, source, source_id) DO UPDATE SET
    name = EXCLUDED.name,
    name_fr = EXCLUDED.name_fr,
    name_en = EXCLUDED.name_en,
    description = EXCLUDED.description,
    description_fr = EXCLUDED.description_fr,
    description_en = EXCLUDED.description_en,
    base_price_cents = EXCLUDED.base_price_cents,
    is_active = EXCLUDED.is_active,
    status = EXCLUDED.status,
    visibility = EXCLUDED.visibility,
    image_url = EXCLUDED.image_url,
    allergens = EXCLUDED.allergens,
    ingredients = EXCLUDED.ingredients,
    sort_order = EXCLUDED.sort_order,
    is_best_seller = EXCLUDED.is_best_seller,
    updated_at = NOW();

-- 6. HELPER FUNCTIONS FOR INVENTORY MANAGEMENT

-- Function to reserve inventory for an order
CREATE OR REPLACE FUNCTION reserve_inventory(
    p_product_id UUID,
    p_quantity INTEGER,
    p_order_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_available INTEGER;
    v_product RECORD;
BEGIN
    SELECT * INTO v_product FROM public.products WHERE id = p_product_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found: %', p_product_id;
    END IF;
    
    -- Calculate available quantity
    v_available := v_product.quantity - v_product.reserved_quantity;
    
    -- Check if enough stock (considering overselling settings)
    IF v_available < p_quantity AND NOT v_product.allow_overselling THEN
        RETURN false; -- Not enough stock
    END IF;
    
    -- Reserve the quantity
    UPDATE public.products 
    SET reserved_quantity = reserved_quantity + p_quantity,
        updated_at = NOW()
    WHERE id = p_product_id;
    
    -- Log the reservation
    INSERT INTO public.inventory_logs (
        workspace_id, product_id, movement_type, quantity_change,
        previous_quantity, new_quantity, order_id, notes
    ) VALUES (
        v_product.workspace_id, p_product_id, 'sale', -p_quantity,
        v_product.quantity - v_product.reserved_quantity,
        v_product.quantity - v_product.reserved_quantity - p_quantity,
        p_order_id,
        'Reserved for order'
    );
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to commit inventory (convert reservation to actual sale)
CREATE OR REPLACE FUNCTION commit_inventory(
    p_product_id UUID,
    p_quantity INTEGER,
    p_order_id UUID
) RETURNS VOID AS $$
DECLARE
    v_product RECORD;
BEGIN
    SELECT * INTO v_product FROM public.products WHERE id = p_product_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found: %', p_product_id;
    END IF;
    
    -- Reduce reserved and actual quantity
    UPDATE public.products 
    SET reserved_quantity = GREATEST(0, reserved_quantity - p_quantity),
        quantity = GREATEST(0, quantity - p_quantity),
        updated_at = NOW()
    WHERE id = p_product_id;
    
    -- Log the commit
    INSERT INTO public.inventory_logs (
        workspace_id, product_id, movement_type, quantity_change,
        previous_quantity, new_quantity, order_id, notes
    ) VALUES (
        v_product.workspace_id, p_product_id, 'sale', 0,
        v_product.quantity,
        GREATEST(0, v_product.quantity - p_quantity),
        p_order_id,
        'Order completed'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to release reserved inventory (order cancelled)
CREATE OR REPLACE FUNCTION release_inventory(
    p_product_id UUID,
    p_quantity INTEGER,
    p_order_id UUID
) RETURNS VOID AS $$
DECLARE
    v_product RECORD;
BEGIN
    SELECT * INTO v_product FROM public.products WHERE id = p_product_id;
    
    IF NOT FOUND THEN
        RETURN; -- Silently ignore if product not found
    END IF;
    
    -- Reduce reserved quantity only
    UPDATE public.products 
    SET reserved_quantity = GREATEST(0, reserved_quantity - p_quantity),
        updated_at = NOW()
    WHERE id = p_product_id;
    
    -- Log the release
    INSERT INTO public.inventory_logs (
        workspace_id, product_id, movement_type, quantity_change,
        previous_quantity, new_quantity, order_id, notes
    ) VALUES (
        v_product.workspace_id, p_product_id, 'cancellation', p_quantity,
        v_product.quantity - v_product.reserved_quantity,
        v_product.quantity - v_product.reserved_quantity + p_quantity,
        p_order_id,
        'Order cancelled'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check product availability
CREATE OR REPLACE FUNCTION check_product_availability(
    p_product_id UUID,
    p_quantity INTEGER DEFAULT 1
) RETURNS TABLE (
    available BOOLEAN,
    in_stock BOOLEAN,
    available_quantity INTEGER,
    low_stock BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_product RECORD;
    v_available_qty INTEGER;
BEGIN
    SELECT * INTO v_product FROM public.products WHERE id = p_product_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, false, 0, false, 'Product not found'::TEXT;
        RETURN;
    END IF;
    
    -- Check if product is active and visible
    IF v_product.status != 'active' THEN
        RETURN QUERY SELECT false, false, 0, false, 'Product is not active'::TEXT;
        RETURN;
    END IF;
    
    -- Calculate available quantity
    v_available_qty := GREATEST(0, v_product.quantity - v_product.reserved_quantity);
    
    -- Check stock status
    IF NOT v_product.track_quantity OR v_product.allow_overselling THEN
        -- Inventory not tracked or overselling allowed
        RETURN QUERY SELECT 
            true, 
            true, 
            999999, -- Effectively unlimited
            false,
            'Product available'::TEXT;
    ELSIF v_available_qty >= p_quantity THEN
        -- Sufficient stock
        RETURN QUERY SELECT 
            true, 
            true, 
            v_available_qty, 
            v_available_qty <= v_product.low_stock_threshold,
            'Product available'::TEXT;
    ELSE
        -- Out of stock
        RETURN QUERY SELECT 
            false, 
            false, 
            v_available_qty, 
            true,
            'Insufficient stock'::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. UPDATE ORDER_ITEMS TO REFERENCE PRODUCTS
-- Ensure order_items can reference products properly
ALTER TABLE public.order_items 
    ALTER COLUMN product_id TYPE UUID USING product_id::UUID,
    ADD CONSTRAINT fk_order_items_product 
        FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

-- 8. RLS POLICIES FOR PRODUCTS

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;

-- Products: Workspace members can manage their products
CREATE POLICY "Workspace members can manage products" ON public.products
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_memberships wm
            WHERE wm.workspace_id = products.workspace_id
            AND wm.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.workspace_memberships wm
            WHERE wm.workspace_id = products.workspace_id
            AND wm.user_id = auth.uid()
        )
    );

-- Products: Public can view active public products
CREATE POLICY "Public can view active products" ON public.products
    FOR SELECT
    TO anon
    USING (status = 'active' AND visibility = 'public');

-- Variants: Same rules as products
CREATE POLICY "Workspace members can manage variants" ON public.product_variants
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.products p
            JOIN public.workspace_memberships wm ON wm.workspace_id = p.workspace_id
            WHERE p.id = product_variants.product_id
            AND wm.user_id = auth.uid()
        )
    );

-- Options: Same rules as products
CREATE POLICY "Workspace members can manage options" ON public.product_options
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.products p
            JOIN public.workspace_memberships wm ON wm.workspace_id = p.workspace_id
            WHERE p.id = product_options.product_id
            AND wm.user_id = auth.uid()
        )
    );

-- Inventory logs: Workspace members can view their logs
CREATE POLICY "Workspace members can view inventory logs" ON public.inventory_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_memberships wm
            WHERE wm.workspace_id = inventory_logs.workspace_id
            AND wm.user_id = auth.uid()
        )
    );

-- 9. TRIGGERS FOR UPDATED_AT
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_variants_updated_at
    BEFORE UPDATE ON public.product_variants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_options_updated_at
    BEFORE UPDATE ON public.product_options
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 10. SYNC TRIGGER: Keep menu_items and products in sync
CREATE OR REPLACE FUNCTION sync_menu_item_to_product()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.products (
        workspace_id,
        org_id,
        name,
        name_fr,
        name_en,
        description_fr,
        description_en,
        base_price_cents,
        category_id,
        image_url,
        is_active,
        allergens,
        ingredients,
        sort_order,
        is_best_seller,
        status,
        visibility,
        source,
        source_id,
        taxable,
        track_quantity,
        allow_overselling,
        created_at,
        updated_at
    )
    SELECT 
        w.id,
        NEW.org_id,
        COALESCE(NEW.name_en, NEW.name_fr),
        NEW.name_fr,
        NEW.name_en,
        NEW.description_fr,
        NEW.description_en,
        NEW.price_cents,
        NEW.category_id,
        NEW.image_url,
        NEW.is_active,
        NEW.allergens,
        NEW.ingredients,
        NEW.sort_order,
        COALESCE(NEW.is_best_seller, false),
        CASE WHEN NEW.is_active THEN 'active' ELSE 'draft' END,
        CASE WHEN NEW.is_active THEN 'public' ELSE 'private' END,
        'menu_import',
        NEW.id::text,
        true,
        false,
        true,
        NEW.created_at,
        NEW.updated_at
    FROM workspaces w WHERE w.org_id = NEW.org_id
    ON CONFLICT (workspace_id, source, source_id) DO UPDATE SET
        name = EXCLUDED.name,
        name_fr = EXCLUDED.name_fr,
        name_en = EXCLUDED.name_en,
        description_fr = EXCLUDED.description_fr,
        description_en = EXCLUDED.description_en,
        base_price_cents = EXCLUDED.base_price_cents,
        is_active = EXCLUDED.is_active,
        status = EXCLUDED.status,
        visibility = EXCLUDED.visibility,
        image_url = EXCLUDED.image_url,
        allergens = EXCLUDED.allergens,
        ingredients = EXCLUDED.ingredients,
        sort_order = EXCLUDED.sort_order,
        is_best_seller = EXCLUDED.is_best_seller,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on menu_items (if not exists)
DROP TRIGGER IF EXISTS sync_menu_item_to_product_trigger ON menu_items;
CREATE TRIGGER sync_menu_item_to_product_trigger
    AFTER INSERT OR UPDATE ON menu_items
    FOR EACH ROW EXECUTE FUNCTION sync_menu_item_to_product();

-- Comment explaining the migration
COMMENT ON TABLE public.products IS 'Unified product catalog - single source of truth for all sellable items';
COMMENT ON TABLE public.product_variants IS 'Product variants (size, flavor, etc) with separate inventory tracking';
COMMENT ON TABLE public.product_options IS 'Product options definitions (e.g., Size: Small, Medium, Large)';
COMMENT ON TABLE public.inventory_logs IS 'Audit trail of all inventory movements';
