-- The dashboard home and the reports page each downloaded every matching row of public.orders
-- and reduced in JavaScript. PostgREST caps that response (max-rows, 1000 by default) and
-- truncates silently, so past the cap those figures would quietly under-report while the
-- home's totalOrders — taken from an exact count — stayed correct. Aggregate server-side.
--
-- Revenue is NOT redefined here. Home and reports each had their own rule and disagreed with
-- the finance page (home counted only payment_status='confirmed'; reports summed every
-- non-cancelled order's total, over-counting refunds and ignoring subscriptions). Both now
-- delegate to get_finance_stats, so "total revenue" has exactly one definition in the product.
--
-- Deliberately unchanged: "delivered today" still means orders CREATED today whose status is
-- delivered, measured in UTC. Both are arguable, but changing them here would silently move
-- numbers the owner already reads.

CREATE OR REPLACE FUNCTION public.dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_fin  json;
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
  IF v_role IS NULL OR v_role IN ('customer', 'driver') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_fin := public.get_finance_stats(NULL, NULL);

  RETURN jsonb_build_object(
    'totalRevenue',   coalesce((v_fin->>'order_revenue')::numeric, 0)
                    + coalesce((v_fin->>'subs_revenue')::numeric, 0),
    'totalOrders',    (SELECT count(*) FROM public.orders),
    'totalCustomers', (SELECT count(*) FROM public.users WHERE role = 'customer'),
    'totalDrivers',   (SELECT count(*) FROM public.users WHERE role = 'driver'),
    'activeOrders',   (SELECT count(*) FROM public.orders
                        WHERE status NOT IN ('delivered', 'cancelled', 'refunded')),
    'deliveredToday', (SELECT count(*) FROM public.orders
                        WHERE status = 'delivered'
                          AND created_at >= date_trunc('day', now() AT TIME ZONE 'utc'))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.report_stats(
  p_from timestamptz DEFAULT NULL,
  p_to   timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_fin  json;
  v_result jsonb;
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
  IF v_role IS NULL OR v_role IN ('customer', 'driver') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_fin := public.get_finance_stats(p_from, p_to);

  WITH scoped AS (
    SELECT status, service_type
    FROM public.orders
    WHERE (p_from IS NULL OR created_at >= p_from)
      AND (p_to   IS NULL OR created_at <= p_to)
  )
  SELECT jsonb_build_object(
    'totalOrders',  (SELECT count(*) FROM scoped),
    'totalRevenue', coalesce((v_fin->>'order_revenue')::numeric, 0)
                  + coalesce((v_fin->>'subs_revenue')::numeric, 0),
    'ordersByStatus',  coalesce((SELECT jsonb_object_agg(status, n)
                                   FROM (SELECT status, count(*) AS n FROM scoped GROUP BY status) s), '{}'::jsonb),
    'ordersByService', coalesce((SELECT jsonb_object_agg(service_type, n)
                                   FROM (SELECT service_type, count(*) AS n FROM scoped
                                          WHERE service_type IS NOT NULL GROUP BY service_type) s), '{}'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_stats() FROM public, anon;
REVOKE ALL ON FUNCTION public.report_stats(timestamptz, timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_stats(timestamptz, timestamptz) TO authenticated;
