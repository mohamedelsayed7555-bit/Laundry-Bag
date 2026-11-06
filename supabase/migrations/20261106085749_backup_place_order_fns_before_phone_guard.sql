-- Snapshot of the two order-placing functions taken immediately before the
-- phone_required guard is added, so either can be restored verbatim.
create schema if not exists fn_backup;
revoke all on schema fn_backup from public, anon, authenticated;

create table if not exists fn_backup.function_snapshots (
  name       text        not null,
  taken_at   timestamptz not null default now(),
  reason     text,
  def        text        not null,
  md5        text        not null,
  primary key (name, taken_at)
);
alter table fn_backup.function_snapshots enable row level security;
revoke all on table fn_backup.function_snapshots from public, anon, authenticated;

insert into fn_backup.function_snapshots (name, reason, def, md5)
select 'place_order(jsonb)', 'before phone_required guard',
       pg_get_functiondef('public.place_order(jsonb)'::regprocedure),
       md5(pg_get_functiondef('public.place_order(jsonb)'::regprocedure))
union all
select 'place_bag_order(jsonb)', 'before phone_required guard',
       pg_get_functiondef('public.place_bag_order(jsonb)'::regprocedure),
       md5(pg_get_functiondef('public.place_bag_order(jsonb)'::regprocedure));
