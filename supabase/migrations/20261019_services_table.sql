-- Services table: metadata + enable/disable per service_type
-- When a service is disabled, all prices with that service_type are disabled too (cascade via trigger)

CREATE TABLE IF NOT EXISTS public.services (
  code         text PRIMARY KEY,  -- matches service_type enum values
  name_ar      text NOT NULL,
  icon         text DEFAULT '🧺',
  sort_order   int  NOT NULL DEFAULT 0,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Seed with current service types (idempotent)
INSERT INTO public.services (code, name_ar, icon, sort_order) VALUES
  ('wash',         'غسيل',                '🧺', 1),
  ('iron',         'كوي',                 '👔', 2),
  ('wash_iron',    'غسيل وكوي',           '✨', 3),
  ('dry_clean',    'تنظيف جاف',           '🥼', 4),
  ('housekeeping', 'تنظيف منازل',         '🏠', 5),
  ('carpet',       'سجاد وبطاطين',        '🪔', 6),
  ('accessories',  'منتجات وإكسسوارات',   '🎁', 7)
ON CONFLICT (code) DO NOTHING;

-- Trigger: cascade is_active to prices rows with matching service_type
CREATE OR REPLACE FUNCTION public.cascade_service_active_to_prices()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    UPDATE public.prices
       SET is_active = NEW.is_active
     WHERE service_type::text = NEW.code;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_service_active ON public.services;
CREATE TRIGGER trg_cascade_service_active
BEFORE UPDATE ON public.services
FOR EACH ROW
EXECUTE FUNCTION public.cascade_service_active_to_prices();

-- RLS
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS services_select_all ON public.services;
CREATE POLICY services_select_all ON public.services
  FOR SELECT USING (true);

DROP POLICY IF EXISTS services_modify_staff ON public.services;
CREATE POLICY services_modify_staff ON public.services
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users u
             WHERE u.id = auth.uid()
               AND u.role IN ('super_admin','admin','manager'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u
             WHERE u.id = auth.uid()
               AND u.role IN ('super_admin','admin','manager'))
  );
