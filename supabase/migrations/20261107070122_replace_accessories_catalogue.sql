-- The shop stops selling branded towels and own-label detergent and sells four
-- cleaning products instead, each in a 500 ml and a 1 litre size.
--
-- The old six are disabled rather than deleted: past orders store the item name,
-- and deleting the row would leave an old order showing an item that no longer
-- exists anywhere.

insert into fn_backup.price_snapshots (reason, item_type, service_type, price)
select 'before replacing the accessories catalogue', item_type, service_type, price
from public.prices where service_type = 'accessories';

update public.prices
   set is_active = false, manually_disabled = true, updated_at = now()
 where service_type = 'accessories'
   and item_type in ('مسحوق غسيل (كيس صغير)', 'منعم أقمشة', 'معطر ملابس',
                     'فوطة وش بالوجو', 'بشكير بالوجو', 'كيس غسيل بالوجو');

with newp(item, price) as (values
  ('ديتول 500 مل',        40),
  ('ديتول 1 لتر',         70),
  ('هاند ووش 500 مل',     60),
  ('هاند ووش 1 لتر',     110),
  ('منظف أرضيات 500 مل',  45),
  ('منظف أرضيات 1 لتر',   80),
  ('صابون مواعين 500 مل', 39),
  ('صابون مواعين 1 لتر',  70)
)
insert into public.prices (item_type, service_type, price, is_active, category_id)
select n.item, 'accessories', n.price, true, c.id
from newp n join public.categories c on c.name = 'منتجات'
where not exists (select 1 from public.prices p
                   where p.item_type = n.item and p.service_type = 'accessories');
