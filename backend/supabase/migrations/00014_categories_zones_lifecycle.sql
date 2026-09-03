-- Migration: Categories, Zone/Delivery, Order Lifecycle & Driver Assignment
-- Applied: 2026-09-03

-- 1. Categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL UNIQUE,
  icon varchar(10) DEFAULT '👕',
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "categories_read" ON categories FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "categories_admin" ON categories FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','super_admin'))
);
ALTER TABLE prices ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES categories(id) ON DELETE SET NULL;

-- 2. Order scheduling
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_scheduled boolean DEFAULT false;

-- 3. Zone & delivery
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_location jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_distance_km numeric;

-- 4. Driver assignment
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_driver_id uuid REFERENCES users(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_driver_id uuid REFERENCES users(id);

CREATE TABLE IF NOT EXISTS driver_locations (
  driver_id uuid PRIMARY KEY REFERENCES users(id),
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;

-- 5. Zone settings
INSERT INTO settings (key, value) VALUES
  ('max_zone_km', '30'),
  ('price_per_km', '2'),
  ('base_delivery_km', '5'),
  ('laundry_lat', '30.0444'),
  ('laundry_lng', '31.2357')
ON CONFLICT (key) DO NOTHING;

-- 6. Order cancellation
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_fee numeric DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
