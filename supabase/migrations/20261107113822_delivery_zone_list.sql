-- Delivery coverage becomes a list of circles kept in `delivery_zones`, so an area
-- can be opened or closed from the dashboard instead of needing an app release, and
-- the fee is computed from one formula that matches what the cart shows the customer.
--
-- Nothing changes until `delivery_zones` exists: with no list the helpers fall back
-- to the single circle on laundry_lat/laundry_lng and max_zone_km, exactly as before.

-- _setting_num treats 0 as "missing" and returns the default, so a rate of zero is
-- impossible to express. This reader only falls back when the value is absent or
-- not a number.
create or replace function public._setting_num0(p_key text, p_default numeric)
returns numeric language plpgsql stable security definer set search_path to 'public' as $fn$
declare v text; n numeric;
begin
  select value #>> '{}' into v from public.settings where key = p_key;
  begin n := nullif(trim(v), '')::numeric; exception when others then n := null; end;
  return coalesce(n, p_default);
end; $fn$;

-- The zone list, or an empty array when it is missing, is not an array, or holds
-- nothing usable. A zone counts only with a numeric lat, lng and a positive radius,
-- so a half-typed entry in the dashboard cannot lock every customer out.
create or replace function public._delivery_zones()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $fn$
declare v jsonb; out jsonb;
begin
  select case
           when jsonb_typeof(value) = 'array' then value
           when jsonb_typeof(value) = 'string' then (value #>> '{}')::jsonb
         end
    into v from public.settings where key = 'delivery_zones';
  if v is null or jsonb_typeof(v) <> 'array' then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(z), '[]'::jsonb) into out
  from jsonb_array_elements(v) z
  where jsonb_typeof(z) = 'object'
    and (z->>'lat') ~ '^-?[0-9]+(\.[0-9]+)?$'
    and (z->>'lng') ~ '^-?[0-9]+(\.[0-9]+)?$'
    and (z->>'radius_km') ~ '^[0-9]+(\.[0-9]+)?$'
    and (z->>'radius_km')::numeric > 0;
  return out;
exception when others then
  return '[]'::jsonb;
end; $fn$;

-- Inside the covered area? An address with no coordinates is not checked, which is
-- what the function did before.
create or replace function public._in_delivery_zone(p_lat float8, p_lng float8)
returns boolean language plpgsql stable security definer set search_path to 'public' as $fn$
declare v_zones jsonb := public._delivery_zones();
begin
  if p_lat is null or p_lng is null then return true; end if;
  if jsonb_array_length(v_zones) = 0 then
    return public._haversine_km(
             public._setting_num('laundry_lat', 30.0444)::float8,
             public._setting_num('laundry_lng', 31.2357)::float8,
             p_lat, p_lng) <= public._setting_num('max_zone_km', 30)::float8;
  end if;
  return exists (
    select 1 from jsonb_array_elements(v_zones) z
    where public._haversine_km((z->>'lat')::float8, (z->>'lng')::float8, p_lat, p_lng)
          <= (z->>'radius_km')::float8);
end; $fn$;

-- The fee. A zone may carry its own flat `fee`; otherwise it is the base plus the
-- kilometres past the free ones, which is the arithmetic the cart already performs,
-- so the customer is shown the number that gets stored.
create or replace function public._delivery_fee_for(p_lat float8, p_lng float8)
returns numeric language plpgsql stable security definer set search_path to 'public' as $fn$
declare
  v_zones jsonb := public._delivery_zones();
  v_base numeric := public._setting_num0('delivery_fee', 0);
  v_per  numeric := public._setting_num0('price_per_km', 2);
  v_free numeric := public._setting_num0('base_delivery_km', 5);
  v_dist numeric; v_zone_fee numeric;
begin
  if p_lat is null or p_lng is null then return v_base; end if;
  select (z->>'fee')::numeric into v_zone_fee
  from jsonb_array_elements(v_zones) with ordinality t(z, ord)
  where (z->>'fee') ~ '^[0-9]+(\.[0-9]+)?$'
    and public._haversine_km((z->>'lat')::float8, (z->>'lng')::float8, p_lat, p_lng)
        <= (z->>'radius_km')::float8
  order by ord limit 1;
  if v_zone_fee is not null then return v_zone_fee; end if;
  v_dist := public._haversine_km(
              public._setting_num('laundry_lat', 30.0444)::float8,
              public._setting_num('laundry_lng', 31.2357)::float8,
              p_lat, p_lng)::numeric;
  return v_base + case when v_dist > v_free then round((v_dist - v_free) * v_per) else 0 end;
end; $fn$;
