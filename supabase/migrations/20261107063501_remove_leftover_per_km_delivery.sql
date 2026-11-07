-- The previous migration added the two bands but left the per-kilometre block
-- below them, which overwrote the band fee for anything past the first kilometre.
-- Every order over 1 km was still being charged the old way.
do $patch$
declare
  v_src text;
  v_old constant text =
'    if v_dist > v_base_km then
      v_fee := v_base_fee + floor((v_dist - v_base_km) * v_per_km + 0.5);
    end if;
';
begin
  v_src := pg_get_functiondef('public.place_order(jsonb)'::regprocedure);
  if (length(v_src) - length(replace(v_src, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'refusing: the per-kilometre block is not present exactly once';
  end if;
  execute replace(v_src, v_old, '');
end
$patch$;
