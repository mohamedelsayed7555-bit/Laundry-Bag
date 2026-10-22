-- EXECUTE on a new function is granted to PUBLIC by default, so revoking it from anon
-- and authenticated alone left the endpoints open: both roles still reached it through
-- PUBLIC. Triggers never consult EXECUTE, so taking the default grant away costs
-- nothing and closes the REST endpoint for good.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and pg_get_function_result(p.oid) = 'trigger'
  loop
    execute format('revoke execute on function %s from public', r.sig);
  end loop;
end $$;
