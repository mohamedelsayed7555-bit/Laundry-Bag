-- Fix: Remove auto-renewal logic from SQL function to avoid conflict with subscription-cron edge function.
-- The edge function handles auto-renewal WITH payment re-collection.
-- This SQL function now ONLY expires non-renewable subscriptions.

CREATE OR REPLACE FUNCTION expire_subscriptions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Expire non-renewable subscriptions that passed their end date
  UPDATE subscriptions
  SET status = 'expired'
  WHERE status = 'active'
    AND end_date <= CURRENT_DATE
    AND (auto_renew = false OR plan_id NOT IN (SELECT id FROM plans WHERE is_active = true));
END;
$$;
