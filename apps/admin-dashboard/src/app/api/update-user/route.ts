import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { requireAdmin, logAudit } from '@/lib/api-auth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth
  const body = await request.json()
  const { userId, email, password } = body

  if (!userId) {
    return NextResponse.json({ error: 'معرف المستخدم مطلوب' }, { status: 400 })
  }

  const updates: Record<string, any> = {}
  if (email) {
    updates.email = email
    updates.email_confirm = false
  }
  if (password) {
    if (password.length < 6) {
      return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }, { status: 400 })
    }
    updates.password = password
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'لا توجد بيانات للتحديث' }, { status: 400 })
  }

  if (email) {
    const { data: existing } = await supabaseAdmin.from('users').select('id').eq('email', email).neq('id', userId).maybeSingle()
    if (existing) {
      return NextResponse.json({ error: 'البريد الإلكتروني مستخدم بالفعل' }, { status: 400 })
    }
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, updates)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await logAudit(auth.userId, 'update_user', 'user', userId, { emailChanged: !!email, passwordChanged: !!password })

  return NextResponse.json({
    success: true,
    emailPending: !!email,
  })
}
