-- Two runner rugs were added from the dashboard this evening and landed on the
-- غسيل service, because that is what the service list opens on. A runner is a
-- rug, so it belongs with the rest of them: filed under غسيل it was invisible
-- to anyone who picked سجاد وبطاطين, and it put a two-item سجاد وبطاطين group
-- back under غسيل - the split this morning's work removed.
--
-- The stored names also carried a trailing space and spelled مشايه / صغيره the
-- short way, where the rest of the catalogue uses ة. Same fix as مخدة earlier
-- today. The prices are the owner's and do not change.

insert into fn_backup.price_snapshots (reason, item_type, service_type, price)
select 'before moving the runner rugs onto the carpet service', item_type, service_type, price
from public.prices where trim(item_type) in ('مشايه صغيره', 'مشايه كبيره');

update public.prices
   set item_type = 'مشاية صغيرة', service_type = 'carpet', updated_at = now()
 where trim(item_type) = 'مشايه صغيره';

update public.prices
   set item_type = 'مشاية كبيرة', service_type = 'carpet', updated_at = now()
 where trim(item_type) = 'مشايه كبيره';
