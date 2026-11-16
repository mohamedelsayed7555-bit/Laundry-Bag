-- The owner's sheet gives shoes and bags ONE price each. The catalogue carried
-- two (غسيل and غسيل وكي / تنظيف جاف) for every one of them, which is the same
-- item sold twice at different prices - exactly what he asked to stop. A shoe is
-- never ironed, so غسيل is the one service that belongs, and the second row for
-- each item is disabled rather than deleted: past orders are read back by name.

insert into fn_backup.price_snapshots (reason, item_type, service_type, price)
select 'before the 2026-11-16 shoes/bags consolidation', item_type, service_type, price
from public.prices
where item_type like 'حذاء%' or item_type like 'شنطة%' or item_type = 'بوت';

-- ---- shoes: three tiers, no overlap -----------------------------------------
-- 150 is the sheet's single adult price, so the four adult types collapse into
-- it; the children's pair keeps a cheaper tier of its own rather than charging
-- a child's shoe the adult price.
update public.prices set item_type = 'حذاء', price = 150, updated_at = now()
 where item_type = 'حذاء رياضة' and service_type = 'wash';
update public.prices set item_type = 'حذاء أطفال', price = 85, updated_at = now()
 where item_type = 'حذاء جلد أطفال' and service_type = 'wash';
update public.prices set price = 199, updated_at = now()
 where item_type = 'بوت' and service_type = 'wash';

-- the adult types now covered by حذاء, the child type covered by حذاء أطفال,
-- and every ironing row for footwear
update public.prices set is_active = false, manually_disabled = true, updated_at = now()
 where item_type in ('حذاء شمواه أو جلد', 'حذاء جلد كاجوال', 'حذاء قماش', 'حذاء رياضة أطفال')
    or (item_type in ('حذاء رياضة', 'حذاء جلد أطفال', 'بوت') and service_type <> 'wash');

-- ---- bags: the four on the sheet, all under غسيل ----------------------------
update public.prices set item_type = 'شنطة مدرسية', price = 100, updated_at = now()
 where item_type = 'شنطة ظهر' and service_type = 'wash';
update public.prices set is_active = false, manually_disabled = true, updated_at = now()
 where item_type in ('شنطة ظهر', 'شنطة جيم');

insert into public.prices (item_type, service_type, price, is_active, category_id)
select v.n, 'wash', v.p, true, (select id from public.categories where name = 'أخرى')
from (values ('شنطة سفر صغيرة', 150), ('شنطة سفر كبيرة', 225), ('شنطة حريمي', 120)) v(n, p)
where not exists (select 1 from public.prices x where x.item_type = v.n and x.service_type = 'wash');

-- ---- the one figure from the sheet that does not conflict -------------------
update public.prices set price = 17, updated_at = now()
 where item_type = 'تيشيرت' and service_type = 'iron';
