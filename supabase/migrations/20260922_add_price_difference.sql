ALTER TABLE orders ADD COLUMN IF NOT EXISTS price_difference numeric DEFAULT 0;
COMMENT ON COLUMN orders.price_difference IS 'Price difference after order edit — positive means customer owes more, negative means refund';
