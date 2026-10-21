import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * The customer redeems a recovery code and sets his own password.
 *
 * Support never learns the result: the code only unlocks this endpoint, and the password
 * is chosen here, by the customer, on his own device. Every redemption revokes all other
 * sessions, so a code that leaked cannot leave someone else signed in.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Deliberately vague: it must not say whether the phone exists or the code was wrong.
const GENERIC = "الكود غير صحيح أو انتهت صلاحيته";
const MAX_ATTEMPTS = 5;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function passwordIsStrong(password: string) {
  return password.length >= 8 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let body: { phone?: string; code?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: GENERIC }, 400);
  }

  const phone = (body.phone ?? "").trim();
  const code = (body.code ?? "").trim();
  const password = body.password ?? "";

  if (!/^01[0-9]{9}$/.test(phone) || !/^[0-9]{6}$/.test(code)) {
    return json({ error: GENERIC }, 400);
  }
  if (!passwordIsStrong(password)) {
    return json({
      error:
        "كلمة المرور لازم تكون 8 حروف على الأقل وتحتوي على حروف كبيرة وصغيرة وأرقام ورموز",
    }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: user } = await supabase
    .from("users")
    .select("id, role, is_active")
    .eq("phone", phone)
    .maybeSingle();

  if (!user || user.role !== "customer" || user.is_active === false) {
    return json({ error: GENERIC }, 400);
  }

  // Only the newest unused code counts, so issuing a new one invalidates the old in practice.
  const { data: candidate } = await supabase
    .from("password_reset_codes")
    .select("id, code_hash, expires_at, used_at, attempts")
    .eq("user_id", user.id)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!candidate || new Date(candidate.expires_at) < new Date()) {
    return json({ error: GENERIC }, 400);
  }
  if (candidate.attempts >= MAX_ATTEMPTS) {
    // Burn it rather than let someone keep guessing six digits.
    await supabase
      .from("password_reset_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("id", candidate.id);
    return json({ error: GENERIC }, 400);
  }

  if (await sha256(code) !== candidate.code_hash) {
    await supabase
      .from("password_reset_codes")
      .update({ attempts: candidate.attempts + 1 })
      .eq("id", candidate.id);
    return json({ error: GENERIC }, 400);
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
    password,
  });
  if (updateError) {
    return json({ error: "تعذّر تغيير كلمة المرور. حاول تاني." }, 400);
  }

  await supabase
    .from("password_reset_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", candidate.id);

  // Whoever was signed in on another device is signed out, including anyone who
  // might have intercepted the code. admin.signOut() needs a JWT we do not have here,
  // so the sessions are dropped in the database instead.
  await supabase.rpc("revoke_user_sessions", { p_user: user.id });

  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: "password_reset_redeemed",
    entity_type: "user",
    entity_id: user.id,
    details: { by: "customer" },
    created_at: new Date().toISOString(),
  });

  return json({ success: true });
});
