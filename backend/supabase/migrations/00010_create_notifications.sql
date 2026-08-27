-- Notifications table: in-app + push + SMS tracking
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id),
  user_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR NOT NULL,
  body TEXT NOT NULL,
  type VARCHAR NOT NULL CHECK (type IN ('order', 'offer', 'reminder', 'system')),
  data JSONB DEFAULT '{}',
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_read ON notifications(user_id, read_at) WHERE read_at IS NULL;
