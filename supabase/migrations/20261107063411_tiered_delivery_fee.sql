-- Delivery moves from "a base fee plus so much per kilometre" to two bands, which
-- is what the owner wants and what a customer can predict:
--
--   under 15 km : 25 EGP
--   15 - 25 km  : 35 EGP
--   beyond      : out of zone
--
-- The settings are the single source for both, so the bands can be changed from
-- the dashboard without another release.
insert into public.settings (key, value, description)
values ('delivery_near_km',  '15'::jsonb, 'حد المسافة القريبة بالكيلومتر'),
       ('delivery_near_fee', '25'::jsonb, 'رسوم التوصيل داخل المسافة القريبة'),
       ('delivery_far_fee',  '35'::jsonb, 'رسوم التوصيل من حد المسافة القريبة حتى نهاية النطاق')
on conflict (key) do update set value = excluded.value;

update public.settings set value = '25'::jsonb where key = 'max_zone_km';

-- place_order keeps everything else; only how the fee is worked out changes.
do $patch$
declare
  v_src text;
  v_old constant text :=
'  v_fee := v_base_fee;
  if v_addr_lat is not null and v_addr_lng is not null then
    v_dist := public._haversine_km(v_lat0, v_lng0, v_addr_lat, v_addr_lng);
    if v_dist > v_max_km then raise exception ''out_of_zone''; end if;';
  v_new constant text :=
'  -- Two bands rather than a per-kilometre rate: the customer can predict it.
  v_fee := public._setting_num(''delivery_far_fee'', 35);
  if v_addr_lat is not null and v_addr_lng is not null then
    v_dist := public._haversine_km(v_lat0, v_lng0, v_addr_lat, v_addr_lng);
    if v_dist > v_max_km then raise exception ''out_of_zone''; end if;
    if v_dist <= public._setting_num(''delivery_near_km'', 15) then
      v_fee := public._setting_num(''delivery_near_fee'', 25);
    end if;';
begin
  v_src := pg_get_functiondef('public.place_order(jsonb)'::regprocedure);
  if position(v_old in v_src) = 0 then
    raise exception 'refusing: the delivery block is not where it was expected';
  end if;
  if (length(v_src) - length(replace(v_src, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'refusing: the delivery block appears more than once';
  end if;
  execute replace(v_src, v_old, v_new);
end
$patch$;
