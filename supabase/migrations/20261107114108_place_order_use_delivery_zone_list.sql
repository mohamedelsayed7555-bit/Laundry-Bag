-- place_order stops ranking addresses against one circle and two fee bands, and asks
-- the zone-list helpers instead. The bands are gone: the fee is the base plus the
-- kilometres past the free ones, which is the arithmetic the cart performs, so the
-- customer is shown the number that gets stored.
--
-- The patch is applied to the live definition by replacement, and every assertion
-- below must hold or the whole migration is rolled back.

do $do$
declare
  src text; out text;
  old_fee_block text; new_fee_block text;
  old_del_block text; new_del_block text;
begin
  src := pg_get_functiondef('public.place_order(jsonb)'::regprocedure);

  old_fee_block :=
'  -- Two bands rather than a per-kilometre rate: the customer can predict it.
  v_fee := public._setting_num(''delivery_far_fee'', 35);
  if v_addr_lat is not null and v_addr_lng is not null then
    v_dist := public._haversine_km(v_lat0, v_lng0, v_addr_lat, v_addr_lng);
    if v_dist > v_max_km then raise exception ''out_of_zone''; end if;
    if v_dist <= public._setting_num(''delivery_near_km'', 15) then
      v_fee := public._setting_num(''delivery_near_fee'', 25);
    end if;
  end if;';

  new_fee_block :=
'  -- Coverage is the list of circles in the `delivery_zones` setting, so an area can
  -- be opened or closed from the dashboard; with no list the helpers fall back to the
  -- single circle on laundry_lat/laundry_lng and max_zone_km.
  v_fee := public._delivery_fee_for(v_addr_lat::float8, v_addr_lng::float8);
  if v_addr_lat is not null and v_addr_lng is not null then
    v_dist := public._haversine_km(v_lat0, v_lng0, v_addr_lat, v_addr_lng);
    if not public._in_delivery_zone(v_addr_lat::float8, v_addr_lng::float8) then
      raise exception ''out_of_zone'';
    end if;
  end if;';

  old_del_block :=
'    if v_del_lat is not null and v_del_lng is not null
       and public._haversine_km(v_lat0, v_lng0, v_del_lat, v_del_lng) > v_max_km then
      raise exception ''delivery_out_of_zone'';
    end if;';

  new_del_block :=
'    if v_del_lat is not null and v_del_lng is not null
       and not public._in_delivery_zone(v_del_lat::float8, v_del_lng::float8) then
      raise exception ''delivery_out_of_zone'';
    end if;';

  if (length(src) - length(replace(src, old_fee_block, ''))) / length(old_fee_block) <> 1 then
    raise exception 'the pickup fee/zone block was not found exactly once - aborting';
  end if;
  if (length(src) - length(replace(src, old_del_block, ''))) / length(old_del_block) <> 1 then
    raise exception 'the delivery zone block was not found exactly once - aborting';
  end if;

  out := replace(src, old_fee_block, new_fee_block);
  out := replace(out, old_del_block, new_del_block);

  if position(old_fee_block in out) > 0 or position(old_del_block in out) > 0 then
    raise exception 'an old block survived the patch - aborting';
  end if;
  if position('_delivery_fee_for' in out) = 0
     or (length(out) - length(replace(out, '_in_delivery_zone', ''))) / length('_in_delivery_zone') <> 2 then
    raise exception 'the new helpers are not wired in twice - aborting';
  end if;
  if position('delivery_near_fee' in out) > 0 or position('delivery_far_fee' in out) > 0
     or position('delivery_near_km' in out) > 0 then
    raise exception 'a dead band setting is still referenced - aborting';
  end if;
  if position('v_total := round(greatest(0, v_items_total + v_fee - v_discount), 2);' in out) = 0
     or position('if v_fully_covered then v_fee := 0; end if;' in out) = 0 then
    raise exception 'an unrelated part of the function changed - aborting';
  end if;

  execute out;
end $do$;
