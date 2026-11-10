-- The two-band delivery fee is gone: place_order now reads the zone list and one
-- formula, and the customer app never read these three keys at all. They are left
-- in the dashboard's settings list where they can only mislead whoever edits it, so
-- they go - with their values kept first, in case the bands are ever wanted back.
--
-- Checked before removing: no function, view or policy in the database mentions
-- them, and no file in any of the three apps does either.

create table if not exists fn_backup.setting_snapshots (
  id bigserial primary key,
  taken_at timestamptz not null default now(),
  reason text,
  key text not null,
  value jsonb,
  description text
);

insert into fn_backup.setting_snapshots (reason, key, value, description)
select 'before dropping the dead two-band delivery settings', key, value, description
from public.settings
where key in ('delivery_near_km', 'delivery_near_fee', 'delivery_far_fee');

do $do$
declare v_saved int; v_removed int;
begin
  select count(*) into v_saved from fn_backup.setting_snapshots
  where reason = 'before dropping the dead two-band delivery settings';

  delete from public.settings
  where key in ('delivery_near_km', 'delivery_near_fee', 'delivery_far_fee');
  get diagnostics v_removed = row_count;

  if v_removed <> v_saved then
    raise exception 'saved % settings but removed % - rolling back', v_saved, v_removed;
  end if;
  raise notice 'removed % dead delivery settings, % backed up', v_removed, v_saved;
end $do$;

-- Say plainly what the keys that remain actually do, so the next person editing them
-- does not have to read the cart to find out.
update public.settings set description = 'سعر التوصيل الأساسي بالجنيه. ده الرقم اللي العميل يشوفه ويتسجل في الأوردر.'
 where key = 'delivery_fee';
update public.settings set description = 'سعر الكيلو الزيادة بالجنيه. 0 = التوصيل سعر ثابت.'
 where key = 'price_per_km';
update public.settings set description = 'الكيلومترات المجانية قبل ما سعر الكيلو يبدأ يتحسب.'
 where key = 'base_delivery_km';
update public.settings set description = 'أقصى مسافة بالكيلو (هوائي) - بتُستخدم فقط لو مفيش delivery_zones.'
 where key = 'max_zone_km';
