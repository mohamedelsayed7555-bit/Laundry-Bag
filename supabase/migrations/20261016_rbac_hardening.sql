-- 1) Privilege escalation: staff could edit any user row, including their own role.
create or replace function public.guard_user_sensitive_columns()
returns trigger language plpgsql set search_path = public as $$
declare
  caller_role text;
  is_self boolean;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  caller_role := public.get_user_role();
  is_self := auth.uid() = new.id;

  if tg_op = 'INSERT' then
    if caller_role in ('admin', 'super_admin') then return new; end if;
    new.role := 'customer';
    new.permissions := '[]'::jsonb;
    new.points := 0;
    new.tier := 'bronze';
    new.is_active := true;
    return new;
  end if;

  -- Nobody raises their own privileges, not even an admin.
  if is_self and (new.role is distinct from old.role or new.permissions is distinct from old.permissions) then
    raise exception 'cannot change your own role or permissions' using errcode = '42501';
  end if;

  if caller_role in ('admin', 'super_admin') then
    return new;
  end if;

  if caller_role in ('manager', 'accountant') then
    if new.role is distinct from old.role
       or new.permissions is distinct from old.permissions
       or new.customer_code is distinct from old.customer_code
       or new.branch_id is distinct from old.branch_id
       or new.created_at is distinct from old.created_at then
      raise exception 'not allowed to modify protected user fields' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.role is distinct from old.role
     or new.permissions is distinct from old.permissions
     or new.points is distinct from old.points
     or new.tier is distinct from old.tier
     or new.customer_code is distinct from old.customer_code
     or new.branch_id is distinct from old.branch_id
     or new.created_at is distinct from old.created_at
     or (new.is_active and not coalesce(old.is_active, false)) then
    raise exception 'not allowed to modify protected user fields' using errcode = '42501';
  end if;

  return new;
end;
$$;

-- 2) super_admin was locked out of settings / prices / plans, silently.
drop policy if exists settings_admin on public.settings;
create policy settings_admin on public.settings for all
  using (public.get_user_role() = any (array['admin', 'super_admin']))
  with check (public.get_user_role() = any (array['admin', 'super_admin']));

drop policy if exists prices_admin on public.prices;
create policy prices_admin on public.prices for all
  using (public.get_user_role() = any (array['admin', 'super_admin']))
  with check (public.get_user_role() = any (array['admin', 'super_admin']));

drop policy if exists plans_admin on public.plans;
create policy plans_admin on public.plans for all
  using (public.get_user_role() = any (array['admin', 'super_admin']))
  with check (public.get_user_role() = any (array['admin', 'super_admin']));

-- 3) Audit log was writable by any signed-in account, so entries could be forged.
drop policy if exists authenticated_insert_audit_logs on public.audit_logs;
create policy audit_logs_staff_insert on public.audit_logs for insert to authenticated
  with check (public.is_staff() and user_id = auth.uid());
