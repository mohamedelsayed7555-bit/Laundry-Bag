import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const HMAC_SECRET = Deno.env.get("PAYMOB_HMAC_SECRET")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function computeHmac(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (req.method === "GET") {
      const url = new URL(req.url);
      const success = url.searchParams.get("success") === "true";
      const paymobOrderId = url.searchParams.get("order");
      const txnId = url.searchParams.get("id");

      console.log("GET redirect received - success:", success, "order:", paymobOrderId, "txn:", txnId);

      if (paymobOrderId) {
        const pid = String(paymobOrderId);
        const { data: order } = await supabase
          .from("orders")
          .select("id")
          .eq("paymob_order_id", pid)
          .single();

        if (order) {
          await supabase
            .from("orders")
            .update({ payment_status: success ? "confirmed" : "failed" })
            .eq("id", order.id);
          console.log("Order payment_status updated via GET redirect:", order.id, success ? "confirmed" : "failed");
        } else {
          const { data: sub } = await supabase
            .from("subscriptions")
            .select("id, user_id, duration, plan_id, plans(name, items_per_month)")
            .eq("paymob_order_id", pid)
            .single();

          if (sub && success) {
            const months = sub.duration === "monthly" ? 1 : sub.duration === "quarterly" ? 3 : sub.duration === "biannual" ? 6 : 12;
            const now = new Date();
            const endDate = new Date(now);
            endDate.setMonth(endDate.getMonth() + months);
            const plan = sub.plans as any;
            const itemsLimit = (plan?.items_per_month || 0) * months;

            await supabase
              .from("subscriptions")
              .update({
                status: "active",
                start_date: now.toISOString().split("T")[0],
                end_date: endDate.toISOString().split("T")[0],
                items_used: 0,
                items_limit: itemsLimit,
              })
              .eq("id", sub.id);

            await supabase.from("notifications").insert({
              user_id: sub.user_id,
              title: "تم تفعيل اشتراكك ✅",
              body: `تم الدفع وتفعيل باقة ${plan?.name || "الباقة"} بنجاح. رصيدك ${itemsLimit} قطعة.`,
              type: "system",
              data: { subscription_id: sub.id },
              sent_at: new Date().toISOString(),
            });
            console.log("Subscription activated via GET redirect:", sub.id);
          } else if (sub && !success) {
            await supabase
              .from("subscriptions")
              .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
              .eq("id", sub.id);
          }
        }
      }

      const html = success
        ? `<html><body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;background:#0f172a;color:#fff;flex-direction:column"><h1>✅</h1><h2>تم الدفع بنجاح</h2><p>يمكنك إغلاق هذه الصفحة</p></body></html>`
        : `<html><body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;background:#0f172a;color:#fff;flex-direction:column"><h1>❌</h1><h2>فشل الدفع</h2><p>يرجى المحاولة مرة أخرى</p></body></html>`;
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    // POST - webhook from Paymob
    const body = await req.json();
    const obj = body.obj;

    console.log("Callback received, success:", obj.success, "order_id:", obj.order?.id);
    console.log("HMAC_SECRET set:", !!HMAC_SECRET, "length:", HMAC_SECRET?.length);

    // Verify HMAC
    if (HMAC_SECRET) {
      const hmacFields = [
        obj.amount_cents,
        obj.created_at,
        obj.currency,
        obj.error_occured,
        obj.has_parent_transaction,
        obj.id,
        obj.integration_id,
        obj.is_3d_secure,
        obj.is_auth,
        obj.is_capture,
        obj.is_refunded,
        obj.is_standalone_payment,
        obj.is_voided,
        obj.order?.id,
        obj.owner,
        obj.pending,
        obj.source_data?.pan,
        obj.source_data?.sub_type,
        obj.source_data?.type,
        obj.success,
      ];
      const concatenated = hmacFields.map(v => String(v ?? "")).join("");
      const calculatedHmac = await computeHmac(concatenated, HMAC_SECRET);
      const receivedHmac = body.hmac;

      console.log("HMAC match:", calculatedHmac === receivedHmac);
      console.log("Received HMAC (first 20):", receivedHmac?.substring(0, 20));
      console.log("Calculated HMAC (first 20):", calculatedHmac.substring(0, 20));

      if (calculatedHmac !== receivedHmac) {
        console.log("HMAC mismatch - rejecting request");
        return new Response(JSON.stringify({ error: "Invalid HMAC signature" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      console.log("No HMAC_SECRET set - skipping verification");
    }

    const paymobOrderId = String(obj.order?.id);
    const isSuccess = obj.success === true;

    // Find our order by paymob_order_id
    const { data: order } = await supabase
      .from("orders")
      .select("id")
      .eq("paymob_order_id", paymobOrderId)
      .single();

    if (order) {
      await supabase
        .from("orders")
        .update({
          payment_status: isSuccess ? "confirmed" : "failed",
        })
        .eq("id", order.id);
    } else {
      // Check if it's a subscription payment
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id, user_id, duration, plan_id, plans(name, items_per_month)")
        .eq("paymob_order_id", paymobOrderId)
        .single();

      if (sub && isSuccess) {
        const months = sub.duration === "monthly" ? 1 : sub.duration === "quarterly" ? 3 : sub.duration === "biannual" ? 6 : 12;
        const now = new Date();
        const endDate = new Date(now);
        endDate.setMonth(endDate.getMonth() + months);
        const plan = sub.plans as any;
        const itemsLimit = (plan?.items_per_month || 0) * months;

        await supabase
          .from("subscriptions")
          .update({
            status: "active",
            start_date: now.toISOString().split("T")[0],
            end_date: endDate.toISOString().split("T")[0],
            items_used: 0,
            items_limit: itemsLimit,
          })
          .eq("id", sub.id);

        await supabase.from("notifications").insert({
          user_id: sub.user_id,
          title: "تم تفعيل اشتراكك ✅",
          body: `تم الدفع وتفعيل باقة ${plan?.name || "الباقة"} بنجاح. رصيدك ${itemsLimit} قطعة.`,
          type: "system",
          data: { subscription_id: sub.id },
          sent_at: new Date().toISOString(),
        });
      } else if (sub && !isSuccess) {
        await supabase
          .from("subscriptions")
          .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
          .eq("id", sub.id);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
