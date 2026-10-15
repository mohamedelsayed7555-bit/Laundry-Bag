-- ═══ Driver assignment, delivery hand-off, driver notifications, location privacy ═══

-- 1) Best driver near a point: distance (km) + 4 km per order the driver already has in hand.
--    A location older than 30 minutes (or none) counts as 50 km, so active nearby drivers win.
create or replace function public._pick_driver(p_lat double precision, p_lng double precision, p_exclude uuid default null)
returns uuid language sql stable security definer set search_path = public, extensions as $$
  select u.id
    from public.users u
    left join public.driver_locations dl on dl.driver_id = u.id
    left join lateral (
      select count(*) as cnt from public.orders o
       where o.driver_id = u.id and o.status in ('assigned', 'arrived', 'picked_up', 'ready', 'delivering')
    ) a on true
   where u.role = 'driver' and u.is_active and (p_exclude is null or u.id <> p_exclude)
   order by
     (case when p_lat is not null and p_lng is not null and dl.lat is not null and dl.updated_at > now() - interval '30 minutes'
           then public._haversine_km(p_lat, p_lng, dl.lat, dl.lng) else 50 end) + 4 * a.cnt,
     a.cnt
   limit 1
$$;
revoke execute on function public._pick_driver(double precision, double precision, uuid) from public, anon, authenticated;

-- 2) New order → driver closest to the customer's pickup address (and least busy)
create or replace function public.auto_assign_driver()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  chosen uuid;
begin
  if new.status != 'pending' or new.driver_id is not null then
    return new;
  end if;
  chosen := public._pick_driver(
    coalesce(new.pickup_location->>'lat', new.delivery_location->>'lat')::double precision,
    coalesce(new.pickup_location->>'lng', new.delivery_location->>'lng')::double precision);
  if chosen is not null then
    new.driver_id := chosen;
    new.pickup_driver_id := chosen;
    new.status := 'assigned';
  end if;
  return new;
end;
$$;

-- 3) Status-driven assignment (same row update, so one notification):
--    scheduled → pending : pickup driver near the customer
--    → ready             : delivery driver near the laundry; the order moves to that driver
--    manual change of driver keeps pickup_/delivery_driver_id in step
create or replace function public.auto_assign_on_status()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  chosen uuid;
begin
  if new.status = 'pending' and old.status = 'scheduled' and new.driver_id is null then
    chosen := public._pick_driver(
      coalesce(new.pickup_location->>'lat', new.delivery_location->>'lat')::double precision,
      coalesce(new.pickup_location->>'lng', new.delivery_location->>'lng')::double precision);
    if chosen is not null then
      new.driver_id := chosen;
      new.pickup_driver_id := chosen;
      new.status := 'assigned';
    end if;
  elsif new.status = 'ready' and old.status is distinct from 'ready'
        and new.driver_id is not distinct from old.driver_id
        and coalesce(new.notes, '') not like '%[من المحل]%' then
    chosen := public._pick_driver(
      public._setting_num('laundry_lat', null)::double precision,
      public._setting_num('laundry_lng', null)::double precision);
    if chosen is not null then
      new.pickup_driver_id := coalesce(old.pickup_driver_id, old.driver_id);
      new.driver_id := chosen;
      new.delivery_driver_id := chosen;
    end if;
  elsif new.driver_id is distinct from old.driver_id and new.driver_id is not null then
    if new.status in ('pending', 'assigned', 'arrived', 'picked_up') then
      new.pickup_driver_id := new.driver_id;
    elsif new.status in ('ready', 'delivering') then
      new.delivery_driver_id := new.driver_id;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_auto_assign_on_status on public.orders;
create trigger trg_auto_assign_on_status before update on public.orders
  for each row execute function public.auto_assign_on_status();
revoke execute on function public.auto_assign_on_status() from public, anon, authenticated;

-- Existing helpers now use the same rule (kept for the dashboard / driver deactivation)
create or replace function public.assign_best_driver(p_order_id uuid, p_lat numeric default null, p_lng numeric default null)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  o record;
  chosen uuid;
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') and pg_trigger_depth() = 0 and not public.is_staff() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into o from public.orders where id = p_order_id;
  if not found then return null; end if;

  if o.status in ('pending', 'assigned', 'arrived') then
    chosen := public._pick_driver(
      coalesce(o.pickup_location->>'lat', o.delivery_location->>'lat')::double precision,
      coalesce(o.pickup_location->>'lng', o.delivery_location->>'lng')::double precision, o.driver_id);
    if chosen is not null then
      update public.orders set driver_id = chosen, pickup_driver_id = chosen,
             status = case when status = 'pending' then 'assigned' else status end
       where id = p_order_id;
    end if;
  elsif o.status = 'ready' then
    chosen := public._pick_driver(
      public._setting_num('laundry_lat', null)::double precision,
      public._setting_num('laundry_lng', null)::double precision, o.driver_id);
    if chosen is not null then
      update public.orders set driver_id = chosen, delivery_driver_id = chosen where id = p_order_id;
    end if;
  end if;
  -- picked_up / processing / delivering: clothes are with the driver or the laundry — not moved automatically
  return chosen;
end;
$$;

create or replace function public.assign_delivery_driver(p_order_id uuid, p_lat numeric default null, p_lng numeric default null)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  chosen uuid;
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') and pg_trigger_depth() = 0 and not public.is_staff() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  -- Already handed over by the status trigger: keep that driver (avoids a second, different pick)
  select delivery_driver_id into chosen from public.orders
   where id = p_order_id and status = 'ready' and delivery_driver_id is not null and delivery_driver_id = driver_id;
  if chosen is not null then return chosen; end if;
  chosen := public._pick_driver(
    public._setting_num('laundry_lat', null)::double precision,
    public._setting_num('laundry_lng', null)::double precision);
  if chosen is not null then
    update public.orders set driver_id = chosen, delivery_driver_id = chosen where id = p_order_id;
  end if;
  return chosen;
end;
$$;

-- 4) Driver notifications: one source, also for orders assigned at creation
create or replace function public.notify_driver_assignment()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  v_phase text;
  v_token text;
  v_cust text;
  v_title text;
  v_body text;
  v_num text := ltrim(coalesce(new.order_number, ''), '#');
begin
  if new.driver_id is null then return new; end if;
  if tg_op = 'INSERT' then
    v_phase := 'pickup';
  elsif new.driver_id is distinct from old.driver_id then
    v_phase := case when new.status in ('ready', 'delivering') then 'delivery' else 'pickup' end;
  elsif new.status = 'ready' and old.status is distinct from 'ready' then
    v_phase := 'delivery';   -- same driver also delivers
  else
    return new;
  end if;

  begin
    select fcm_token into v_token from public.users where id = new.driver_id;
    select name into v_cust from public.users where id = new.customer_id;
    if v_phase = 'delivery' then
      v_title := 'مطلوب توصيل! 🚗';
      v_body := 'الطلب #' || v_num || ' جاهز في المغسلة — ' || coalesce(v_cust, 'عميل');
    else
      v_title := 'طلب جديد! 🔔';
      v_body := 'الطلب #' || v_num || ' — ' || coalesce(v_cust, 'عميل') || ' — ' || coalesce(new.items_count, 0) || ' قطعة';
    end if;
    if v_token is not null and v_token <> '' then
      perform net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object(
          'to', v_token, 'title', v_title, 'body', v_body,
          'sound', 'new_order.wav', 'channelId', 'new-order-v2', 'priority', 'high',
          'data', jsonb_build_object('type', 'new_order', 'order_id', new.id, 'phase', v_phase)));
    end if;
  exception when others then
    raise warning 'driver notification failed: %', sqlerrm;
  end;
  return new;
end;
$$;
drop trigger if exists trg_notify_driver_assignment on public.orders;
create trigger trg_notify_driver_assignment after insert or update on public.orders
  for each row execute function public.notify_driver_assignment();
revoke execute on function public.notify_driver_assignment() from public, anon, authenticated;

-- Old paths that pushed the same assignment again
drop trigger if exists trg_notify_driver_assign on public.orders;   -- edge function notify-driver

create or replace function public.notify_order_status_change()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  v_token text;
  v_lang text;
  v_title text;
  v_body text;
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
  -- (driver assignment pushes: notify_driver_assignment)
  return new;
end;
$$;

-- Chat: drivers/staff get the message sound on their own channel too
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
      perform net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object(
          'to', v_token,
          'title', coalesce(sender_name, case when v_role = 'customer' and v_lang = 'en' then 'New message' else 'رسالة جديدة' end) || ' 💬',
          'body', left(new.body, 100),
          'sound', 'message.wav', 'channelId', 'messages-v2', 'priority', 'high',
          'data', jsonb_build_object('type', case when v_role = 'customer' then 'chat' else 'message' end,
                                     'order_id', new.order_id, 'sender_id', new.sender_id)));
    end if;
  exception when others then
    raise warning 'message notification failed: %', sqlerrm;
  end;
  return new;
end;
$$;

-- 5) Pickup driver keeps read access to orders he handed over (history / stats)
drop policy if exists orders_driver on public.orders;
create policy orders_driver on public.orders for select to authenticated
  using (driver_id = auth.uid() or pickup_driver_id = auth.uid());

update public.orders set pickup_driver_id = driver_id
 where pickup_driver_id is null and driver_id is not null;

-- 6) Driver locations: no longer public. Customer sees only the driver coming to them.
drop policy if exists driver_locations_read on public.driver_locations;
drop policy if exists customers_read_assigned_driver_location on public.driver_locations;
create policy driver_locations_select on public.driver_locations for select to authenticated using (
  driver_id = auth.uid()
  or public.is_staff()
  or exists (
    select 1 from public.orders o
     where o.driver_id = driver_locations.driver_id
       and o.customer_id = auth.uid()
       and o.status in ('assigned', 'arrived', 'delivering')
  )
);
