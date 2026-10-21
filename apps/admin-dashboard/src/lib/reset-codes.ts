import { createClient } from '@supabase/supabase-js'
import { createHash, randomInt } from 'crypto'

/**
 * Issuing a one-time recovery code.
 *
 * This is the only way staff hand access to a customer — on a new account and on a
 * forgotten password alike. Staff never choose or see a password, so no one here can
 * sign in as a customer, and the customer can be told that and check it for himself.
 */

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/** Long enough to walk a customer through it, short enough not to sit around. */
export const RESET_TTL_MINUTES = 15
/** A brand-new account is unusable until redeemed, so it gets a longer window. */
export const WELCOME_TTL_MINUTES = 60

export async function issueResetCode(
  userId: string,
  issuedBy: string,
  ttlMinutes: number = RESET_TTL_MINUTES
): Promise<{ code: string; expiresInMinutes: number } | null> {
  // randomInt draws from the CSPRNG; Math.random would be guessable.
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const codeHash = createHash('sha256').update(code).digest('hex')
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString()

  // Any code still outstanding for this customer stops working.
  await supabaseAdmin
    .from('password_reset_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('used_at', null)

  const { error } = await supabaseAdmin.from('password_reset_codes').insert({
    user_id: userId,
    code_hash: codeHash,
    expires_at: expiresAt,
    issued_by: issuedBy,
  })

  if (error) return null
  return { code, expiresInMinutes: ttlMinutes }
}

/**
 * A password for an account whose owner will replace it with the recovery code before
 * ever signing in. It is never returned to the caller and never logged — it exists only
 * because an auth account needs one.
 */
export function unknowablePassword() {
  return `${randomInt(0, 1_000_000_000).toString(36)}${randomInt(0, 1_000_000_000).toString(36)}Aa1!`
}
