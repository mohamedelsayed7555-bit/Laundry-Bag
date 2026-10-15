-- 1) Customer notification language
alter table public.users add column if not exists preferred_language text not null default 'ar';
do $$ begin
  alter table public.users add constraint users_preferred_language_check check (preferred_language in ('ar', 'en'));
exception when duplicate_object then null; end $$;

-- 2) Order status texts (same statuses the apps use; anything else sends nothing)
create or replace function public._order_status_text(p_status text, p_lang text)
returns text language sql immutable set search_path = public as $$
  select case when p_lang = 'en' then case p_status
      when 'assigned'   then 'A driver has been assigned to your order'
      when 'arrived'    then 'Your driver has arrived'
      when 'picked_up'  then 'Your clothes have been picked up'
      when 'processing' then 'Your clothes are being processed'
      when 'ready'      then 'Your clothes are ready for delivery!'
      when 'delivering' then 'Your driver is on the way'
      when 'delivered'  then 'Your order has been delivered!'
      when 'cancelled'  then 'Your order has been cancelled'
    end
  else case p_status
      when 'assigned'   then 'تم تعيين سائق لطلبك'
      when 'arrived'    then 'السائق وصل موقعك'
      when 'picked_up'  then 'تم استلام ملابسك'
      when 'processing' then 'ملابسك قيد المعالجة'
      when 'ready'      then 'ملابسك جاهزة للتوصيل!'
      when 'delivering' then 'السائق في طريقه إليك'
      when 'delivered'  then 'تم توصيل طلبك بنجاح!'
      when 'cancelled'  then 'تم إلغاء طلبك'
    end
  end
$$;

-- 3) Single source of customer order notifications (in-app row + push). Failures never block the order update.
create or replace function public.notify_order_status_change()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  v_token text;
  v_lang text;
  v_title text;
  v_body text;
  driver_token text;
begin
  if old.status = new.status then return new; end if;

  begin
    select fcm_token, preferred_language into v_token, v_lang from public.users where id = new.customer_id;
    v_body := public._order_status_text(new.status, coalesce(v_lang, 'ar'));
    if v_body is not null then
      v_title := case when v_lang = 'en' then 'Order #' else 'طلب #' end || ltrim(coalesce(new.order_number, ''), '#');
      insert into public.notifications (user_id, title, body, type, data, sent_at)
      values (new.customer_id, v_title, v_body, 'order',
              jsonb_build_object('type', 'order_update', 'order_id', new.id, 'status', new.status), now());
      if v_token is not null and v_token <> '' then
        perform net.http_post(
          url := 'https://exp.host/--/api/v2/push/send',
          headers := '{"Content-Type": "application/json"}'::jsonb,
          body := jsonb_build_object(
            'to', v_token, 'title', v_title, 'body', v_body,
            'sound', 'order_update.wav', 'channelId', 'order-updates-v2', 'priority', 'high',
            'data', jsonb_build_object('type', 'order_update', 'order_id', new.id, 'status', new.status)));
      end if;
    end if;
  exception when others then
    raise warning 'customer order notification failed: %', sqlerrm;
  end;

  -- Driver push on (re)assignment: unchanged
  if new.driver_id is not null and (old.driver_id is null or old.driver_id != new.driver_id) then
    select fcm_token into driver_token from public.users where id = new.driver_id;
    if driver_token is not null and driver_token != '' then
      perform net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object(
          'to', driver_token,
          'title', 'طلب جديد مخصص لك 🚗',
          'body', 'طلب #' || new.order_number,
          'sound', 'new_order.wav',
          'channelId', 'new-order',
          'data', jsonb_build_object('type', 'new_order', 'order_id', new.id)));
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.notify_new_order()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  v_token text;
  v_lang text;
  v_num text := ltrim(coalesce(new.order_number, ''), '#');
begin
  begin
    select fcm_token, preferred_language into v_token, v_lang from public.users where id = new.customer_id;
    if v_token is not null and v_token <> '' then
      perform net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object(
          'to', v_token,
          'title', case when v_lang = 'en' then 'Order received ✅' else 'تم استلام طلبك ✅' end,
          'body', case when v_lang = 'en' then 'Your order #' || v_num || ' is under review' else 'طلبك #' || v_num || ' قيد المراجعة' end,
          'sound', 'order_placed.wav', 'channelId', 'order-placed-v2', 'priority', 'high',
          'data', jsonb_build_object('type', 'order_placed', 'order_id', new.id)));
    end if;
  exception when others then
    raise warning 'new order notification failed: %', sqlerrm;
  end;
  return new;
end;
$$;

-- Chat: customers get the new message channel/sound; drivers/staff keep what they had.
create or replace function public.notify_new_message()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  v_token text;
  v_role text;
  v_lang text;
  sender_name text;
begin
  begin
    select fcm_token, role, preferred_language into v_token, v_role, v_lang from public.users where id = new.receiver_id;
    select name into sender_name from public.users where id = new.sender_id;
    if v_token is not null and v_token <> '' then
      if v_role = 'customer' then
        perform net.http_post(
          url := 'https://exp.host/--/api/v2/push/send',
          headers := '{"Content-Type": "application/json"}'::jsonb,
          body := jsonb_build_object(
            'to', v_token,
            'title', coalesce(sender_name, case when v_lang = 'en' then 'New message' else 'رسالة جديدة' end) || ' 💬',
            'body', left(new.body, 100),
            'sound', 'message.wav', 'channelId', 'messages-v2', 'priority', 'high',
            'data', jsonb_build_object('type', 'chat', 'order_id', new.order_id, 'sender_id', new.sender_id)));
      else
        perform net.http_post(
          url := 'https://exp.host/--/api/v2/push/send',
          headers := '{"Content-Type": "application/json"}'::jsonb,
          body := jsonb_build_object(
            'to', v_token,
            'title', coalesce(sender_name, 'رسالة جديدة') || ' 💬',
            'body', left(new.body, 100),
            'sound', 'order_update.wav',
            'channelId', 'messages',
            'data', jsonb_build_object('type', 'message', 'order_id', new.order_id, 'sender_id', new.sender_id)));
      end if;
    end if;
  exception when others then
    raise warning 'message notification failed: %', sqlerrm;
  end;
  return new;
end;
$$;

-- 4) A push token belongs to one account: claiming it on sign-in removes it from any other account on that device.
create or replace function public.claim_push_token(p_token text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if coalesce(p_token, '') = '' then return; end if;
  update public.users set fcm_token = null where fcm_token = p_token and id <> auth.uid();
  update public.users set fcm_token = p_token where id = auth.uid();
end;
$$;
revoke execute on function public.claim_push_token(text) from public, anon;
grant execute on function public.claim_push_token(text) to authenticated;

-- 5) Upgrades: the old plan ends only when the new one is activated (payment confirmed).
alter table public.subscriptions add column if not exists replaces_subscription_id uuid references public.subscriptions(id);

drop function if exists public.request_subscription(uuid, text, text, boolean);
create or replace function public.request_subscription(p_plan_id uuid, p_duration text, p_payment_method text, p_auto_renew boolean, p_replaces uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_plan record;
  v_months integer;
  v_rate numeric;
  v_price numeric;
  v_limit integer;
  v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_payment_method not in ('visa', 'wallet', 'instapay') then raise exception 'invalid_payment_method'; end if;

  v_months := case p_duration when 'monthly' then 1 when 'quarterly' then 3 when 'biannual' then 6 when 'annual' then 12 end;
  if v_months is null then raise exception 'invalid_duration'; end if;

  select * into v_plan from public.plans where id = p_plan_id and is_active;
  if not found then raise exception 'plan_not_found'; end if;

  if exists (select 1 from public.subscriptions where user_id = v_uid and plan_id = p_plan_id and status = 'pending') then
    raise exception 'already_pending';
  end if;
  if exists (select 1 from public.subscriptions where user_id = v_uid and plan_id = p_plan_id and status = 'active') then
    raise exception 'already_active';
  end if;
  if p_replaces is not null and not exists (select 1 from public.subscriptions where id = p_replaces and user_id = v_uid and status = 'active') then
    raise exception 'invalid_replaces';
  end if;

  if p_duration = 'monthly' then
    v_price := v_plan.monthly_price;
  else
    v_rate := case p_duration
      when 'quarterly' then public._setting_num('discount_quarterly', 10)
      when 'biannual' then public._setting_num('discount_biannual', 15)
      when 'annual' then public._setting_num('discount_annual', 20)
    end;
    v_price := floor(v_plan.monthly_price * v_months * (1 - v_rate / 100) + 0.5);
  end if;
  v_limit := v_plan.items_per_month * v_months;

  insert into public.subscriptions (user_id, plan_id, duration, status, items_used, items_limit, auto_renew, payment_method, total_paid, replaces_subscription_id)
  values (v_uid, p_plan_id, p_duration, 'pending', 0, v_limit, coalesce(p_auto_renew, false), p_payment_method, v_price, p_replaces)
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'total_paid', v_price, 'items_limit', v_limit);
end;
$$;
revoke execute on function public.request_subscription(uuid, text, text, boolean, uuid) from public, anon;
grant execute on function public.request_subscription(uuid, text, text, boolean, uuid) to authenticated;

create or replace function public.finish_subscription_upgrade()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'active' and old.status is distinct from 'active' and new.replaces_subscription_id is not null then
    update public.subscriptions
       set status = 'upgraded', auto_renew = false
     where id = new.replaces_subscription_id and user_id = new.user_id and status = 'active';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_finish_subscription_upgrade on public.subscriptions;
create trigger trg_finish_subscription_upgrade after update of status on public.subscriptions
  for each row execute function public.finish_subscription_upgrade();
revoke execute on function public.finish_subscription_upgrade() from public, anon, authenticated;

-- 6) Account deletion (matches /delete-account): personal data removed, order history kept without it.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select role into v_role from public.users where id = v_uid;
  if v_role is distinct from 'customer' then raise exception 'not_allowed'; end if;
  if exists (select 1 from public.orders where customer_id = v_uid and status not in ('delivered', 'cancelled')) then
    raise exception 'active_orders';
  end if;

  -- Block the old login and free the e-mail for a future sign-up (auth first: its e-mail sync trigger touches public.users).
  update auth.users
     set email = 'deleted+' || v_uid::text || '@deleted.invalid',
         phone = null,
         raw_user_meta_data = '{}'::jsonb,
         encrypted_password = '',
         banned_until = 'infinity'
   where id = v_uid;
  delete from auth.identities where user_id = v_uid;
  delete from auth.sessions where user_id = v_uid;

  delete from public.addresses where user_id = v_uid;
  update public.subscriptions set status = 'cancelled', auto_renew = false where user_id = v_uid and status in ('active', 'pending');
  update public.users
     set name = 'حساب محذوف', phone = null, email = null, avatar_url = null, fcm_token = null, is_active = false
   where id = v_uid;
end;
$$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- 7) Fixed search_path for the functions the linter flags
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as fn
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in ('log_auto_assign_history','generate_customer_code','update_updated_at','generate_order_number',
         'notify_admin_payment','notify_admin_order_status','notify_admin_new_order','log_user_changes','log_plan_changes',
         'log_order_changes','is_order_participant','create_walkin_customer','expire_subscriptions','notify_driver_on_assign',
         'sync_user_email','get_pending_actions','auto_assign_driver','_haversine_km','assign_best_driver',
         'assign_delivery_driver','get_finance_stats','redistribute_driver_orders')
       and p.proconfig is null
  loop
    execute format('alter function %s set search_path = public, extensions', r.fn);
  end loop;
end $$;
