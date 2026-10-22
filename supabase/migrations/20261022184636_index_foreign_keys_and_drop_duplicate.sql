-- Foreign keys with nothing to look them up by: changing or removing a parent row
-- means reading the whole child table, and the apps filter on several of these
-- columns directly.
create index if not exists idx_orders_address on public.orders (address_id);
create index if not exists idx_orders_subscription on public.orders (subscription_id);
create index if not exists idx_orders_pickup_driver on public.orders (pickup_driver_id);
create index if not exists idx_orders_delivery_driver on public.orders (delivery_driver_id);
create index if not exists idx_orders_coupon on public.orders (coupon_id);

create index if not exists idx_coupon_usage_coupon on public.coupon_usage (coupon_id);
create index if not exists idx_coupon_usage_user on public.coupon_usage (user_id);
create index if not exists idx_coupon_usage_order on public.coupon_usage (order_id);

create index if not exists idx_subscriptions_plan on public.subscriptions (plan_id);
create index if not exists idx_subscriptions_branch on public.subscriptions (branch_id);
create index if not exists idx_subscriptions_replaces on public.subscriptions (replaces_subscription_id);

create index if not exists idx_notifications_branch on public.notifications (branch_id);
create index if not exists idx_order_history_changed_by on public.order_status_history (changed_by);
create index if not exists idx_prices_category on public.prices (category_id);
create index if not exists idx_broadcast_sent_by on public.broadcast_messages (sent_by);
create index if not exists idx_reset_codes_issued_by on public.password_reset_codes (issued_by);

-- Two indexes over the same column: the second only costs write time.
drop index if exists public.idx_audit_logs_created;
