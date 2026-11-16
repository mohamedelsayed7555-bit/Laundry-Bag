-- Curtains were repriced onto the owner's sheet this morning - 15 to iron, 17 to
-- wash and iron - but the rows kept unit 'piece', so the app offered a plus
-- button and charged 15 EGP to iron a whole curtain whatever its size.
--
-- A curtain is measured across its width, one number, the way curtain fabric is
-- sold and tailored. That is a third unit: 'sqm' takes a length and a width,
-- 'meter' takes one side.

alter table public.prices drop constraint if exists prices_unit_chk;
alter table public.prices add constraint prices_unit_chk check (unit in ('piece', 'sqm', 'meter'));

update public.prices set unit = 'meter', updated_at = now()
 where item_type = 'ستائر (سعر المتر)' and unit <> 'meter';

-- the measurement that travels with the line may now be a single number as well
-- as a length by a width; everything else about this function is unchanged.
-- The body is reproduced in full because CREATE OR REPLACE takes no patch.

CREATE OR REPLACE FUNCTION public._price_items(p_items jsonb)
 RETURNS TABLE(items jsonb, cart_total numeric, item_count integer, services text[])
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_item jsonb;
  v_qty integer;
  v_price numeric;
  v_size text;
begin
  items := '[]'::jsonb; cart_total := 0; item_count := 0; services := '{}';
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_cart';
  end if;
  if jsonb_array_length(p_items) > 100 then
    raise exception 'too_many_items';
  end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    begin
      v_qty := (v_item->>'quantity')::integer;
    exception when others then
      raise exception 'invalid_quantity';
    end;
    if v_qty is null or v_qty < 1 or v_qty > 500 then
      raise exception 'invalid_quantity';
    end if;
    select pr.price into v_price from public.prices pr
    where pr.item_type = v_item->>'name' and pr.service_type = v_item->>'service_type' and pr.is_active;
    if v_price is null then
      raise exception 'unknown_item';
    end if;
    -- The measurement is shown to staff and to the customer, so nothing but a
    -- plain "L x W" survives. A line that fails the shape loses its size rather
    -- than failing the order: the price never depended on this field.
    v_size := nullif(btrim(coalesce(v_item->>'size', '')), '');
    if v_size is not null
       and v_size !~ '^[0-9]{1,3}(\.[0-9]{1,2})?([ ]*[x×*][ ]*[0-9]{1,3}(\.[0-9]{1,2})?)?$' then
      v_size := null;
    end if;
    -- strip_nulls keeps a line without a size byte-identical to what this
    -- function produced before the column existed
    items := items || jsonb_strip_nulls(jsonb_build_object(
      'name', v_item->>'name',
      'service_type', v_item->>'service_type',
      'quantity', v_qty,
      'price', v_price,
      'size', v_size));
    cart_total := cart_total + v_price * v_qty;
    item_count := item_count + v_qty;
    if not ((v_item->>'service_type') = any(services)) then
      services := services || (v_item->>'service_type');
    end if;
  end loop;
  return next;
end;
$function$;
