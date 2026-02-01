-- Add Stripe financial fields to orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS stripe_charge_id text,
ADD COLUMN IF NOT EXISTS stripe_balance_transaction_id text,
ADD COLUMN IF NOT EXISTS stripe_fee_amount integer, -- in cents
ADD COLUMN IF NOT EXISTS stripe_net_amount integer, -- in cents
ADD COLUMN IF NOT EXISTS stripe_currency text;

-- Add comment for clarity
COMMENT ON COLUMN public.orders.stripe_fee_amount IS 'Stripe processing fee in cents';
COMMENT ON COLUMN public.orders.stripe_net_amount IS 'Net amount available in Stripe balance in cents';
