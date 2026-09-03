-- Replace expire_subscriptions to handle auto-renewal
CREATE OR REPLACE FUNCTION expire_subscriptions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sub RECORD;
  new_start DATE;
  new_end DATE;
  months_count INTEGER;
  new_limit INTEGER;
  plan_monthly INTEGER;
BEGIN
  -- First: auto-renew eligible subscriptions
  FOR sub IN
    SELECT s.*, p.items_per_month, p.monthly_price, p.name as plan_name
    FROM subscriptions s
    JOIN plans p ON p.id = s.plan_id
    WHERE s.status = 'active'
      AND s.end_date <= CURRENT_DATE
      AND s.auto_renew = true
      AND p.is_active = true
  LOOP
    months_count := CASE sub.duration
      WHEN 'monthly' THEN 1
      WHEN 'quarterly' THEN 3
      WHEN 'biannual' THEN 6
      WHEN 'annual' THEN 12
      ELSE 1
    END;

    new_start := CURRENT_DATE;
    new_end := CURRENT_DATE + (months_count || ' months')::INTERVAL;
    new_limit := sub.items_per_month * months_count;

    UPDATE subscriptions
    SET start_date = new_start,
        end_date = new_end,
        items_used = 0,
        items_limit = new_limit
    WHERE id = sub.id;

    -- Notify user
    INSERT INTO notifications (user_id, title, body, type, data, sent_at)
    VALUES (
      sub.user_id,
      'تم تجديد اشتراكك تلقائياً',
      'تم تجديد باقة ' || sub.plan_name || ' تلقائياً. رصيدك ' || new_limit || ' قطعة.',
      'system',
      jsonb_build_object('subscription_id', sub.id),
      NOW()
    );
  END LOOP;

  -- Then: expire non-renewable subscriptions
  UPDATE subscriptions
  SET status = 'expired'
  WHERE status = 'active'
    AND end_date <= CURRENT_DATE
    AND (auto_renew = false OR plan_id NOT IN (SELECT id FROM plans WHERE is_active = true));
END;
$$;
