-- The login e-mail is what a password reset is sent to, so a customer must not be able
-- to write it straight into public.users: that would let the column drift away from the
-- real auth identity, and point a recovery link at an address that is not his.
-- It changes through Supabase Auth only, and sync_user_email mirrors it back here.
--
-- Only one condition is new here — `new.email is distinct from old.email` in the
-- customer/driver branch — but the whole function is restated so this file alone
-- produces the current definition on a fresh database.

create or replace function public.guard_user_sensitive_columns()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
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

  -- manager / accountant: may edit staff and customer details, never privileges.
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

  -- customers / drivers: their own row, nothing sensitive, and not the login e-mail.
  if new.role is distinct from old.role
     or new.permissions is distinct from old.permissions
     or new.points is distinct from old.points
     or new.tier is distinct from old.tier
     or new.customer_code is distinct from old.customer_code
     or new.branch_id is distinct from old.branch_id
     or new.created_at is distinct from old.created_at
     or new.email is distinct from old.email
     or (new.is_active and not coalesce(old.is_active, false)) then
    raise exception 'not allowed to modify protected user fields' using errcode = '42501';
  end if;

  return new;
end;
$function$;
