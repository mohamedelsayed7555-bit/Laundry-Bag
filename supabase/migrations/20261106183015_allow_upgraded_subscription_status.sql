-- finish_subscription_upgrade() marks the subscription a customer upgraded away from
-- as 'upgraded', but the status check never allowed that value. The trigger fires
-- AFTER UPDATE OF status, so activating any subscription that replaces another one
-- failed the whole transaction with a check violation and the plan was never
-- activated - from the subscriptions page and from the task centre alike.
--
-- The value is the useful one: it keeps an upgrade distinguishable from a plain
-- cancellation in the history, so the constraint is widened to accept it rather
-- than the trigger being changed to lie.
alter table public.subscriptions drop constraint subscriptions_status_check;

alter table public.subscriptions add constraint subscriptions_status_check
  check (status::text = any (array[
    'pending'::text, 'active'::text, 'paused'::text,
    'cancelled'::text, 'expired'::text, 'upgraded'::text
  ]));
