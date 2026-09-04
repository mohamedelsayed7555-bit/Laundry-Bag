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

  if (!dueOrders || dueOrders.length === 0) {
    return new Response(
      JSON.stringify({ message: "No scheduled orders due", activated: 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const ids = dueOrders.map((o) => o.id);

  const { error: updateError } = await supabase
    .from("orders")
    .update({ status: "pending" })
    .in("id", ids);

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  for (const order of dueOrders) {
    await supabase.from("order_status_history").insert({
      order_id: order.id,
      status: "pending",
      note: "تم تفعيل الطلب المجدول تلقائياً",
    });
  }

  // Send push notifications to customers
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

  return new Response(
    JSON.stringify({
      message: `Activated ${ids.length} scheduled orders`,
      activated: ids.length,
      order_ids: ids,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
