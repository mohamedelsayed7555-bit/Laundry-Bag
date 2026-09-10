import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const PAYMOB_API_KEY = Deno.env.get("PAYMOB_API_KEY")!;
const CARD_INTEGRATION_ID = Number(Deno.env.get("PAYMOB_CARD_INTEGRATION_ID") || "5736172");
const IFRAME_ID = Number(Deno.env.get("PAYMOB_IFRAME_ID") || "1054112");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

  const today = new Date().toISOString().split("T")[0];

  // Find active subscriptions whose end_date has passed
  const { data: expiredSubs, error } = await supabase
    .from("subscriptions")
    .select("id, user_id, plan_id, duration, auto_renew, total_paid, payment_method, plans(name, items_per_month, monthly_price, quarterly_price, biannual_price, annual_price)")
    .eq("status", "active")
    .lte("end_date", today);

  if (error) {
    console.error("Error fetching expired subs:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!expiredSubs || expiredSubs.length === 0) {
    return new Response(JSON.stringify({ message: "No expired subscriptions", processed: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: { id: string; action: string; success: boolean }[] = [];

  for (const sub of expiredSubs) {
    const plan = sub.plans as any;

    if (!sub.auto_renew) {
      // No auto-renew: expire it
      await supabase
        .from("subscriptions")
        .update({ status: "expired" })
        .eq("id", sub.id);

      await supabase.from("notifications").insert({
        user_id: sub.user_id,
        title: "انتهت باقتك 📋",
        body: `انتهت باقة "${plan?.name || "الباقة"}". يمكنك تجديدها من صفحة الباقات.`,
        type: "system",
        data: { subscription_id: sub.id },
        sent_at: new Date().toISOString(),
      });

      results.push({ id: sub.id, action: "expired", success: true });
      continue;
    }

    // Auto-renew: try to charge
    const price = sub.total_paid;
    const paymentMethod = sub.payment_method;

    // For cash/instapay: create new pending subscription (needs manual approval)
    if (paymentMethod === "cash" || paymentMethod === "instapay") {
      const months = sub.duration === "monthly" ? 1 : sub.duration === "quarterly" ? 3 : sub.duration === "biannual" ? 6 : 12;

      await supabase
        .from("subscriptions")
        .update({ status: "expired" })
        .eq("id", sub.id);

      const { data: newSub } = await supabase.from("subscriptions").insert({
        user_id: sub.user_id,
        plan_id: sub.plan_id,
        duration: sub.duration,
        status: "pending",
        items_used: 0,
        items_limit: (plan?.items_per_month || 0) * months,
        auto_renew: true,
        payment_method: paymentMethod,
        total_paid: price,
      }).select("id").single();

      await supabase.from("notifications").insert({
        user_id: sub.user_id,
        title: "تجديد تلقائي — في انتظار الدفع 🔄",
        body: `تم تجديد باقة "${plan?.name}" تلقائياً. يرجى الدفع لتفعيلها.`,
        type: "system",
        data: { subscription_id: newSub?.id },
        sent_at: new Date().toISOString(),
      });

      results.push({ id: sub.id, action: "renewed_pending_payment", success: true });
      continue;
    }

    // For visa/wallet: try Paymob auto-charge
    try {
      // Get user info
      const { data: profile } = await supabase
        .from("users")
        .select("name, phone, email")
        .eq("id", sub.user_id)
        .single();

      // Paymob auth
      const authRes = await fetch("https://accept.paymob.com/api/auth/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: PAYMOB_API_KEY }),
      });
      const { token: authToken } = await authRes.json();
      if (!authToken) throw new Error("Paymob auth failed");

      // Create order
      const amountCents = Math.round(price * 100);
      const merchantOrderId = `RENEW-${sub.id.slice(0, 8)}-${Date.now()}`;
      const orderRes = await fetch("https://accept.paymob.com/api/ecommerce/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auth_token: authToken,
          delivery_needed: false,
          amount_cents: amountCents,
          currency: "EGP",
          merchant_order_id: merchantOrderId,
          items: [],
        }),
      });
      const paymobOrder = await orderRes.json();
      if (!paymobOrder.id) throw new Error("Order creation failed");

      // Expire old subscription
      await supabase
        .from("subscriptions")
        .update({ status: "expired" })
        .eq("id", sub.id);

      // Create new subscription as pending with paymob order ID
      const months = sub.duration === "monthly" ? 1 : sub.duration === "quarterly" ? 3 : sub.duration === "biannual" ? 6 : 12;
      const { data: newSub } = await supabase.from("subscriptions").insert({
        user_id: sub.user_id,
        plan_id: sub.plan_id,
        duration: sub.duration,
        status: "pending",
        items_used: 0,
        items_limit: (plan?.items_per_month || 0) * months,
        auto_renew: true,
        payment_method: paymentMethod,
        total_paid: price,
        paymob_order_id: String(paymobOrder.id),
      }).select("id").single();

      // Payment key
      const nameParts = (profile?.name || "Customer").split(" ");
      const paymentKeyRes = await fetch("https://accept.paymob.com/api/acceptance/payment_keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auth_token: authToken,
          amount_cents: amountCents,
          expiration: 3600,
          order_id: paymobOrder.id,
          billing_data: {
            first_name: nameParts[0] || "N/A",
            last_name: nameParts.slice(1).join(" ") || "N/A",
            email: profile?.email || "na@na.com",
            phone_number: profile?.phone || "01000000000",
            apartment: "N/A", floor: "N/A", street: "N/A", building: "N/A",
            shipping_method: "N/A", postal_code: "N/A", city: "N/A", country: "EG", state: "N/A",
          },
          currency: "EGP",
          integration_id: CARD_INTEGRATION_ID,
        }),
      });
      const { token: paymentKey } = await paymentKeyRes.json();

      // Notify user to complete payment
      const iframeUrl = `https://accept.paymob.com/api/acceptance/iframes/${IFRAME_ID}?payment_token=${paymentKey}`;

      await supabase.from("notifications").insert({
        user_id: sub.user_id,
        title: "تجديد تلقائي — ادفع الآن 💳",
        body: `باقة "${plan?.name}" انتهت. تم إنشاء طلب دفع تلقائي (${price} ج.م). افتح الإشعار لإتمام الدفع.`,
        type: "system",
        data: { subscription_id: newSub?.id, payment_url: iframeUrl },
        sent_at: new Date().toISOString(),
      });

      results.push({ id: sub.id, action: "renewal_payment_initiated", success: true });
    } catch (e) {
      console.error("Auto-renewal payment failed for sub:", sub.id, e);

      // Payment failed: expire and notify
      await supabase
        .from("subscriptions")
        .update({ status: "expired" })
        .eq("id", sub.id);

      await supabase.from("notifications").insert({
        user_id: sub.user_id,
        title: "فشل تجديد الباقة ❌",
        body: `فشل الدفع التلقائي لباقة "${plan?.name}". يمكنك تجديدها يدوياً من صفحة الباقات. طلباتك ستكون بأسعار عادية.`,
        type: "system",
        data: { subscription_id: sub.id },
        sent_at: new Date().toISOString(),
      });

      results.push({ id: sub.id, action: "renewal_failed", success: false });
    }
  }

  return new Response(JSON.stringify({
    message: `Processed ${results.length} expired subscriptions`,
    results,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
