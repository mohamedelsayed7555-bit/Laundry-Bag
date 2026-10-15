-- Staff cancel: same rules as the customer's cancel_order, in one transaction.
-- Returns to the plan only the items the plan actually paid for (subscription_items),
-- never the order's full item count.
create or replace function public.admin_cancel_order(p_order_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order record;
  v_fee numeric := 0;
  v_returned integer := 0;
begin
  if not public.is_staff() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  -- Already cancelled/refunded: stop here so the plan items are never returned twice.
  if v_order.status in ('cancelled', 'refunded') then raise exception 'already_cancelled'; end if;

  -- Same fee rule as today: only once the driver has reached the customer.
  if v_order.status in ('arrived', 'picked_up') then
    v_fee := coalesce(v_order.delivery_fee, 0);
  end if;

  update public.orders set
    status = 'cancelled',
    cancellation_reason = p_reason,
    cancellation_fee = v_fee,
    cancelled_by = 'admin',
    cancelled_at = now(),
    driver_id = null
  where id = p_order_id;

  if v_order.subscription_id is not null and coalesce(v_order.subscription_items, 0) > 0 then
    update public.subscriptions
       set items_used = greatest(0, items_used - v_order.subscription_items)
     where id = v_order.subscription_id;
    v_returned := v_order.subscription_items;
  end if;

  return jsonb_build_object('cancellation_fee', v_fee, 'returned_items', v_returned);
end;
$$;
revoke execute on function public.admin_cancel_order(uuid, text) from public, anon;
grant execute on function public.admin_cancel_order(uuid, text) to authenticated;
