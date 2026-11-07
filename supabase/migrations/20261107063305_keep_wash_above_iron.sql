-- Washing is more work than ironing, so it has to cost more. Six items came out
-- the other way round: their iron price is anchored to the competitor's, which is
-- steep on household pieces and on suits, while wash was derived as two thirds of
-- wash+iron. A suit ended up at 86 to iron and 60 to wash, which reads as a mistake
-- to any customer looking at the list.
--
-- Where that happened, wash is lifted to sit a clear step above iron, and wash+iron
-- is lifted with it so it stays above wash. Nothing else is touched.
insert into fn_backup.price_snapshots (reason, item_type, service_type, price)
select 'before lifting wash above iron', p.item_type, p.service_type, p.price
from public.prices p
where p.service_type in ('wash','wash_iron')
  and exists (
    select 1 from public.prices i, public.prices w
    where i.item_type = p.item_type and i.service_type = 'iron'
      and w.item_type = p.item_type and w.service_type = 'wash'
      and w.price <= i.price);

with bad as (
  select i.item_type, i.price as iron
  from public.prices i
  join public.prices w on w.item_type = i.item_type and w.service_type = 'wash'
  where i.service_type = 'iron' and w.price <= i.price
)
update public.prices w
   set price = round(b.iron * 1.25), updated_at = now()
from bad b
where w.item_type = b.item_type and w.service_type = 'wash';

-- wash+iron must still be the dearest of the three
update public.prices wi
   set price = round(w.price * 1.45), updated_at = now()
from public.prices w
where wi.service_type = 'wash_iron' and w.service_type = 'wash'
  and w.item_type = wi.item_type
  and wi.price <= w.price;
