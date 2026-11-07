-- A plain dress came out cheaper to dry clean (118) than to wash and iron (130).
-- The competitor lists no plain dress for dry cleaning, so that price was carried
-- over from the old list and scaled, while wash+iron was anchored to theirs. It is
-- brought back in line with what dry cleaning costs relative to wash+iron across
-- the rest of the catalogue.
insert into fn_backup.price_snapshots (reason, item_type, service_type, price)
select 'before fixing dress dry clean', item_type, service_type, price
from public.prices where item_type = 'فستان' and service_type = 'dry_clean';

with ratio as (
  select percentile_cont(0.5) within group (order by d.price / wi.price) as r
  from public.prices d
  join public.prices wi on wi.item_type = d.item_type and wi.service_type = 'wash_iron'
  where d.service_type = 'dry_clean' and d.price > wi.price
)
update public.prices d
   set price = round(wi.price * (select r from ratio)), updated_at = now()
from public.prices wi, ratio
where d.item_type = 'فستان' and d.service_type = 'dry_clean'
  and wi.item_type = 'فستان' and wi.service_type = 'wash_iron';
