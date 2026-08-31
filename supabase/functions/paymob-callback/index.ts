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
      const orderId = url.searchParams.get("merchant_order_id");
      const html = success
        ? `<html><body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;background:#0f172a;color:#fff;flex-direction:column"><h1>✅</h1><h2>تم الدفع بنجاح</h2><p>يمكنك إغلاق هذه الصفحة</p></body></html>`
        : `<html><body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;background:#0f172a;color:#fff;flex-direction:column"><h1>❌</h1><h2>فشل الدفع</h2><p>يرجى المحاولة مرة أخرى</p></body></html>`;
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    // POST - webhook from Paymob
    const body = await req.json();
    const obj = body.obj;

    // Verify HMAC
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

    if (calculatedHmac !== receivedHmac) {
      return new Response(JSON.stringify({ error: "Invalid HMAC" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
