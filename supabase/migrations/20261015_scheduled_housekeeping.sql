-- Scheduled orders + automatic cancellations, run by pg_cron every 5 minutes.
create or replace function public.run_order_housekeeping()
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  r record;
  v_activated int := 0;
  v_unpaid int := 0;
  v_orphaned int := 0;
begin
  -- 1) Scheduled orders go live 60 minutes before their time, so the driver has time to get there.
  --    Back to "pending": trg_auto_assign_on_status picks the nearest, least-busy driver and the
  --    notification triggers tell the driver (with the pickup time) and the customer.
  for r in
    select id from public.orders
     where status = 'scheduled' and is_scheduled and scheduled_at <= now() + interval '60 minutes'
     for update skip locked
  loop
    update public.orders set status = 'pending' where id = r.id;
    insert into public.order_status_history (order_id, status, note)
    select r.id, o.status,
           case when o.driver_id is not null then 'تم تفعيل الطلب المجدول وتعيين سائق تلقائياً' else 'تم تفعيل الطلب المجدول تلقائياً' end
      from public.orders o where o.id = r.id;
    v_activated := v_activated + 1;
  end loop;

  -- 2) Online payment never completed within 24 h — only while the clothes are still with the customer.
  for r in
    select id from public.orders
     where payment_status = 'pending' and payment_method in ('visa', 'e_wallet')
       and status in ('pending', 'assigned', 'scheduled')
       and created_at < now() - interval '24 hours'
     for update skip locked
  loop
    update public.orders
       set status = 'cancelled', cancellation_reason = 'إلغاء تلقائي — لم يتم الدفع خلال 24 ساعة', cancelled_at = now()
     where id = r.id;
    insert into public.order_status_history (order_id, status, note) values (r.id, 'cancelled', 'إلغاء تلقائي — لم يتم الدفع خلال 24 ساعة');
    v_unpaid := v_unpaid + 1;
  end loop;

  -- 3) No driver found for 48 h (counted from the scheduled time for scheduled orders).
  for r in
    select id from public.orders
     where status = 'pending' and driver_id is null
       and coalesce(scheduled_at, created_at) < now() - interval '48 hours'
     for update skip locked
  loop
    update public.orders
       set status = 'cancelled', cancellation_reason = 'إلغاء تلقائي — لم يتم تعيين سائق خلال 48 ساعة', cancelled_at = now()
     where id = r.id;
    insert into public.order_status_history (order_id, status, note) values (r.id, 'cancelled', 'إلغاء تلقائي — لم يتم تعيين سائق خلال 48 ساعة');
    v_orphaned := v_orphaned + 1;
  end loop;

  return jsonb_build_object('activated', v_activated, 'unpaid_cancelled', v_unpaid, 'orphaned_cancelled', v_orphaned);
end;
$$;
revoke execute on function public.run_order_housekeeping() from public, anon, authenticated;

-- Driver push: scheduled orders show the pickup time (Cairo)
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
    v_phase := 'delivery';
  else
    return new;
  end if;

  begin
    select fcm_token into v_token from public.users where id = new.driver_id;
    select name into v_cust from public.users where id = new.customer_id;
    if v_phase = 'delivery' then
      v_title := 'مطلوب توصيل! 🚗';
      v_body := 'الطلب #' || v_num || ' جاهز في المغسلة — ' || coalesce(v_cust, 'عميل');
    elsif new.is_scheduled and new.scheduled_at is not null then
      v_title := 'طلب مجدول 🕐';
      v_body := 'الطلب #' || v_num || ' — ' || coalesce(v_cust, 'عميل') || ' — الاستلام الساعة '
                || to_char(new.scheduled_at at time zone 'Africa/Cairo', 'HH12:MI')
                || case when extract(hour from new.scheduled_at at time zone 'Africa/Cairo') < 12 then ' ص' else ' م' end;
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

-- Replace the old cron body (least-busy driver for all, at the exact time) with the function above
select cron.unschedule('activate-scheduled-orders');
select cron.schedule('activate-scheduled-orders', '*/5 * * * *', 'select public.run_order_housekeeping()');
