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
  const { name, email, password, phone, role, permissions } = body

  if (!email || !password || !name || !role) {
    return NextResponse.json({ error: 'الاسم والإيميل وكلمة المرور والدور مطلوبين' }, { status: 400 })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: 'صيغة البريد الإلكتروني غير صحيحة' }, { status: 400 })
  }

  const { data: existing } = await supabaseAdmin.from('users').select('id').eq('email', email).maybeSingle()
  if (existing) {
    return NextResponse.json({ error: 'البريد الإلكتروني مستخدم بالفعل' }, { status: 400 })
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role },
  })

  if (authError) {
    console.error('Auth createUser error:', authError.message, authError)
    if (authError.message?.includes('already been registered') || authError.message?.includes('already exists')) {
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 50 })
      const existingAuth = listData?.users?.find((u: any) => u.email === email)
      if (existingAuth) {
        await supabaseAdmin.auth.admin.updateUserById(existingAuth.id, { password, user_metadata: { name, role } })
        const updates: Record<string, any> = { name, role, email, permissions: permissions || [], is_active: true }
        if (phone) updates.phone = phone
        await supabaseAdmin.from('users').upsert({ id: existingAuth.id, ...updates })
        return NextResponse.json({ success: true, id: existingAuth.id })
      }
    }
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  const updates: Record<string, any> = { name, role, email, permissions: permissions || [] }
  if (phone) updates.phone = phone

  await supabaseAdmin.from('users').update(updates).eq('id', authData.user.id)

  return NextResponse.json({ success: true, id: authData.user.id })
}
