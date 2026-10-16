import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { requireAdmin } from '@/lib/api-auth'

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

  if (phone) {
    if (!/^01[0125]\d{8}$/.test(phone.replace(/\s|-/g, ''))) {
      return NextResponse.json({ error: 'رقم الموبايل غير صحيح — يجب أن يبدأ بـ 01 ويكون 11 رقم' }, { status: 400 })
    }
    const { data: existing } = await supabaseAdmin.from('users').select('id').eq('phone', phone).maybeSingle()
    if (existing) {
      return NextResponse.json({ error: 'رقم الموبايل مستخدم بالفعل' }, { status: 400 })
    }
  }

  // An admin may set an initial password (so it can be handed to the customer to
  // log in with); otherwise a random one is generated. Either way the value is
  // returned to the caller to show once, since the account is unusable until
  // someone knows it.
  let password = typeof body.password === 'string' ? body.password.trim() : ''
  if (password) {
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
  if (phone) updates.phone = phone
  if (tier) updates.tier = tier
  if (vehicle_type) updates.vehicle_type = vehicle_type
  if (vehicle_number) updates.vehicle_number = vehicle_number

  await supabaseAdmin.from('users').update(updates).eq('id', authData.user.id)

  return NextResponse.json({ success: true, id: authData.user.id, password })
}
