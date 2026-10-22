-- The conversations list read every message the user had ever exchanged, ranked all of
-- them, and then kept one row per order. That cost grows with the whole history even
-- though the screen only ever shows the most recent threads.
--
-- A cap is added, defaulting to the thirty most recent conversations, and the indexes
-- below let the ranking walk each side of the mailbox newest-first instead of sorting
-- everything.

create index if not exists idx_messages_sender_created
  on public.messages (sender_id, created_at desc);

create index if not exists idx_messages_receiver_created
  on public.messages (receiver_id, created_at desc);

create or replace function public.get_conversations(p_user_id uuid, p_limit integer default 30)
returns table(order_id uuid, other_id uuid, other_name text, last_message text,
              last_time timestamp with time zone, unread bigint, order_number text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := case when public.is_staff() then p_user_id else auth.uid() end;
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 200);
begin
  return query
  with ranked as (
    select m.order_id, m.sender_id, m.receiver_id, m.body, m.created_at, m.read_at,
      row_number() over (partition by m.order_id order by m.created_at desc) as rn
    from public.messages m
    where m.sender_id = v_uid or m.receiver_id = v_uid
  ),
  last_msgs as (
    select r.order_id,
      case when r.sender_id = v_uid then r.receiver_id else r.sender_id end as other_id,
      r.body as last_message,
      r.created_at as last_time
    from ranked r
    where r.rn = 1
    order by r.created_at desc
    limit v_limit
  ),
  unread_counts as (
    select m.order_id, count(*) as unread
    from public.messages m
    where m.receiver_id = v_uid and m.read_at is null
      and m.order_id in (select lm.order_id from last_msgs lm)
    group by m.order_id
  )
  select lm.order_id, lm.other_id,
    coalesce(u.name::text, 'Driver') as other_name,
    lm.last_message::text, lm.last_time,
    coalesce(uc.unread, 0::bigint) as unread,
    coalesce(o.order_number::text, '') as order_number
  from last_msgs lm
  left join public.users u on u.id = lm.other_id
  left join unread_counts uc on uc.order_id = lm.order_id
  left join public.orders o on o.id = lm.order_id
  order by lm.last_time desc;
end;
$function$;
