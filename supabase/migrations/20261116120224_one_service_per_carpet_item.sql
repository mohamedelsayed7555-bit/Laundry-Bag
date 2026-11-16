-- Three items were on sale twice at once: once under سجاد وبطاطين and again
-- under غسيل at a different price, so the same prayer rug cost 30 or 38 EGP
-- depending on which screen the customer came in from. They are carpet-service
-- items, so the غسيل row is the one that goes.
--
-- Disabled, not deleted: an order placed before today still reads its item by
-- name. With these off, the سجاد وبطاطين group no longer appears under غسيل at
-- all, because nothing active is left in it for that service.

insert into fn_backup.price_snapshots (reason, item_type, service_type, price)
select 'before removing the duplicate wash price', item_type, service_type, price
from public.prices
where is_active and service_type = 'wash'
  and item_type in ('سجادة صلاة', 'كوفرتة', 'دباديب أطفال');

update public.prices
   set is_active = false, manually_disabled = true, updated_at = now()
 where is_active and service_type = 'wash'
   and item_type in ('سجادة صلاة', 'كوفرتة', 'دباديب أطفال');
