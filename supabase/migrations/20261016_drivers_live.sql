-- One call for the live map: every driver with their last position and how much work they hold.
create or replace function public.drivers_live()
returns table (
  id uuid, name text, phone text, vehicle_type text, vehicle_number text, is_active boolean,
  lat double precision, lng double precision, updated_at timestamptz,
  active_orders bigint, pickup_orders bigint, delivery_orders bigint
)
language sql stable security definer set search_path = public as $$
  select u.id, u.name::text, u.phone::text, u.vehicle_type, u.vehicle_number, u.is_active,
         dl.lat, dl.lng, dl.updated_at,
         coalesce(o.total, 0), coalesce(o.pickup, 0), coalesce(o.delivery, 0)
    from public.users u
    left join public.driver_locations dl on dl.driver_id = u.id
    left join lateral (
      select count(*) as total,
             count(*) filter (where status in ('assigned','arrived','picked_up')) as pickup,
             count(*) filter (where status in ('ready','delivering')) as delivery
        from public.orders
       where driver_id = u.id and status in ('assigned','arrived','picked_up','ready','delivering')
    ) o on true
   where u.role = 'driver' and public.is_staff()
   order by u.is_active desc, coalesce(o.total, 0) desc, u.name;
$$;
revoke execute on function public.drivers_live() from public, anon;
grant execute on function public.drivers_live() to authenticated;
