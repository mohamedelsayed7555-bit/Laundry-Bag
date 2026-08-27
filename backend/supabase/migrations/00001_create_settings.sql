-- Settings table: dynamic configuration for the platform
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default settings
INSERT INTO settings (key, value, description) VALUES
  ('min_order_items', '4', 'الحد الأدنى لعدد القطع في الأوردر'),
  ('delivery_fee', '20', 'رسوم التوصيل بالجنيه'),
  ('cancellation_fee_type', '"delivery_only"', 'نوع رسوم الإلغاء'),
  ('working_hours', '{"from": "09:00", "to": "22:00"}', 'ساعات العمل');
