-- Customer marketing + checkout readiness

-- Drop legacy automation that depended on old customer stats columns
DROP TRIGGER IF EXISTS update_customer_stats_on_order ON orders;
DROP FUNCTION IF EXISTS update_customer_stats();

-- Ensure emails stored lowercase before enforcing constraint
UPDATE customers
SET email = lower(email)
WHERE email IS NOT NULL AND email <> lower(email);

-- Extend customers table with new schema
ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS first_name text,
    ADD COLUMN IF NOT EXISTS last_name text,
    ADD COLUMN IF NOT EXISTS default_address jsonb DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS marketing_opt_in boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS marketing_opt_in_at timestamptz,
    ADD COLUMN IF NOT EXISTS source text DEFAULT 'checkout';

-- Backfill new name + marketing fields from legacy data
UPDATE customers
SET
    first_name = COALESCE(first_name, NULLIF(split_part(coalesce(name, ''), ' ', 1), '')),
    last_name = COALESCE(
        last_name,
        NULLIF(
            btrim(
                regexp_replace(coalesce(name, ''), '^' || regexp_replace(split_part(coalesce(name, ''), ' ', 1), '(\W)', '\\1', 'g') || '\s*', '')
            ),
            ''
        )
    ),
    marketing_opt_in = COALESCE(marketing_opt_in, email_marketing_consent, false),
    marketing_opt_in_at = CASE
        WHEN COALESCE(marketing_opt_in, email_marketing_consent, false)
             AND marketing_opt_in_at IS NULL THEN COALESCE(updated_at, created_at, now())
        ELSE marketing_opt_in_at
    END,
    source = COALESCE(source, 'legacy');

-- Enforce lowercase uniqueness for emails per org
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_email_lowercase_check;
ALTER TABLE customers ADD CONSTRAINT customers_email_lowercase_check CHECK (email IS NULL OR email = lower(email));

ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_org_id_email_key;
ALTER TABLE customers
    ADD CONSTRAINT customers_org_id_email_key UNIQUE (org_id, email);

-- Remove legacy stats columns that are now computed on demand
ALTER TABLE customers
    DROP COLUMN IF EXISTS name,
    DROP COLUMN IF EXISTS total_orders,
    DROP COLUMN IF EXISTS total_spent_cents,
    DROP COLUMN IF EXISTS average_order_cents,
    DROP COLUMN IF EXISTS last_order_at,
    DROP COLUMN IF EXISTS first_order_at,
    DROP COLUMN IF EXISTS favorite_items,
    DROP COLUMN IF EXISTS preferred_fulfillment_type,
    DROP COLUMN IF EXISTS email_marketing_consent,
    DROP COLUMN IF EXISTS sms_marketing_consent;

-- Orders now reference canonical customers + store email snapshots and idempotency key
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS customer_email_snapshot text,
    ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS orders_org_id_idempotency_idx
    ON orders(org_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- Populate snapshots + customer links for historical data
UPDATE orders
SET customer_email_snapshot = lower(customer_email)
WHERE customer_email IS NOT NULL AND customer_email_snapshot IS NULL;

UPDATE orders o
SET customer_id = c.id
FROM customers c
WHERE o.customer_id IS NULL
  AND c.org_id = o.org_id
  AND c.email = lower(o.customer_email);

-- Helper function to surface customer stats per org
CREATE OR REPLACE FUNCTION list_customers_with_stats(
    p_org_id uuid,
    p_search text DEFAULT NULL,
    p_sort text DEFAULT 'last_order_at',
    p_limit integer DEFAULT 50,
    p_offset integer DEFAULT 0
) RETURNS TABLE (
    id uuid,
    email text,
    first_name text,
    last_name text,
    phone text,
    default_address jsonb,
    marketing_opt_in boolean,
    marketing_opt_in_at timestamptz,
    source text,
    created_at timestamptz,
    updated_at timestamptz,
    total_orders bigint,
    total_spent_cents bigint,
    average_order_cents integer,
    last_order_at timestamptz
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    WITH filtered AS (
        SELECT *
        FROM customers
        WHERE org_id = p_org_id
          AND (
            p_search IS NULL OR p_search = '' OR
            email ILIKE '%' || p_search || '%' OR
            COALESCE(first_name, '') || ' ' || COALESCE(last_name, '') ILIKE '%' || p_search || '%' OR
            COALESCE(phone, '') ILIKE '%' || p_search || '%'
          )
    )
    SELECT
        c.id,
        c.email,
        c.first_name,
        c.last_name,
        c.phone,
        c.default_address,
        c.marketing_opt_in,
        c.marketing_opt_in_at,
        c.source,
        c.created_at,
        c.updated_at,
        COALESCE(COUNT(o.id), 0) AS total_orders,
        COALESCE(SUM(o.total_cents), 0) AS total_spent_cents,
        COALESCE(AVG(o.total_cents)::int, 0) AS average_order_cents,
        MAX(o.created_at) AS last_order_at
    FROM filtered c
    LEFT JOIN orders o ON o.customer_id = c.id
    GROUP BY c.id
    ORDER BY
        CASE WHEN p_sort = 'total_spent' THEN COALESCE(SUM(o.total_cents), 0) END DESC NULLS LAST,
        CASE WHEN p_sort = 'order_count' THEN COALESCE(COUNT(o.id), 0) END DESC NULLS LAST,
        CASE WHEN p_sort = 'last_order_at' THEN MAX(o.created_at) END DESC NULLS LAST,
        c.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Convenience function for exporting opted-in marketing customers
CREATE OR REPLACE FUNCTION export_marketing_customers(p_org_id uuid)
RETURNS TABLE (
    email text,
    first_name text,
    last_name text,
    phone text,
    last_order_at timestamptz,
    total_orders bigint
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.email,
        c.first_name,
        c.last_name,
        c.phone,
        MAX(o.created_at) AS last_order_at,
        COALESCE(COUNT(o.id), 0) AS total_orders
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id
    WHERE c.org_id = p_org_id
      AND c.marketing_opt_in = true
    GROUP BY c.id
    ORDER BY c.last_name NULLS LAST, c.first_name NULLS LAST;
END;
$$;
