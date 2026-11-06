-- The dashboard's general Settings tab reads every setting into a text box and writes
-- it straight back, so one press of "save" re-stored each JSON setting as a JSON string.
-- That turned payment_methods into a scalar, assert_payment_method_enabled raised on
-- jsonb_array_elements, and every order failed - cash included.
--
-- Five settings kept their content and only need unwrapping. payment_methods lost
-- its content and is restored from the seed in migration 20261021151253.

create table if not exists fn_backup.settings_snapshots (
  taken_at timestamptz not null default now(),
  reason   text,
  key      text not null,
  value    jsonb not null,
  primary key (taken_at, key)
);
alter table fn_backup.settings_snapshots enable row level security;
revoke all on table fn_backup.settings_snapshots from public, anon, authenticated;

insert into fn_backup.settings_snapshots (reason, key, value)
select 'before un-stringifying JSON settings', key, value from public.settings;

-- 1. Unwrap every setting whose JSON was stored as a string.
update public.settings
set value = (value #>> '{}')::jsonb
where jsonb_typeof(value) = 'string'
  and left(value #>> '{}', 1) in ('[', '{');

-- 2. Restore the four payment methods, verbatim from the original seed. The enabled
--    flags are the seed's; they are the owner's to change from the dashboard.
update public.settings
set value = '[
          {"code":"cash","label_ar":"كاش","label_en":"Cash","note_ar":"بتدفع للمندوب وقت الاستلام.","note_en":"Pay the driver on pickup.","enabled":true,"sort":1},
          {"code":"instapay","label_ar":"إنستاباي","label_en":"InstaPay","note_ar":"حوّل على الرقم من تطبيق إنستاباي، أو من أي محفظة موبايل، أو تحويل بنكي عادي — كله على نفس الرقم.","note_en":"Transfer to the number from the InstaPay app, any mobile wallet, or a normal bank transfer — all to the same number.","enabled":true,"sort":2},
          {"code":"visa","label_ar":"فيزا / ماستركارد","label_en":"Visa / Mastercard","note_ar":"دفع أونلاين بالكارت، بيتأكد فوراً.","note_en":"Online card payment, confirmed instantly.","enabled":false,"sort":3},
          {"code":"e_wallet","label_ar":"محفظة إلكترونية","label_en":"E-Wallet","note_ar":"فودافون كاش وغيرها، بتدفع من تطبيق المحفظة.","note_en":"Vodafone Cash and similar, paid from your wallet app.","enabled":false,"sort":4}
        ]'::jsonb
where key = 'payment_methods';

-- 3. A malformed setting must never take ordering down again. The guard now only
--    enforces the rule when the value really is an array; anything else is treated
--    as "not configured", which the function already allows.
create or replace function public.assert_payment_method_enabled()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  ok   boolean;
  code text;
begin
  if new.payment_method is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.payment_method is not distinct from old.payment_method then
    return new;
  end if;

  -- A missing *or malformed* configuration must never take ordering down.
  if not exists (
    select 1 from settings
    where key = 'payment_methods' and jsonb_typeof(value) = 'array'
  ) then
    return new;
  end if;

  code := case when new.payment_method = 'wallet' then 'e_wallet' else new.payment_method end;

  select exists (
    select 1
    from settings s,
         lateral jsonb_array_elements(s.value) m
    where s.key = 'payment_methods'
      and jsonb_typeof(s.value) = 'array'
      and m->>'code' = code
      and (m->>'enabled')::boolean
  ) into ok;

  if not ok then
    raise exception 'payment_method_disabled' using errcode = '23514';
  end if;

  return new;
end;
$fn$;
