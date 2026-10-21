-- Which payment methods customers may use, switchable from the dashboard.
--
-- The point is speed: if the card provider is not approved yet, is down, or has to be
-- pulled for a day, that is a toggle — not an app release waiting days on store review.
-- The Paymob integration itself is untouched; this only decides whether the method is
-- offered and whether an order carrying it is accepted.

insert into settings (key, value, description)
select 'payment_methods',
       '[
          {"code":"cash","label_ar":"كاش","label_en":"Cash","note_ar":"بتدفع للمندوب وقت الاستلام.","note_en":"Pay the driver on pickup.","enabled":true,"sort":1},
          {"code":"instapay","label_ar":"إنستاباي","label_en":"InstaPay","note_ar":"حوّل على الرقم من تطبيق إنستاباي، أو من أي محفظة موبايل، أو تحويل بنكي عادي — كله على نفس الرقم.","note_en":"Transfer to the number from the InstaPay app, any mobile wallet, or a normal bank transfer — all to the same number.","enabled":true,"sort":2},
          {"code":"visa","label_ar":"فيزا / ماستركارد","label_en":"Visa / Mastercard","note_ar":"دفع أونلاين بالكارت، بيتأكد فوراً.","note_en":"Online card payment, confirmed instantly.","enabled":false,"sort":3},
          {"code":"e_wallet","label_ar":"محفظة إلكترونية","label_en":"E-Wallet","note_ar":"فودافون كاش وغيرها، بتدفع من تطبيق المحفظة.","note_en":"Vodafone Cash and similar, paid from your wallet app.","enabled":false,"sort":4}
        ]'::jsonb,
       'وسائل الدفع المتاحة للعملاء. القفل فوري ولا يحتاج إصدار جديد من التطبيق.'
where not exists (select 1 from settings where key = 'payment_methods');

-- Hiding the button in the app is presentation; this is the rule. An older build, or a
-- request sent straight to the API, is refused the same way.
create or replace function public.assert_payment_method_enabled()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  ok boolean;
begin
  if new.payment_method is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.payment_method is not distinct from old.payment_method then
    return new;
  end if;

  if not exists (select 1 from settings where key = 'payment_methods') then
    return new;
  end if;

  select exists (
    select 1
    from settings s,
         lateral jsonb_array_elements(s.value) m
    where s.key = 'payment_methods'
      and m->>'code' = new.payment_method
      and (m->>'enabled')::boolean
  ) into ok;

  if not ok then
    raise exception 'وسيلة الدفع دي غير متاحة حالياً' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists orders_payment_method_enabled on public.orders;
create trigger orders_payment_method_enabled
  before insert or update of payment_method on public.orders
  for each row execute function public.assert_payment_method_enabled();
