-- Orders table: core business entity
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR UNIQUE NOT NULL,
  branch_id UUID REFERENCES branches(id),
  customer_id UUID NOT NULL REFERENCES users(id),
  driver_id UUID REFERENCES users(id),
  subscription_id UUID REFERENCES subscriptions(id),
  status VARCHAR DEFAULT 'pending' NOT NULL CHECK (status IN (
    'pending', 'assigned', 'picked_up', 'processing', 'ready', 'delivering', 'delivered', 'cancelled', 'refunded'
  )),
  payment_method VARCHAR NOT NULL CHECK (payment_method IN ('cash', 'instapay', 'wallet')),
  payment_status VARCHAR DEFAULT 'pending' NOT NULL CHECK (payment_status IN ('pending', 'confirmed', 'refunded')),
  payment_ref VARCHAR,
  items JSONB NOT NULL DEFAULT '[]',
  items_count INTEGER NOT NULL,
  confirmed_count INTEGER,
  subtotal DECIMAL(10, 2) NOT NULL,
  discount DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  delivery_location JSONB NOT NULL,
  address_id UUID REFERENCES addresses(id),
  scheduled_at TIMESTAMPTZ,
  label_qr_data VARCHAR,
  label_generated_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  rating_service SMALLINT CHECK (rating_service BETWEEN 1 AND 5),
  rating_driver SMALLINT CHECK (rating_driver BETWEEN 1 AND 5),
  rating_note TEXT,
  rated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-generate order number: #1000, #1001, ...
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number := '#' || LPAD(
    (SELECT COALESCE(MAX(SUBSTRING(order_number FROM 2)::INTEGER), 999) + 1 FROM orders)::TEXT,
    4, '0'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION generate_order_number();

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_driver ON orders(driver_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_branch ON orders(branch_id);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_scheduled ON orders(scheduled_at);
