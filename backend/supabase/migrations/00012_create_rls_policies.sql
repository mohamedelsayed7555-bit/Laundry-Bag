-- Enable RLS on all tables
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_profiles ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Settings: read-only for all authenticated, write for admin
CREATE POLICY "settings_read" ON settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_admin" ON settings FOR ALL TO authenticated USING (public.get_user_role() = 'admin');

-- Branches: read for all, write for admin
CREATE POLICY "branches_read" ON branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "branches_admin" ON branches FOR ALL TO authenticated USING (public.get_user_role() = 'admin');

-- Users: see own profile, admin sees all
CREATE POLICY "users_own" ON users FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "users_admin" ON users FOR ALL TO authenticated USING (public.get_user_role() = 'admin');
CREATE POLICY "users_insert" ON users FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "users_update_own" ON users FOR UPDATE TO authenticated USING (id = auth.uid());

-- Addresses: own only
CREATE POLICY "addresses_own" ON addresses FOR ALL TO authenticated USING (user_id = auth.uid());

-- Prices: read for all, write for admin
CREATE POLICY "prices_read" ON prices FOR SELECT TO authenticated USING (true);
CREATE POLICY "prices_admin" ON prices FOR ALL TO authenticated USING (public.get_user_role() = 'admin');

-- Plans: read for all, write for admin
CREATE POLICY "plans_read" ON plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "plans_admin" ON plans FOR ALL TO authenticated USING (public.get_user_role() = 'admin');

-- Subscriptions: own or admin
CREATE POLICY "subscriptions_own" ON subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.get_user_role() = 'admin');
CREATE POLICY "subscriptions_admin" ON subscriptions FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');

-- Orders: customer sees own, driver sees assigned, admin sees all
CREATE POLICY "orders_customer" ON orders FOR SELECT TO authenticated
  USING (customer_id = auth.uid());
CREATE POLICY "orders_driver" ON orders FOR SELECT TO authenticated
  USING (driver_id = auth.uid());
CREATE POLICY "orders_admin" ON orders FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');
CREATE POLICY "orders_customer_insert" ON orders FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid());
CREATE POLICY "orders_customer_update" ON orders FOR UPDATE TO authenticated
  USING (customer_id = auth.uid() AND status IN ('pending'));

-- Order status history: follows order access
CREATE POLICY "order_history_read" ON order_status_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_id
        AND (orders.customer_id = auth.uid() OR orders.driver_id = auth.uid() OR public.get_user_role() = 'admin')
    )
  );
CREATE POLICY "order_history_admin" ON order_status_history FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'driver'));

-- Notifications: own only
CREATE POLICY "notifications_own" ON notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "notifications_admin" ON notifications FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');

-- AI profiles: admin only
CREATE POLICY "ai_profiles_admin" ON ai_profiles FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');
