-- Rugs are sold by the square metre, so a rug's quantity is its area: a 12 m²
-- rug would spend 12 items of a plan that counts pieces. Until a plan can be
-- sold in square metres, the carpet service is not covered by any plan.

-- the catch-all plan covered carpet twice over: through the flag and the list
update public.plans
   set includes_all_services = false,
       covered_services = array['wash', 'iron', 'wash_iron', 'dry_clean', 'housekeeping']::text[]
 where name = 'الباقة الشاملة';

-- this plan covered nothing BUT carpet, so it cannot survive the change as it
-- stands; it is retired rather than deleted, and comes back the day a plan can
-- carry a square-metre allowance instead of a piece count
update public.plans
   set covered_services = '{}'::text[],
       includes_all_services = false,
       is_active = false
 where name = 'باقة السجاد والبطاطين';
