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
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const rawAuth = req.headers.get("authorization");
  const authHeader = req.headers.get("x-cron-secret") || rawAuth?.replace("Bearer ", "");

  console.log("Auth check:", {
    hasCronSecret: !!cronSecret,
    hasServiceRoleKey: !!serviceRoleKey,
    hasAuthHeader: !!authHeader,
    authHeaderLen: authHeader?.length,
    serviceRoleKeyLen: serviceRoleKey?.length,
    rawAuthPrefix: rawAuth?.substring(0, 20),
    matchesCron: authHeader === cronSecret,
    matchesServiceRole: authHeader === serviceRoleKey,
  });

  if (!authHeader || (authHeader !== cronSecret && authHeader !== serviceRoleKey)) {
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
  // Each order goes back to "pending"; the database trigger (auto_assign_on_status) picks the driver
  // closest to the customer with the fewest orders, and the triggers notify the driver and customer.
  let activatedCount = 0;
  const ids: string[] = [];
  if (dueOrders && dueOrders.length > 0) {
    for (const order of dueOrders) {
      const { data: updated, error: updateError } = await supabase
        .from("orders")
        .update({ status: "pending" })
        .eq("id", order.id)
        .eq("status", "scheduled")
        .select("status, driver_id")
        .single();
      if (updateError || !updated) continue;

      ids.push(order.id);
      activatedCount++;
      const assigned = !!updated.driver_id;
      await supabase.from("order_status_history").insert({
        order_id: order.id,
        status: updated.status,
        note: assigned
          ? "تم تفعيل الطلب المجدول وتعيين سائق تلقائياً"
          : "تم تفعيل الطلب المجدول تلقائياً",
      });

      // With a driver the customer already gets "driver assigned"; without one, say the order is active.
      if (!assigned) {
        const { data: user } = await supabase
          .from("users")
          .select("fcm_token, preferred_language")
          .eq("id", order.customer_id)
          .single();
        if (user?.fcm_token) {
          const en = user.preferred_language === "en";
          const num = String(order.order_number ?? "").replace(/^#+/, "");
          await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: user.fcm_token,
              title: en ? "Your scheduled order is active" : "تم تفعيل طلبك المجدول",
              body: en ? `Order #${num} is now active` : `الطلب #${num} أصبح نشطاً الآن`,
              sound: "order_update.wav",
              channelId: "order-updates-v2",
              priority: "high",
              data: { type: "order_update", order_id: order.id, status: updated.status },
            }),
          }).catch(() => {});
        }
      }
    }
  }

  // --- Cancel stale unpaid orders (pending payment > 24 hours) ---
  // (the customer is notified by the database trigger on the status change)
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
  // (the customer is notified by the database trigger on the status change)
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
