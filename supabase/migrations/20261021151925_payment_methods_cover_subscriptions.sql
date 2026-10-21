-- Hiding the button in the app is presentation; this is the rule. An older build, or a
-- request sent straight to the API, is refused the same way.
--
-- Subscriptions take a payment method too, so the same switch governs them. Without it,
-- turning the card off would stop orders but still let someone buy a plan with it.
--
-- The subscription screen calls the wallet 'wallet' while orders call it 'e_wallet'.
-- They are the same method, so the check treats them as one rather than renaming a code
-- that existing subscription rows already carry.

create or replace function public.assert_payment_method_enabled()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  ok boolean;
  code text;
begin
  if new.payment_method is null then
    return new;
  end if;

  -- An existing row keeps the method it was created with, so switching a method off
  -- never breaks past orders, subscriptions or their refunds.
  if tg_op = 'UPDATE' and new.payment_method is not distinct from old.payment_method then
    return new;
  end if;

  -- A missing configuration must never take ordering down.
  if not exists (select 1 from settings where key = 'payment_methods') then
    return new;
  end if;

  code := case when new.payment_method = 'wallet' then 'e_wallet' else new.payment_method end;

  select exists (
    select 1
    from settings s,
         lateral jsonb_array_elements(s.value) m
    where s.key = 'payment_methods'
      and m->>'code' = code
      and (m->>'enabled')::boolean
  ) into ok;

  if not ok then
    raise exception 'وسيلة الدفع دي غير متاحة حالياً' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists subscriptions_payment_method_enabled on public.subscriptions;
create trigger subscriptions_payment_method_enabled
  before insert or update of payment_method on public.subscriptions
  for each row execute function public.assert_payment_method_enabled();
