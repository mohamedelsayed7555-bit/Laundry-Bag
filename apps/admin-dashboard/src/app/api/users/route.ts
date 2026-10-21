import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { requireAdmin, logAudit } from '@/lib/api-auth'
import { issueResetCode, unknowablePassword, WELCOME_TTL_MINUTES } from '@/lib/reset-codes'

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
  const { name, phone, email, role, tier, vehicle_type, vehicle_number } = body

  // The role came straight from the request body, so any staff account could have
  // created an admin here. Only a super_admin may hand out privileged roles, and
  // only known roles are accepted at all.
  const ALLOWED_ROLES = ['customer', 'driver', 'manager', 'accountant', 'admin', 'super_admin']
  const PRIVILEGED_ROLES = ['admin', 'super_admin']
  const wanted = role || 'customer'
  if (!ALLOWED_ROLES.includes(wanted)) {
    return NextResponse.json({ error: 'دور غير معروف' }, { status: 400 })
  }
  if (PRIVILEGED_ROLES.includes(wanted) && auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'فقط الـ Super Admin يمكنه إنشاء حسابات بهذا الدور' }, { status: 403 })
  }
  if (['manager', 'accountant'].includes(wanted) && !PRIVILEGED_ROLES.includes(auth.role)) {
    return NextResponse.json({ error: 'غير مصرح — صلاحيات غير كافية' }, { status: 403 })
  }

  if (email) {
    const { data: existing } = await supabaseAdmin.from('users').select('id').eq('email', email).maybeSingle()
    if (existing) {
      return NextResponse.json({ error: 'البريد الإلكتروني مستخدم بالفعل' }, { status: 400 })
    }
  }

  // Normalise before checking AND before storing. The unique index compares strings, so
  // "010 1111 1111" and "01011111111" would both get in and become two accounts for one
  // number — and the phone is what recovery and dispatch look an account up by.
  const normalizedPhone = phone ? String(phone).replace(/[\s-]/g, '') : ''
  if (normalizedPhone) {
    if (!/^01[0125]\d{8}$/.test(normalizedPhone)) {
      return NextResponse.json({ error: 'رقم الموبايل غير صحيح — يجب أن يبدأ بـ 01 ويكون 11 رقم' }, { status: 400 })
    }
    const { data: existing } = await supabaseAdmin.from('users').select('id').eq('phone', normalizedPhone).maybeSingle()
    if (existing) {
      return NextResponse.json({ error: 'رقم الموبايل مستخدم بالفعل' }, { status: 400 })
    }
  }

  // A customer's password is his alone: staff neither choose it nor see it. The account
  // is created with a value nobody will ever know, and the customer sets a real one with
  // the recovery code handed to him below. Staff accounts are still provisioned with a
  // password, because somebody has to give the new employee his first login.
  const isCustomer = wanted === 'customer'
  let password = typeof body.password === 'string' ? body.password.trim() : ''
  if (isCustomer) {
    password = unknowablePassword()
  } else if (password) {
    if (password.length < 8) {
      return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' }, { status: 400 })
    }
  } else {
    password = Math.random().toString(36).slice(-10) + 'A1!'
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: email || `${Date.now()}@cleano.temp`,
    password,
    email_confirm: true,
    user_metadata: { name, role: wanted },
    app_metadata: { role: wanted },
  })

  if (authError) {
    let msg = authError.message
    if (/password/i.test(msg)) msg = 'كلمة المرور ضعيفة — لازم تحتوي على حروف كبيرة وصغيرة وأرقام ورموز'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const updates: Record<string, any> = { name, role: wanted }
  if (normalizedPhone) updates.phone = normalizedPhone
  if (tier) updates.tier = tier
  if (vehicle_type) updates.vehicle_type = vehicle_type
  if (vehicle_number) updates.vehicle_number = vehicle_number

  await supabaseAdmin.from('users').update(updates).eq('id', authData.user.id)

  await logAudit(auth.userId, 'create_user', 'user', authData.user.id, { name, role: wanted })

  if (isCustomer) {
    const issued = await issueResetCode(authData.user.id, auth.userId, WELCOME_TTL_MINUTES)
    if (!issued) {
      // The account exists but cannot be handed over; say so rather than pretend.
      return NextResponse.json(
        { error: 'تم إنشاء الحساب لكن تعذّر إصدار كود الاستلام — أصدره من زر المفتاح' },
        { status: 500 }
      )
    }
    return NextResponse.json({
      success: true,
      id: authData.user.id,
      code: issued.code,
      expiresInMinutes: issued.expiresInMinutes,
      phone: normalizedPhone,
      name,
    })
  }

  return NextResponse.json({ success: true, id: authData.user.id, password })
}
