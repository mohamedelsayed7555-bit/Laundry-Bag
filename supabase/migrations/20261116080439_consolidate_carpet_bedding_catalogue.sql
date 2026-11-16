-- The owner's own price sheets, entered as written. Two problems they fix:
--
-- 1. "سجاد وبطاطين" is a service, not a category, and its items were scattered
--    across مفروشات, بطاطين and أخرى - so a customer picking that service found
--    rugs buried under "مفروشات" next to the sheets and towels. Every item sold
--    under the carpet service now lives in one category of the same name.
-- 2. The same thing was priced twice under two naming schemes (خفيفة/ثقيلة vs
--    صغيرة/كبيرة, flat-size rugs vs rugs by the square metre). The sheet's names
--    and prices win; the superseded rows are disabled, never deleted, because
--    past orders are read back by item name.

insert into fn_backup.price_snapshots (reason, item_type, service_type, price)
select 'before the 2026-11-16 carpet/bedding consolidation', item_type, service_type, price
from public.prices
where service_type = 'carpet' or item_type = 'ستارة';

-- ---- one category for the whole carpet service ------------------------------
update public.categories set name = 'سجاد وبطاطين' where name = 'بطاطين';

-- every row of every item sold under the carpet service, so an item is never
-- split across two categories by service. The two child items stay in أخرى:
-- a teddy bear is not a rug, and filing it here would be the same confusion.
update public.prices
   set category_id = (select id from public.categories where name = 'سجاد وبطاطين'),
       updated_at = now()
 where item_type in (select distinct item_type from public.prices where service_type = 'carpet')
   and item_type not in ('دباديب أطفال', 'كرسي سيارة أطفال');

-- ---- rugs: priced by the square metre, three grades --------------------------
update public.prices
   set item_type = 'سجاد عادي (سعر المتر المربع)', updated_at = now()
 where item_type = 'سجادة عادي السعر للمتر المربع';

insert into public.prices (item_type, service_type, price, is_active, category_id)
select v.n, 'carpet', v.p, true, (select id from public.categories where name = 'سجاد وبطاطين')
from (values ('سجاد شعر (سعر المتر المربع)', 50),
             ('سجاد صوف أو حرير أو يدوي (سعر المتر المربع)', 65)) v(n, p)
where not exists (select 1 from public.prices x where x.item_type = v.n and x.service_type = 'carpet');

-- the flat-size rugs are the same product priced a second way
update public.prices
   set is_active = false, manually_disabled = true, updated_at = now()
 where item_type in ('سجادة متوسطة', 'سجادة كبيرة');

-- ---- blankets, duvets, pillows ----------------------------------------------
update public.prices set item_type = 'بطانية صغيرة', price = 100, updated_at = now() where item_type = 'بطانية خفيفة';
update public.prices set item_type = 'بطانية كبيرة', price = 175, updated_at = now() where item_type = 'بطانية ثقيلة';

update public.prices set item_type = 'لحاف صغير', price = 100, updated_at = now() where item_type = 'لحاف';
insert into public.prices (item_type, service_type, price, is_active, category_id)
select 'لحاف كبير', 'carpet', 175, true, (select id from public.categories where name = 'سجاد وبطاطين')
where not exists (select 1 from public.prices x where x.item_type = 'لحاف كبير' and x.service_type = 'carpet');

-- the stored names carried a trailing space and two spellings of مخدة
update public.prices set item_type = 'مخدة صغيرة', price = 50, updated_at = now() where trim(item_type) = 'مخدة صغيره';
update public.prices set item_type = 'مخدة كبيرة', price = 75, updated_at = now() where trim(item_type) = 'مخده كبيره';
update public.prices set is_active = false, manually_disabled = true, updated_at = now() where trim(item_type) = 'مخده وسط';

-- ---- curtains: the sheet prices them by the metre ---------------------------
update public.prices set item_type = 'ستائر (سعر المتر)', price = 15, updated_at = now()
 where item_type = 'ستارة' and service_type = 'iron';
update public.prices set item_type = 'ستائر (سعر المتر)', price = 17, updated_at = now()
 where item_type = 'ستارة' and service_type = 'wash_iron';
-- no per-metre figure was given for these two, and the old per-piece prices
-- would overcharge several times over once multiplied by the metre count
update public.prices set is_active = false, manually_disabled = true, updated_at = now()
 where item_type = 'ستارة' and service_type in ('wash', 'dry_clean');
