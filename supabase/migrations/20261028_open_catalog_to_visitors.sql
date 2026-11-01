-- App Review rejected the iPhone app under guideline 5.1.1(v): it asked for an account
-- before showing anything. The customer app now lets a visitor look at services,
-- prices and plans first and asks for an account only to order or subscribe.
--
-- prices, plans and settings were readable by signed-in users only, so a visitor saw
-- an empty catalogue. Open the active prices and plans, and only the settings the
-- browseable screens need. Everything else in settings (payment numbers, provider
-- keys, internal switches) stays behind sign-in.

drop policy if exists prices_select_visitors on public.prices;
create policy prices_select_visitors on public.prices
  for select to anon
  using (is_active);

drop policy if exists plans_select_visitors on public.plans;
create policy plans_select_visitors on public.plans
  for select to anon
  using (is_active);

drop policy if exists settings_select_visitors on public.settings;
create policy settings_select_visitors on public.settings
  for select to anon
  using (key = any (array[
    -- home
    'bag_offer', 'contact_info', 'brand_color',
    -- new order: working hours
    'open_hour', 'close_hour', 'working_hours_enabled',
    -- cart: delivery fee, service zone, minimum order, payment methods on offer
    'delivery_fee', 'max_zone_km', 'price_per_km', 'base_delivery_km',
    'laundry_lat', 'laundry_lng', 'min_order_items', 'payment_methods',
    -- plans: multi-month discounts
    'discount_quarterly', 'discount_biannual', 'discount_annual',
    -- sign-up
    'welcome_gift_enabled'
  ]));
