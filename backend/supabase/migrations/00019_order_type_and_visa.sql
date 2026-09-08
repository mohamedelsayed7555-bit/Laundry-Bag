-- Add order_type column to distinguish regular, subscription, and bag_offer orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type VARCHAR DEFAULT 'regular' NOT NULL
  CHECK (order_type IN ('regular', 'subscription', 'bag_offer'));

-- Backfill existing orders: if has subscription_id, mark as subscription
UPDATE orders SET order_type = 'subscription' WHERE subscription_id IS NOT NULL AND order_type = 'regular';

-- Expand payment_method to include visa
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('cash', 'instapay', 'wallet', 'visa', 'e_wallet'));
