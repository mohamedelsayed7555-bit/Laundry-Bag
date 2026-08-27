-- Seed data for development/testing

-- Prices: item_type × service_type
INSERT INTO prices (item_type, service_type, price) VALUES
  -- قمصان
  ('قميص', 'wash', 15.00),
  ('قميص', 'iron', 10.00),
  ('قميص', 'wash_iron', 20.00),
  ('قميص', 'dry_clean', 30.00),
  -- بنطلون
  ('بنطلون', 'wash', 20.00),
  ('بنطلون', 'iron', 12.00),
  ('بنطلون', 'wash_iron', 25.00),
  ('بنطلون', 'dry_clean', 35.00),
  -- تيشيرت
  ('تيشيرت', 'wash', 12.00),
  ('تيشيرت', 'iron', 8.00),
  ('تيشيرت', 'wash_iron', 15.00),
  ('تيشيرت', 'dry_clean', 25.00),
  -- بدلة
  ('بدلة', 'wash', 40.00),
  ('بدلة', 'iron', 25.00),
  ('بدلة', 'wash_iron', 50.00),
  ('بدلة', 'dry_clean', 60.00),
  -- فستان
  ('فستان', 'wash', 30.00),
  ('فستان', 'iron', 20.00),
  ('فستان', 'wash_iron', 40.00),
  ('فستان', 'dry_clean', 50.00),
  -- ملاية سرير
  ('ملاية سرير', 'wash', 25.00),
  ('ملاية سرير', 'iron', 15.00),
  ('ملاية سرير', 'wash_iron', 30.00),
  -- ستارة
  ('ستارة', 'wash', 35.00),
  ('ستارة', 'iron', 20.00),
  ('ستارة', 'wash_iron', 45.00),
  ('ستارة', 'dry_clean', 55.00);

-- Plans
INSERT INTO plans (name, description, tier, items_per_month, monthly_price, quarterly_price, biannual_price, annual_price) VALUES
  ('فردي', 'باقة للأفراد - 20 قطعة شهرياً', 'individual', 20, 200.00, 540.00, 1020.00, 1920.00),
  ('زوجي', 'باقة للأزواج - 40 قطعة شهرياً', 'couple', 40, 350.00, 945.00, 1785.00, 3360.00),
  ('عائلي', 'باقة عائلية - 70 قطعة شهرياً', 'family', 70, 550.00, 1485.00, 2805.00, 5280.00),
  ('بريميوم', 'باقة مميزة - 120 قطعة شهرياً + أولوية', 'premium', 120, 900.00, 2430.00, 4590.00, 8640.00);
