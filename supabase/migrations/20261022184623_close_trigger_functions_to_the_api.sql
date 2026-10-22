-- Trigger functions were reachable as REST endpoints, so anyone could POST to
-- /rpc/notify_new_order or /rpc/award_order_points. Firing a trigger does not consult
-- EXECUTE at all — Postgres runs the function on the table's behalf — so taking the
-- grant away closes the endpoint and leaves every trigger working.
--
-- None of these is called by the apps; they call only the functions written for them.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and pg_get_function_result(p.oid) = 'trigger'
  loop
    execute format('revoke execute on function %s from anon, authenticated', r.sig);
  end loop;
end $$;
