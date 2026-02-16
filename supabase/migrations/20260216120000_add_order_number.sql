-- Add Shopify-style incremental order numbers
-- Keep UUID as primary key, add human-readable order_number

-- Create sequence starting at 10001
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 10001;

-- Add order_number column with default from sequence
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS order_number BIGINT DEFAULT nextval('order_number_seq') UNIQUE NOT NULL;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

-- Backfill existing orders with sequential numbers
DO $$
DECLARE
  order_record RECORD;
  counter INT := 10001;
BEGIN
  FOR order_record IN 
    SELECT id FROM orders WHERE order_number IS NULL ORDER BY created_at ASC
  LOOP
    UPDATE orders SET order_number = counter WHERE id = order_record.id;
    counter := counter + 1;
  END LOOP;
  
  -- Update sequence to continue from last assigned number
  PERFORM setval('order_number_seq', counter);
END $$;

-- Add comment
COMMENT ON COLUMN orders.order_number IS 'Human-readable sequential order number (Shopify-style)';
