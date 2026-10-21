-- Awards points on a delivered, paid order and records when the tier last changed, so
-- staff can find the customers who just moved up and reward them by hand. Nothing is
-- sent automatically; this only answers "who levelled up, and when".

alter table public.users add column if not exists tier_changed_at timestamptz;

create or replace function public.award_order_points()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_divisor numeric;
  v_points  integer;
  v_total   integer;
  v_tier    text;
begin
  -- Only on the transition into delivered + confirmed, never on later edits.
  if not (new.status = 'delivered' and new.payment_status = 'confirmed') then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and old.status = 'delivered' and old.payment_status = 'confirmed' then
    return new;
  end if;

  begin
    select coalesce((value->>'egp_per_point')::numeric, 20) into v_divisor
    from settings where key = 'loyalty';
    if v_divisor is null or v_divisor <= 0 then v_divisor := 20; end if;

    v_points := floor(coalesce(new.total, 0) / v_divisor);
    if v_points <= 0 then return new; end if;

    insert into loyalty_transactions (user_id, points, reason, order_id)
    values (new.customer_id, v_points, 'order', new.id)
    on conflict (order_id) where (order_id is not null and points > 0) do nothing;

    if not found then return new; end if;

    update users
      set points = coalesce(points, 0) + v_points
      where id = new.customer_id
      returning points into v_total;

    v_tier := public.tier_for_points(v_total);

    -- Stamping the time only on a real change is what makes "recently upgraded" mean
    -- something; touching it on every order would make the list useless.
    update users
      set tier = v_tier, tier_changed_at = now()
      where id = new.customer_id and tier is distinct from v_tier;
  exception when others then
    -- Loyalty must never block an order from being completed.
    raise warning 'loyalty award failed for order %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists orders_award_points on public.orders;
create trigger orders_award_points
  after insert or update of status, payment_status on public.orders
  for each row execute function public.award_order_points();
