import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const HMAC_SECRET = Deno.env.get("PAYMOB_HMAC_SECRET")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://accept.paymob.com",
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
      console.log("GET redirect received (display only) - success:", success);
      const html = success
        ? `<html><body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;background:#0f172a;color:#fff;flex-direction:column"><h1>✅</h1><h2>تم الدفع بنجاح</h2><p>يمكنك إغلاق هذه الصفحة</p></body></html>`
        : `<html><body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;background:#0f172a;color:#fff;flex-direction:column"><h1>❌</h1><h2>فشل الدفع</h2><p>يرجى المحاولة مرة أخرى</p></body></html>`;
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    const body = await req.json();
    const obj = body.obj;

    console.log("Callback received, success:", obj.success, "order_id:", obj.order?.id);

    if (!HMAC_SECRET) {
      console.error("PAYMOB_HMAC_SECRET not configured");
      return json({ error: "Server misconfiguration" }, 500);
    }
    {
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
      const urlHmac = new URL(req.url).searchParams.get("hmac");
      const receivedHmac = body.hmac || urlHmac;

      if (calculatedHmac !== receivedHmac) {
        console.log("HMAC mismatch - rejecting");
        return json({ error: "Invalid HMAC signature" }, 403);
      }
    }

    const paymobOrderId = String(obj.order?.id);
    const isSuccess = obj.success === true;
    console.log("Looking for paymob_order_id:", paymobOrderId, "isSuccess:", isSuccess);

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, payment_status, total, amount_due, price_difference")
      .eq("paymob_order_id", paymobOrderId)
      .maybeSingle();

    console.log("Order lookup result:", order ? `found ${order.id}` : "not found", "error:", orderErr?.message);

    if (order) {
      if (order.payment_status === "confirmed" && !(Number(order.price_difference) > 0)) {
        console.log("Order already confirmed, skipping:", order.id);
        return json({ received: true, skipped: "already_confirmed" });
      }

      if (isSuccess) {
        // amount_due is what paymob-pay asked for: the full total, or only the difference after an edit.
        const expected = order.amount_due != null ? Number(order.amount_due) : Number(order.total);
        const expectedCents = Math.round(expected * 100);
        if (obj.amount_cents !== expectedCents) {
          console.error("Amount mismatch! Expected:", expectedCents, "Got:", obj.amount_cents, "Order:", order.id);
          return json({ error: "Amount mismatch" }, 400);
        }
        const { error: updateErr } = await supabase
          .from("orders")
          .update({ payment_status: "confirmed", price_difference: 0, amount_due: null })
          .eq("id", order.id);
        console.log("Order confirmed:", updateErr ? `ERROR: ${updateErr.message}` : "success");
      } else {
        const { error: updateErr } = await supabase
          .from("orders")
          .update({ payment_status: "failed" })
          .eq("id", order.id);
        console.log("Order payment failed:", updateErr ? `ERROR: ${updateErr.message}` : "recorded");
      }
    } else {
      const { data: sub, error: subErr } = await supabase
        .from("subscriptions")
        .select("id, user_id, duration, plan_id, status, total_paid, plans(name, items_per_month)")
        .eq("paymob_order_id", paymobOrderId)
        .maybeSingle();
      console.log("Subscription lookup result:", sub ? `found ${sub.id}` : "not found", "error:", subErr?.message);

      if (sub?.status === "active") {
        console.log("Subscription already active, skipping:", sub.id);
        return json({ received: true, skipped: "already_active" });
      }

      if (sub && isSuccess) {
        const expectedCents = Math.round(Number(sub.total_paid || 0) * 100);
        if (obj.amount_cents !== expectedCents) {
          console.error("Subscription amount mismatch! Expected:", expectedCents, "Got:", obj.amount_cents, "Sub:", sub.id);
          return json({ error: "Amount mismatch" }, 400);
        }

        const months = sub.duration === "monthly" ? 1 : sub.duration === "quarterly" ? 3 : sub.duration === "biannual" ? 6 : 12;
        const now = new Date();
        const endDate = new Date(now);
        endDate.setMonth(endDate.getMonth() + months);
        const plan = sub.plans as any;
        const itemsLimit = (plan?.items_per_month || 0) * months;

        const { error: subUpdateErr } = await supabase
          .from("subscriptions")
          .update({
            status: "active",
            start_date: now.toISOString().split("T")[0],
            end_date: endDate.toISOString().split("T")[0],
            items_used: 0,
            items_limit: itemsLimit,
          })
          .eq("id", sub.id);
        console.log("Subscription update result:", subUpdateErr ? `ERROR: ${subUpdateErr.message}` : "success");

        await supabase.from("notifications").insert({
          user_id: sub.user_id,
          title: "تم تفعيل اشتراكك ✅",
          body: `تم الدفع وتفعيل باقة ${plan?.name || "الباقة"} بنجاح. رصيدك ${itemsLimit} قطعة.`,
          type: "system",
          data: { subscription_id: sub.id },
          sent_at: new Date().toISOString(),
        });
      }
      // A failed payment leaves the request pending so the customer can retry, exactly like
      // orders do. The housekeeping job cancels it if it stays unpaid for 24 hours.
    }

    return json({ received: true });
  } catch (error) {
    console.error("Callback error:", (error as Error).message);
    return json({ error: (error as Error).message }, 500);
  }
});
