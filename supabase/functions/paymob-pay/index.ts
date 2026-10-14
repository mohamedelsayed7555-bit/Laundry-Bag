import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const PAYMOB_API_KEY = Deno.env.get("PAYMOB_API_KEY")!;
const CARD_INTEGRATION_ID = Number(Deno.env.get("PAYMOB_CARD_INTEGRATION_ID") || "5736172");
const WALLET_INTEGRATION_ID = Number(Deno.env.get("PAYMOB_WALLET_INTEGRATION_ID") || "5736188");
const IFRAME_ID = Number(Deno.env.get("PAYMOB_IFRAME_ID") || "1054112");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization")!;
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // Ownership is checked explicitly below; the service client lets us record the
    // amount due and Paymob ids that customers are not allowed to write themselves.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { order_id, subscription_id, payment_method, wallet_phone } = await req.json();
    if (!order_id && !subscription_id) throw new Error("order_id or subscription_id required");

    let payAmount: number;
    let merchantOrderId: string;
    let entityType: "order" | "subscription";
    let entityId: string;

    if (subscription_id) {
      entityType = "subscription";
      entityId = subscription_id;
      const { data: sub } = await admin
        .from("subscriptions")
        .select("id, user_id, total_paid, status")
        .eq("id", subscription_id)
        .single();
      if (!sub || sub.user_id !== user.id) throw new Error("الاشتراك غير موجود");
      if (sub.status !== "pending") throw new Error("الاشتراك ده مش محتاج دفع");
      payAmount = Number(sub.total_paid || 0);
      merchantOrderId = `SUB-${subscription_id.slice(0, 8)}-${Date.now()}`;
    } else {
      entityType = "order";
      entityId = order_id;
      const { data: order } = await admin
        .from("orders")
        .select("id, order_number, total, customer_id, status, payment_status, price_difference")
        .eq("id", order_id)
        .single();
      if (!order || order.customer_id !== user.id) throw new Error("الطلب غير موجود");
      if (order.status === "cancelled") throw new Error("الطلب ملغي");
      const difference = Number(order.price_difference || 0);
      if (difference > 0) {
        payAmount = difference;
      } else if (order.payment_status === "confirmed") {
        throw new Error("الطلب مدفوع بالفعل");
      } else {
        payAmount = Number(order.total || 0);
      }
      merchantOrderId = `${order.order_number || order.id}-${Date.now()}`;
    }

    if (!(payAmount > 0)) throw new Error("مفيش مبلغ مطلوب دفعه");

    const { data: profile } = await admin
      .from("users")
      .select("name, phone, email")
      .eq("id", user.id)
      .single();

    // Step 1: Auth
    const authRes = await fetch("https://accept.paymob.com/api/auth/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: PAYMOB_API_KEY }),
    });
    const authData = await authRes.json();
    const authToken = authData.token;
    console.log("Paymob auth success:", !!authToken);
    if (!authToken) throw new Error("Paymob auth failed: " + JSON.stringify(authData));

    // Step 2: Order Registration
    const amountCents = Math.round(payAmount * 100);
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
    console.log("Paymob order response:", JSON.stringify(paymobOrder));
    if (!paymobOrder.id) throw new Error("Paymob order creation failed: " + JSON.stringify(paymobOrder));

    // Step 3: Payment Key
    const isWallet = payment_method === "wallet";
    const integrationId = isWallet ? WALLET_INTEGRATION_ID : CARD_INTEGRATION_ID;

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const callbackUrl = `${SUPABASE_URL}/functions/v1/paymob-callback`;

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
          email: profile?.email || user.email || "na@na.com",
          phone_number: profile?.phone || "01000000000",
          apartment: "N/A", floor: "N/A", street: "N/A", building: "N/A",
          shipping_method: "N/A", postal_code: "N/A", city: "N/A", country: "EG", state: "N/A",
        },
        currency: "EGP",
        integration_id: integrationId,
        notification_url: callbackUrl,
        redirection_url: callbackUrl,
      }),
    });
    const { token: paymentKey } = await paymentKeyRes.json();

    // Record the Paymob order and the exact amount the callback must see.
    if (entityType === "order") {
      await admin
        .from("orders")
        .update({ paymob_order_id: String(paymobOrder.id), amount_due: payAmount })
        .eq("id", entityId);
    } else {
      await admin
        .from("subscriptions")
        .update({ paymob_order_id: String(paymobOrder.id) })
        .eq("id", entityId);
    }

    if (isWallet) {
      // Step 4 (wallet): Call wallet pay endpoint
      const phoneNumber = wallet_phone || profile?.phone || "01000000000";
      const walletPayRes = await fetch("https://accept.paymob.com/api/acceptance/payments/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: { identifier: phoneNumber, subtype: "WALLET" },
          payment_token: paymentKey,
        }),
      });
      const walletPayData = await walletPayRes.json();

      if (walletPayData.redirect_url) {
        return new Response(JSON.stringify({
          type: "wallet",
          iframe_url: walletPayData.redirect_url,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        return new Response(JSON.stringify({
          error: walletPayData.message || "فشل في بدء الدفع بالمحفظة",
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // Card: return iframe URL
      return new Response(JSON.stringify({
        type: "card",
        iframe_url: `https://accept.paymob.com/api/acceptance/iframes/${IFRAME_ID}?payment_token=${paymentKey}`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
