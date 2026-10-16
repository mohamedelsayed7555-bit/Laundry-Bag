-- Keep public.users.email in lockstep with auth.users.email. The dashboard shows
-- users.email while login uses auth.email; if they drift the UI shows a wrong
-- address and customer phone->email login can break. This trigger makes auth the
-- single source of truth, whatever path changes it (admin API, client confirm, SQL).
create or replace function public.sync_user_email()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.email is distinct from old.email then
    update public.users set email = new.email where id = new.id;
  end if;
  return new;
end;
$function$;

drop trigger if exists on_auth_email_change on auth.users;
create trigger on_auth_email_change
after update of email on auth.users
for each row execute function public.sync_user_email();

-- One-time repair: realign any rows that already drifted.
update public.users u
set email = au.email
from auth.users au
where au.id = u.id
  and u.email is distinct from au.email;
