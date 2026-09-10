import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ADMIN_ROLES = ['admin', 'super_admin', 'manager', 'accountant']

export async function requireAdmin(req: NextRequest): Promise<{ userId: string; role: string } | NextResponse> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return req.cookies.getAll() }, setAll() {} } }
  )

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'غير مصرح — سجل الدخول أولاً' }, { status: 401 })
  }

  const { data: profile } = await supabaseAdmin.from('users').select('role, is_active').eq('id', session.user.id).single()
  if (!profile || !ADMIN_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'غير مصرح — صلاحيات غير كافية' }, { status: 403 })
  }
  if (profile.is_active === false) {
    return NextResponse.json({ error: 'الحساب معطل' }, { status: 403 })
  }

  return { userId: session.user.id, role: profile.role }
}

export async function logAudit(userId: string, action: string, entityType: string, entityId: string, details?: Record<string, unknown>) {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details: details ?? {},
      created_at: new Date().toISOString(),
    })
  } catch {}
}
