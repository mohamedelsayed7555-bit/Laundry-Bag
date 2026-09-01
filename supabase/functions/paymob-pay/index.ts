import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const PAYMOB_API_KEY = Deno.env.get("PAYMOB_API_KEY")!;
const CARD_INTEGRATION_ID = 5736172;
const WALLET_INTEGRATION_ID = 5736188;
const IFRAME_ID = 1054112;

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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { order_id, payment_method, wallet_phone } = await req.json();
    if (!order_id) throw new Error("order_id required");

    const { data: order } = await supabase
      .from("orders")
      .select("id, order_number, total, customer_id")
      .eq("id", order_id)
      .single();

    if (!order || order.customer_id !== user.id) throw new Error("Order not found");

    const { data: profile } = await supabase
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
    const { token: authToken } = await authRes.json();

    // Step 2: Order Registration
    const amountCents = Math.round(order.total * 100);
    const orderRes = await fetch("https://accept.paymob.com/api/ecommerce/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_token: authToken,
        delivery_needed: false,
        amount_cents: amountCents,
        currency: "EGP",
        merchant_order_id: order.order_number || order.id,
        items: [],
      }),
    });
    const paymobOrder = await orderRes.json();

    // Step 3: Payment Key
    const isWallet = payment_method === "wallet";
    const integrationId = isWallet ? WALLET_INTEGRATION_ID : CARD_INTEGRATION_ID;

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
      }),
    });
    const { token: paymentKey } = await paymentKeyRes.json();

    // Save paymob order id
    await supabase
      .from("orders")
      .update({ paymob_order_id: String(paymobOrder.id) })
      .eq("id", order_id);

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
