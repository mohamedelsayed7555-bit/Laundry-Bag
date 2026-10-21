import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { requireAdmin, logAudit } from '@/lib/api-auth'
import { issueResetCode, RESET_TTL_MINUTES } from '@/lib/reset-codes'

/**
 * Issues a one-time recovery code for a customer.
 *
 * Staff verify who they are talking to exactly as before, but what they hand over is a
 * code, not a password: the customer types it in the app and chooses the password there.
 * So no member of staff ever knows a customer's password or can sign in as him — which
 * is the whole point, and something the customer can be told and can verify.
 */

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth

  const { userId } = await request.json()
  if (!userId) {
    return NextResponse.json({ error: 'معرف المستخدم مطلوب' }, { status: 400 })
  }

  const { data: target } = await supabaseAdmin
    .from('users')
    .select('id, role, is_active, name, phone')
    .eq('id', userId)
    .single()

  if (!target) {
    return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
  }
  // Staff credentials are provisioned, customer credentials are not: this route is
  // only the customer path, so it cannot be used to take over a colleague's account.
  if (target.role !== 'customer') {
    return NextResponse.json({ error: 'الكود ده للعملاء فقط' }, { status: 403 })
  }
  if (target.is_active === false) {
    return NextResponse.json({ error: 'الحساب معطل — فعّله الأول' }, { status: 400 })
  }
  if (!target.phone) {
    return NextResponse.json({ error: 'العميل ده مالوش رقم موبايل مسجّل' }, { status: 400 })
  }

  const issued = await issueResetCode(target.id, auth.userId, RESET_TTL_MINUTES)
  if (!issued) {
    return NextResponse.json({ error: 'تعذّر إنشاء الكود' }, { status: 500 })
  }

  await logAudit(auth.userId, 'issue_reset_code', 'user', target.id, {
    phone: target.phone,
    expiresInMinutes: issued.expiresInMinutes,
  })

  return NextResponse.json({
    success: true,
    code: issued.code,
    expiresInMinutes: issued.expiresInMinutes,
    phone: target.phone,
    name: target.name,
  })
}
