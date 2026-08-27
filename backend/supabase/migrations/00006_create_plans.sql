-- Plans table: subscription tiers and pricing
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  description TEXT,
  tier VARCHAR NOT NULL CHECK (tier IN ('individual', 'couple', 'family', 'premium')),
  items_per_month INTEGER NOT NULL,
  includes_all_services BOOLEAN DEFAULT TRUE,
  monthly_price DECIMAL(10, 2) NOT NULL,
  quarterly_price DECIMAL(10, 2),
  biannual_price DECIMAL(10, 2),
  annual_price DECIMAL(10, 2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
