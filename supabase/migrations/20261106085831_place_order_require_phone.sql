-- Orders are dispatched by phone, so an account without one must not be able to
-- place one. The customer app already gates this, but the app is not the only
-- possible caller; this makes it impossible rather than merely unlikely.
--
-- The two functions are not retyped: each definition is read back from the
-- catalogue and the guard is inserted after the existing not_authenticated
-- check, so nothing else in the body can change. Every assumption is asserted
-- first, and the whole block is one transaction, so a failure applies nothing.
do $patch$
declare
  v_anchor constant text := 'if v_uid is null then raise exception ''not_authenticated''; end if;';
  v_guard  constant text := E'\n  if not exists (select 1 from public.users u where u.id = v_uid and nullif(trim(u.phone), '''') is not null) then raise exception ''phone_required''; end if;';
  v_fn   text;
  v_src  text;
  v_out  text;
begin
  foreach v_fn in array array['public.place_order(jsonb)', 'public.place_bag_order(jsonb)'] loop
    v_src := pg_get_functiondef(v_fn::regprocedure);

    if position('phone_required' in v_src) > 0 then
      raise exception 'refusing: % already contains the guard', v_fn;
    end if;

    if (length(v_src) - length(replace(v_src, v_anchor, ''))) / length(v_anchor) <> 1 then
      raise exception 'refusing: anchor not found exactly once in %', v_fn;
    end if;

    v_out := replace(v_src, v_anchor, v_anchor || v_guard);

    if length(v_out) <> length(v_src) + length(v_guard) then
      raise exception 'refusing: unexpected length change in %', v_fn;
    end if;

    execute v_out;
  end loop;
end
$patch$;
