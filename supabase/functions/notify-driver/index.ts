import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload = await req.json();
    const { type, record, old_record } = payload;

    // Only handle UPDATE where driver_id changed (new assignment)
    if (type !== "UPDATE") {
      return new Response(JSON.stringify({ skipped: "not an update" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newDriverId = record.driver_id;
    const oldDriverId = old_record?.driver_id;

    // Check if driver was just assigned (wasn't assigned before, or changed)
    if (!newDriverId || newDriverId === oldDriverId) {
      return new Response(JSON.stringify({ skipped: "no driver change" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get driver's push token
    const { data: driver } = await supabase
      .from("users")
      .select("fcm_token, name")
      .eq("id", newDriverId)
      .single();

    if (!driver?.fcm_token) {
      return new Response(JSON.stringify({ skipped: "no fcm_token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get customer name
    const { data: customer } = await supabase
      .from("users")
      .select("name")
      .eq("id", record.customer_id)
      .single();

    const isDelivery = record.delivery_driver_id === newDriverId && oldDriverId !== newDriverId;
    const title = isDelivery ? "مطلوب توصيل! 🚗" : "طلب جديد! 🔔";
    const body = isDelivery
      ? `الطلب #${record.order_number} جاهز للتوصيل — ${customer?.name || "عميل"}`
      : `تم تعيين الطلب #${record.order_number} لك — ${customer?.name || "عميل"} — ${record.items_count || 0} قطعة`;

    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: driver.fcm_token,
        title,
        body,
        sound: "new-order.wav",
        channelId: "new-order",
        priority: "high",
        data: { type: "new_order", order_id: record.id },
      }),
    });

    // Also check delivery_driver_id change
    const newDeliveryDriverId = record.delivery_driver_id;
    const oldDeliveryDriverId = old_record?.delivery_driver_id;

    if (newDeliveryDriverId && newDeliveryDriverId !== oldDeliveryDriverId && newDeliveryDriverId !== newDriverId) {
      const { data: deliveryDriver } = await supabase
        .from("users")
        .select("fcm_token")
        .eq("id", newDeliveryDriverId)
        .single();

      if (deliveryDriver?.fcm_token) {
        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: deliveryDriver.fcm_token,
            title: "مطلوب توصيل! 🚗",
            body: `الطلب #${record.order_number} جاهز للتوصيل — ${customer?.name || "عميل"}`,
            sound: "new-order.wav",
            channelId: "new-order",
            priority: "high",
            data: { type: "new_order", order_id: record.id },
          }),
        });
      }
    }

    console.log("Push sent to driver", newDriverId, "for order", record.order_number);

    return new Response(JSON.stringify({ sent: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
