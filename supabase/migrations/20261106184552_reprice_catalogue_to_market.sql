-- Reprice the catalogue to sit at 69% of the competitor's list, and fill the gaps
-- in it. The old prices were about a third of theirs, which is not a position, it
-- is an accident; the laundry has no live customers yet, so this is the moment.
--
--   matched items     -> competitor x 0.69
--   items they do not -> scaled by the median move of the matched ones in the
--   carry                same service, so the list stays internally level
--   wash only         -> two thirds of wash+iron, the owner's rule
--
-- Every old price is kept in fn_backup.price_snapshots.

create table if not exists fn_backup.price_snapshots (
  taken_at   timestamptz not null default now(),
  reason     text,
  item_type  text not null,
  service_type text not null,
  price      numeric not null,
  primary key (taken_at, item_type, service_type)
);
alter table fn_backup.price_snapshots enable row level security;
revoke all on table fn_backup.price_snapshots from public, anon, authenticated;

insert into fn_backup.price_snapshots (reason, item_type, service_type, price)
select 'before repricing to 69% of market', item_type, service_type, price
from public.prices;

-- ---------------------------------------------------------------- competitor list
create temp table comp(ours text, svc text, price numeric);
insert into comp values
('تيشيرت','iron',23),('قميص','iron',25),('سويت شيرت','iron',39),('بلوفر صوف','iron',34),
('جاكيت','iron',63),('بنطلون','iron',27),('بنطلون جينز','iron',27),('شورت','iron',18),
('ليجنز','iron',23),('تنورة','iron',40),('جلابية','iron',51),('فستان','iron',103),
('عباية','iron',63),('بدلة','iron',125),('مفرش سفرة','iron',55),('بشكير','iron',23),
('مفرش سرير','iron',57),('كيس مخدة','iron',18),('غطاء لحاف','iron',68),('ستارة','iron',21),
('ملاية سرير','iron',51),
('تيشيرت','wash_iron',48),('قميص','wash_iron',50),('سويت شيرت','wash_iron',84),
('بلوفر صوف','wash_iron',84),('جاكيت','wash_iron',143),('بنطلون','wash_iron',59),
('بنطلون جينز','wash_iron',64),('شورت','wash_iron',43),('ليجنز','wash_iron',55),
('تنورة','wash_iron',63),('جلابية','wash_iron',80),('فستان','wash_iron',188),
('عباية','wash_iron',109),('ملابس داخلية','wash_iron',23),('جورب','wash_iron',11),
('ملابس سباحة','wash_iron',47),('مفرش سفرة','wash_iron',82),('بشكير','wash_iron',41),
('مفرش سرير','wash_iron',116),('كيس مخدة','wash_iron',27),('غطاء لحاف','wash_iron',116),
('ملاية سرير','wash_iron',63),
('بلوفر صوف','dry_clean',114),('جاكيت','dry_clean',171),('بالطو','dry_clean',262),
('كرافتة','dry_clean',68),('بنطلون','dry_clean',91),('بدلة','dry_clean',230),
('فستان سهرة','dry_clean',257),('عباية','dry_clean',205),('صديري','dry_clean',114);

create temp table mult(svc text primary key, m numeric);
insert into mult values ('iron', 2.00), ('wash_iron', 1.79), ('dry_clean', 2.36), ('wash', 1.53);

-- 1. anything the competitor also sells: anchor straight to their price
update public.prices p
   set price = greatest(5, round(c.price * 0.69)), updated_at = now()
from comp c
where p.item_type = c.ours and p.service_type = c.svc;

-- 2. anything they do not: move it by the same amount the rest moved, so one list
update public.prices p
   set price = greatest(5, round(p.price * m.m)), updated_at = now()
from mult m
where p.service_type = m.svc
  and p.service_type <> 'wash'
  and not exists (select 1 from comp c where c.ours = p.item_type and c.svc = p.service_type);

-- 3. wash is two thirds of wash+iron wherever the pair exists
update public.prices w
   set price = greatest(5, round(wi.price * 2.0 / 3.0)), updated_at = now()
from public.prices wi
where w.service_type = 'wash' and wi.service_type = 'wash_iron'
  and wi.item_type = w.item_type;

-- 4. wash-only items have no pair to follow, so they take the wash multiplier
update public.prices w
   set price = greatest(5, round(w.price * 1.53)), updated_at = now()
where w.service_type = 'wash'
  and not exists (select 1 from public.prices wi
                   where wi.service_type = 'wash_iron' and wi.item_type = w.item_type);
