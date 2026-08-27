-- AI profiles: per-customer analytics for smart predictions
CREATE TABLE ai_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  avg_cycle_days DECIMAL(5, 2),
  preferred_day SMALLINT CHECK (preferred_day BETWEEN 0 AND 6),
  preferred_time VARCHAR CHECK (preferred_time IN ('morning', 'afternoon', 'evening')),
  churn_risk VARCHAR DEFAULT 'low' CHECK (churn_risk IN ('low', 'medium', 'high')),
  segment VARCHAR DEFAULT 'new' CHECK (segment IN ('new', 'regular', 'vip', 'inactive')),
  total_orders INTEGER DEFAULT 0,
  total_spent DECIMAL(10, 2) DEFAULT 0,
  last_offer_at TIMESTAMPTZ,
  last_order_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER ai_profiles_updated_at
  BEFORE UPDATE ON ai_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_ai_profiles_churn ON ai_profiles(churn_risk);
CREATE INDEX idx_ai_profiles_segment ON ai_profiles(segment);
