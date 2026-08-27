-- Subscriptions table: active user plans
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  plan_id UUID NOT NULL REFERENCES plans(id),
  branch_id UUID REFERENCES branches(id),
  duration VARCHAR NOT NULL CHECK (duration IN ('monthly', 'quarterly', 'biannual', 'annual')),
  status VARCHAR DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'expired')),
  items_used INTEGER DEFAULT 0,
  items_limit INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  auto_renew BOOLEAN DEFAULT TRUE,
  payment_method VARCHAR,
  total_paid DECIMAL(10, 2),
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
