-- Migration: Sync RLS policies to match production Supabase
-- These policies were added via Dashboard but missing from migration files
-- Uses DROP IF EXISTS + CREATE to be idempotent

-- ============================================================
-- 1. ORDERS
-- ============================================================

-- orders_admin: expand to super_admin, manager, accountant
DROP POLICY IF EXISTS "orders_admin" ON orders;
CREATE POLICY "orders_admin" ON orders FOR ALL TO authenticated
  USING (public.get_user_role() IN ('admin', 'super_admin', 'manager', 'accountant'))
  WITH CHECK (public.get_user_role() IN ('admin', 'super_admin', 'manager', 'accountant'));

-- orders_customer_update: allow cancel on assigned/picked_up too
DROP POLICY IF EXISTS "orders_customer_update" ON orders;
CREATE POLICY "orders_customer_update" ON orders FOR UPDATE TO authenticated
  USING (customer_id = auth.uid() AND status IN ('pending', 'assigned', 'picked_up'));

-- orders_driver_update: driver can update status on their orders
DROP POLICY IF EXISTS "orders_driver_update" ON orders;
CREATE POLICY "orders_driver_update" ON orders FOR UPDATE TO authenticated
  USING (driver_id = auth.uid())
  WITH CHECK (driver_id = auth.uid());

-- ============================================================
-- 2. DRIVER_LOCATIONS
-- ============================================================

-- Driver can upsert their own location
DROP POLICY IF EXISTS "Drivers can upsert their own location" ON driver_locations;
DROP POLICY IF EXISTS "driver_locations_write" ON driver_locations;
DROP POLICY IF EXISTS "driver_locations_driver_all" ON driver_locations;
CREATE POLICY "driver_locations_driver_all" ON driver_locations FOR ALL TO authenticated
  USING (auth.uid() = driver_id)
  WITH CHECK (auth.uid() = driver_id);

-- Customers read driver location for active orders, admin/driver reads own
DROP POLICY IF EXISTS "customers_read_assigned_driver_location" ON driver_locations;
DROP POLICY IF EXISTS "driver_locations_read" ON driver_locations;
DROP POLICY IF EXISTS "driver_locations_customer_read" ON driver_locations;
CREATE POLICY "driver_locations_customer_read" ON driver_locations FOR SELECT TO authenticated
  USING (
    auth.uid() = driver_id
    OR public.get_user_role() IN ('admin', 'super_admin', 'manager')
    OR EXISTS (
      SELECT 1 FROM orders
      WHERE orders.driver_id = driver_locations.driver_id
        AND orders.customer_id = auth.uid()
        AND orders.status IN ('assigned', 'picked_up', 'processing', 'ready', 'delivering')
    )
  );

-- ============================================================
-- 3. SETTINGS / BRANCHES / USERS — expand admin roles
-- ============================================================

DROP POLICY IF EXISTS "settings_admin" ON settings;
CREATE POLICY "settings_admin" ON settings FOR ALL TO authenticated
  USING (public.get_user_role() IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "branches_admin" ON branches;
CREATE POLICY "branches_admin" ON branches FOR ALL TO authenticated
  USING (public.get_user_role() IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "users_admin" ON users;
CREATE POLICY "users_admin" ON users FOR ALL TO authenticated
  USING (public.get_user_role() IN ('admin', 'super_admin'));

-- ============================================================
-- 4. DRIVER_LOCATIONS SCHEMA — add heading column
-- ============================================================

ALTER TABLE driver_locations ADD COLUMN IF NOT EXISTS heading numeric;
