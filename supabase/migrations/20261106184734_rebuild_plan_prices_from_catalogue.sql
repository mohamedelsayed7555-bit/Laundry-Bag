-- The plans were priced before the catalogue was, so they were giving away 58-69%
-- against the real list. They are rebuilt from what an item now actually costs:
--
--   value  = items x 31.7   (the average of wash / iron / wash+iron over the ten
--                            garments people really send; 1.25x where the plan
--                            also covers dry clean)
--   price  = that, less a discount that grows with the size of the plan, so
--            moving up a tier is worth something
--   longer = the existing 90 / 85 / 80 per cent of the monthly rate
--
-- The bag plans are left alone: they are sold by the bag, not by the piece, and
-- the owner has not said which it should be.
create table if not exists fn_backup.plan_snapshots (
  taken_at timestamptz not null default now(),
  reason text,
  name text not null,
  items_per_month int,
  monthly numeric, quarterly numeric, biannual numeric, annual numeric,
  primary key (taken_at, name)
);
alter table fn_backup.plan_snapshots enable row level security;
revoke all on table fn_backup.plan_snapshots from public, anon, authenticated;

insert into fn_backup.plan_snapshots (reason, name, items_per_month, monthly, quarterly, biannual, annual)
select 'before rebuilding on the repriced catalogue', name, items_per_month,
       monthly_price, quarterly_price, biannual_price, annual_price
from public.plans;

with newplan(name, disc, dry) as (values
  ('فردي',           0.15, false),
  ('زوجي',           0.20, false),
  ('عائلي',          0.25, false),
  ('بريميوم',        0.30, false),
  ('الباقة الشاملة', 0.20, true )
),
calc as (
  select p.id,
         round(p.items_per_month * 31.7
               * (case when n.dry then 1.25 else 1 end)
               * (1 - n.disc) / 10) * 10 as m
  from public.plans p
  join newplan n on n.name = p.name
)
update public.plans p
   set monthly_price   = c.m,
       quarterly_price = round(c.m * 3  * 0.90 / 10) * 10,
       biannual_price  = round(c.m * 6  * 0.85 / 10) * 10,
       annual_price    = round(c.m * 12 * 0.80 / 10) * 10
from calc c
where c.id = p.id;
