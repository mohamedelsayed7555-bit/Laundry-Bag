-- Tell the customer whenever his password changes.
--
-- This is what turns "we cannot sign in as you" from a promise into something he can
-- check: any reset, by him or by anyone else, shows up on his phone within seconds. A
-- change he did not make is visible immediately instead of silent.

create or replace function public.notify_password_changed()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text;
  v_lang  text;
  v_role  text;
  v_title text;
  v_body  text;
begin
  -- Only an actual password change, not a sign-in or any other auth.users update.
  if new.encrypted_password is not distinct from old.encrypted_password then
    return new;
  end if;

  begin
    select fcm_token, preferred_language, role
      into v_token, v_lang, v_role
      from public.users where id = new.id;

    -- Staff get their credentials through other channels; this is for customers.
    if v_role is distinct from 'customer' then
      return new;
    end if;

    if coalesce(v_lang, 'ar') = 'en' then
      v_title := 'Your password was changed';
      v_body  := 'If this was not you, contact us right away.';
    else
      v_title := 'تم تغيير كلمة السر';
      v_body  := 'لو مش إنت اللي غيّرتها، كلّمنا فوراً.';
    end if;

    insert into public.notifications (user_id, title, body, type, data, sent_at)
    values (new.id, v_title, v_body, 'system',
            jsonb_build_object('type', 'security', 'event', 'password_changed'), now());

    if v_token is not null and v_token <> '' then
      perform net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object(
          'to', v_token, 'title', v_title, 'body', v_body,
          'channelId', 'default', 'priority', 'high',
          'data', jsonb_build_object('type', 'security', 'event', 'password_changed')));
    end if;
  exception when others then
    -- A failed notification must never block a password reset.
    raise warning 'password change notification failed: %', sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_password_changed on auth.users;
create trigger on_auth_password_changed
  after update of encrypted_password on auth.users
  for each row execute function public.notify_password_changed();
