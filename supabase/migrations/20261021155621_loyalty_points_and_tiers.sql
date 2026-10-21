-- Points and tiers.
--
-- Two decisions shape everything here. Points are awarded only when an order is actually
-- delivered and paid, so a cancellation can never leave points behind. And every change
-- is written as a row, not just added to a balance: when a customer says his points are
-- wrong, there has to be something to show him.
--
-- The rates start deliberately low. Raising a reward later pleases people; cutting one
-- does not. They live in settings rather than in code so they can be tuned without an
-- app release.

insert into settings (key, value, description)
select 'loyalty',
       '{
          "egp_per_point": 20,
          "points_per_egp_redeemed": 10,
          "tiers": [
            {"code":"bronze","label_ar":"برونزي","min_points":0},
            {"code":"silver","label_ar":"فضي","min_points":500},
            {"code":"gold","label_ar":"ذهبي","min_points":1500},
            {"code":"platinum","label_ar":"بلاتيني","min_points":4000}
          ]
        }'::jsonb,
       'نقاط الولاء والتدرّج. egp_per_point = كل كام جنيه تساوي نقطة.'
where not exists (select 1 from settings where key = 'loyalty');

create table if not exists public.loyalty_transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  points      integer not null,
  reason      text not null,
  order_id    uuid references public.orders(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_loyalty_user on public.loyalty_transactions (user_id, created_at desc);

-- One award per order, so a status flipping back and forth cannot pay twice.
create unique index if not exists idx_loyalty_one_award_per_order
  on public.loyalty_transactions (order_id)
  where order_id is not null and points > 0;

alter table public.loyalty_transactions enable row level security;

drop policy if exists loyalty_own on public.loyalty_transactions;
create policy loyalty_own on public.loyalty_transactions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists loyalty_staff on public.loyalty_transactions;
create policy loyalty_staff on public.loyalty_transactions
  for select using (public.get_user_role() = any (array['admin','super_admin','manager','accountant']));

-- Nobody writes these rows from a client; only the award function does.
revoke insert, update, delete on public.loyalty_transactions from anon, authenticated;

-- Lifetime points decide the tier — no rolling window, so nobody is demoted overnight.
create or replace function public.tier_for_points(p_points integer)
returns text
language sql
stable
set search_path to 'public'
as $$
  select coalesce(
    (select t->>'code'
     from settings s, lateral jsonb_array_elements(s.value->'tiers') t
     where s.key = 'loyalty' and p_points >= (t->>'min_points')::int
     order by (t->>'min_points')::int desc
     limit 1),
    'bronze')
$$;
