-- The plans were sold at a flat 31.7 per item, but every one of them also covered
-- dry cleaning, where the average item is 129 and the dearest is 590 - and the
-- quota is spent per PIECE, not per pound. A 540 plan could take twenty suits.
--
-- Two changes, both agreed with the owner:
--   1. dry clean leaves the ordinary plans. It stays only in "الباقة الشاملة",
--      which is sold as covering everything.
--   2. the price is rebuilt on what the covered services are actually worth:
--        ordinary plans  40.8/item  (60% wash+iron 48.3, 25% wash 32.2, 15% iron 25.1)
--        الشاملة         58.9/item  (the same mix with a fifth of it dry clean at 129)
--      less the discount that already grows with the size of the plan.
--
-- The bag plans carry dry clean too and have the same hole, so it is closed there
-- as well; their prices are left alone, since the owner has not settled them yet.

insert into fn_backup.plan_snapshots (reason, name, items_per_month, monthly, quarterly, biannual, annual)
select 'before dropping dry clean and repricing on real value', name, items_per_month,
       monthly_price, quarterly_price, biannual_price, annual_price
from public.plans;

-- 1. dry clean out of every plan except the all-inclusive one
update public.plans
   set covered_services = array_remove(covered_services, 'dry_clean')
 where 'dry_clean' = any(covered_services)
   and not includes_all_services;

-- 2. reprice the five tiered plans on the value they now actually carry
with newplan(name, per_item, disc) as (values
  ('فردي',           40.8, 0.15),
  ('زوجي',           40.8, 0.20),
  ('عائلي',          40.8, 0.25),
  ('بريميوم',        40.8, 0.30),
  ('الباقة الشاملة', 58.9, 0.20)
),
calc as (
  select p.id,
         round(p.items_per_month * n.per_item * (1 - n.disc) / 10) * 10 as m
  from public.plans p join newplan n on n.name = p.name
)
update public.plans p
   set monthly_price   = c.m,
       quarterly_price = round(c.m * 3  * 0.90 / 10) * 10,
       biannual_price  = round(c.m * 6  * 0.85 / 10) * 10,
       annual_price    = round(c.m * 12 * 0.80 / 10) * 10
from calc c
where c.id = p.id;
