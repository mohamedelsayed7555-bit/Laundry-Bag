-- Users table: customers, drivers, and admins
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_code VARCHAR UNIQUE,
  branch_id UUID REFERENCES branches(id),
  name VARCHAR NOT NULL,
  phone VARCHAR UNIQUE NOT NULL,
  email VARCHAR,
  role VARCHAR NOT NULL CHECK (role IN ('customer', 'driver', 'admin')),
  tier VARCHAR DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  points INTEGER DEFAULT 0,
  fcm_token TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-generate customer code: CLN-00001, CLN-00002, ...
CREATE OR REPLACE FUNCTION generate_customer_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'customer' THEN
    NEW.customer_code := 'CLN-' || LPAD(
      (SELECT COALESCE(MAX(SUBSTRING(customer_code FROM 5)::INTEGER), 0) + 1 FROM users WHERE customer_code IS NOT NULL)::TEXT,
      5, '0'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_customer_code
  BEFORE INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION generate_customer_code();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_code ON users(customer_code);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_branch ON users(branch_id);
