import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "");
  if (!authHeader || (authHeader !== cronSecret && authHeader !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const now = new Date().toISOString();

  const { data: dueOrders, error } = await supabase
    .from("orders")
    .select("id, order_number, customer_id")
    .eq("status", "scheduled")
    .eq("is_scheduled", true)
    .lte("scheduled_at", now);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // --- Activate scheduled orders ---
  let activatedCount = 0;
  const ids: string[] = [];
  if (dueOrders && dueOrders.length > 0) {
    ids.push(...dueOrders.map((o) => o.id));

    // Find least-busy active driver (same logic as the DB trigger)
    const { data: drivers } = await supabase
      .from("users")
      .select("id")
      .eq("role", "driver")
      .eq("is_active", true);

    let driver: { id: string } | null = null;
    if (drivers && drivers.length > 0) {
      // Count active orders per driver and pick the least busy
      const counts = await Promise.all(
        drivers.map(async (d) => {
          const { count } = await supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("driver_id", d.id)
            .not("status", "in", '("delivered","cancelled","refunded")');
          return { id: d.id, count: count ?? 0 };
        })
      );
      counts.sort((a, b) => a.count - b.count);
      driver = { id: counts[0].id };
    }

    // If we have a driver, assign directly; otherwise set to pending
    const newStatus = driver ? "assigned" : "pending";

    const updatePayload: Record<string, unknown> = { status: newStatus };
    if (driver) updatePayload.driver_id = driver.id;

    const { error: updateError } = await supabase
      .from("orders")
      .update(updatePayload)
      .in("id", ids);

    if (!updateError) {
      activatedCount = ids.length;
      for (const order of dueOrders) {
        await supabase.from("order_status_history").insert({
          order_id: order.id,
          status: newStatus,
          note: driver
            ? "تم تفعيل الطلب المجدول وتعيين سائق تلقائياً"
            : "تم تفعيل الطلب المجدول تلقائياً",
        });
      }

      for (const order of dueOrders) {
        // Notify customer
        const { data: user } = await supabase
          .from("users")
          .select("fcm_token")
          .eq("id", order.customer_id)
          .single();

        if (user?.fcm_token) {
          fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: user.fcm_token,
              title: "تم تفعيل طلبك المجدول",
              body: `الطلب #${order.order_number} أصبح نشطاً الآن`,
              sound: "default",
              data: { type: "order_activated", order_id: order.id },
            }),
          }).catch(() => {});
        }

        // Notify driver
        if (driver) {
          const { data: driverUser } = await supabase
            .from("users")
            .select("fcm_token")
            .eq("id", driver.id)
            .single();

          if (driverUser?.fcm_token) {
            fetch("https://exp.host/--/api/v2/push/send", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                to: driverUser.fcm_token,
                title: "طلب جديد! 🔔",
                body: `تم تعيين الطلب #${order.order_number} لك`,
                sound: "new_order.wav",
                channelId: "new-order",
                priority: "high",
                data: { type: "new_order", order_id: order.id },
              }),
            }).catch(() => {});
          }
        }
      }
    }
  }

  // --- Cancel stale unpaid orders (pending payment > 24 hours) ---
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: staleOrders } = await supabase
    .from("orders")
    .select("id, order_number, customer_id")
    .eq("payment_status", "pending")
    .in("payment_method", ["visa", "e_wallet"])
    .not("status", "in", '("cancelled","refunded","delivered")')
    .lt("created_at", cutoff);

  let cancelledCount = 0;
  if (staleOrders && staleOrders.length > 0) {
    const staleIds = staleOrders.map((o) => o.id);
    await supabase
      .from("orders")
      .update({ status: "cancelled", cancellation_reason: "إلغاء تلقائي — لم يتم الدفع خلال 24 ساعة", cancelled_at: now })
      .in("id", staleIds);

    for (const o of staleOrders) {
      await supabase.from("order_status_history").insert({
        order_id: o.id,
        status: "cancelled",
        note: "إلغاء تلقائي — لم يتم الدفع خلال 24 ساعة",
      });
    }
    cancelledCount = staleIds.length;
  }

  // --- Cancel orphaned pending orders (no driver assigned after 48 hours) ---
  const orphanCutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: orphanedOrders } = await supabase
    .from("orders")
    .select("id, order_number, customer_id")
    .eq("status", "pending")
    .is("driver_id", null)
    .lt("created_at", orphanCutoff);

  let orphanedCount = 0;
  if (orphanedOrders && orphanedOrders.length > 0) {
    const orphanIds = orphanedOrders.map((o) => o.id);
    await supabase
      .from("orders")
      .update({ status: "cancelled", cancellation_reason: "إلغاء تلقائي — لم يتم تعيين سائق خلال 48 ساعة", cancelled_at: now })
      .in("id", orphanIds);

    for (const o of orphanedOrders) {
      await supabase.from("order_status_history").insert({
        order_id: o.id,
        status: "cancelled",
        note: "إلغاء تلقائي — لم يتم تعيين سائق خلال 48 ساعة",
      });

      const { data: user } = await supabase.from("users").select("fcm_token").eq("id", o.customer_id).single();
      if (user?.fcm_token) {
        fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: user.fcm_token,
            title: "تم إلغاء طلبك",
            body: `الطلب #${o.order_number} تم إلغاؤه تلقائياً لعدم توفر سائق. يمكنك إعادة الطلب.`,
            sound: "default",
            data: { type: "order_cancelled", order_id: o.id },
          }),
        }).catch(() => {});
      }
    }
    orphanedCount = orphanIds.length;
  }

  return new Response(
    JSON.stringify({
      message: `Activated ${activatedCount}, cancelled ${cancelledCount} unpaid, cancelled ${orphanedCount} orphaned`,
      activated: activatedCount,
      cancelled: cancelledCount,
      orphaned: orphanedCount,
      order_ids: ids,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
