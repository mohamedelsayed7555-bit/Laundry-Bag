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

  const password = Math.random().toString(36).slice(-10) + 'A1!'

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: email || `${Date.now()}@cleano.temp`,
    password,
    email_confirm: true,
    user_metadata: { name, role: role || 'customer' },
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  const updates: Record<string, any> = { name, role: role || 'customer' }
  if (phone) updates.phone = phone
  if (tier) updates.tier = tier
  if (vehicle_type) updates.vehicle_type = vehicle_type
  if (vehicle_number) updates.vehicle_number = vehicle_number

  await supabaseAdmin.from('users').update(updates).eq('id', authData.user.id)

  return NextResponse.json({ success: true, id: authData.user.id })
}
