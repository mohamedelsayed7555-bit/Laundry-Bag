-- Branches table: multi-branch ready from day one
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  address TEXT,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  phone VARCHAR,
  is_active BOOLEAN DEFAULT TRUE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default branch
INSERT INTO branches (name, address, phone) VALUES
  ('الفرع الرئيسي', 'القاهرة', '+201000000000');
