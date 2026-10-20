-- The first cascade trigger re-enabled EVERY price of a service when that service was
-- re-enabled, wiping out prices the admin had deliberately switched off (seasonal items,
-- retired variants). Record the admin's own intent separately so re-enabling a service
-- only restores the rows the cascade itself turned off.

ALTER TABLE public.prices
  ADD COLUMN IF NOT EXISTS manually_disabled boolean NOT NULL DEFAULT false;

-- Backfill: a price that is off while its service is still ON can only have been turned
-- off by hand. A price that is off while its service is OFF is attributed to the cascade.
-- (Rows disabled by hand *before* their service was disabled are indistinguishable now —
-- that information was already lost — so they are treated as cascade.)
UPDATE public.prices p
   SET manually_disabled = true
  FROM public.services s
 WHERE s.code = p.service_type::text
   AND p.is_active = false
   AND s.is_active = true;

CREATE OR REPLACE FUNCTION public.cascade_service_active_to_prices()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    IF NEW.is_active THEN
      -- Re-enable only what the cascade switched off; leave the admin's own choices alone.
      UPDATE public.prices
         SET is_active = true
       WHERE service_type::text = NEW.code
         AND manually_disabled = false;
    ELSE
      UPDATE public.prices
         SET is_active = false
       WHERE service_type::text = NEW.code;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
