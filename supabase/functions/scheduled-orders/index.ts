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

    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: "pending" })
      .in("id", ids);

    if (!updateError) {
      activatedCount = ids.length;
      for (const order of dueOrders) {
        await supabase.from("order_status_history").insert({
          order_id: order.id,
          status: "pending",
          note: "تم تفعيل الطلب المجدول تلقائياً",
        });
      }

      for (const order of dueOrders) {
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

  return new Response(
    JSON.stringify({
      message: `Activated ${activatedCount} scheduled orders, cancelled ${cancelledCount} stale unpaid orders`,
      activated: activatedCount,
      cancelled: cancelledCount,
      order_ids: ids,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
