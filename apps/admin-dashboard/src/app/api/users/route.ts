import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { name, phone, email, role, tier, vehicle_type, vehicle_number } = body

  if (email) {
    const { data: existing } = await supabaseAdmin.from('users').select('id').eq('email', email).maybeSingle()
    if (existing) {
      return NextResponse.json({ error: 'البريد الإلكتروني مستخدم بالفعل' }, { status: 400 })
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
