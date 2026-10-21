import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Sends a password-reset link to the address already on the account.
 *
 * The customer gives his phone number, never an e-mail: letting him type one would mean
 * anyone could point a reset at an inbox they own. The address is looked up here and the
 * reply only ever shows it masked, so the endpoint cannot be used to discover someone's
 * e-mail from their phone number either.
 *
 * Nobody at Laundry Bag is involved in this path at all — which is the point.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const REDIRECT_TO = "cleano://reset-password";
// Addresses we generated for accounts with no real inbox; a link there goes nowhere.
const PLACEHOLDER_DOMAIN = "@cleano.temp";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** "mohamed@gmail.com" -> "m•••d@gmail.com": enough to recognise, not enough to learn. */
function mask(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return "•••";
  const head = local.slice(0, 1);
  const tail = local.length > 3 ? local.slice(-1) : "";
  return `${head}•••${tail}@${domain}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let body: { phone?: string };
  try {
    body = await req.json();
  } catch {
    return json({ sent: false });
  }

  const phone = (body.phone ?? "").trim();
  if (!/^01[0-9]{9}$/.test(phone)) {
    return json({ sent: false });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: user } = await admin
    .from("users")
    .select("id, role, is_active")
    .eq("phone", phone)
    .maybeSingle();

  if (!user || user.role !== "customer" || user.is_active === false) {
    return json({ sent: false });
  }

  // The address comes from the auth record, not from public.users: that column is a
  // mirror, and a reset must go to the identity the customer actually signs in with.
  const { data: authUser } = await admin.auth.admin.getUserById(user.id);
  const email = authUser?.user?.email ?? "";

  // Every failure looks the same from outside: no account, a staff account, a disabled
  // one, or one with no real inbox all answer "nothing was sent".
  if (!email || email.endsWith(PLACEHOLDER_DOMAIN)) {
    return json({ sent: false });
  }

  // resetPasswordForEmail is a public-client call: it sends the mail through the
  // project's configured SMTP and only ever delivers to an address that exists.
  const pub = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const { error } = await pub.auth.resetPasswordForEmail(email, {
    redirectTo: REDIRECT_TO,
  });

  if (error) {
    // Most often the project's hourly mail quota; the customer should be told to wait
    // rather than stare at a screen claiming a mail is on its way.
    return json({ sent: false, retry: true });
  }

  return json({ sent: true, masked: mask(email) });
});
