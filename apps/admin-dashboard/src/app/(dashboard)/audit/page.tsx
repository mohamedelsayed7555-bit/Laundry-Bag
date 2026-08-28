'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { motion } from 'framer-motion'
import Badge from '@/components/ui/Badge'
import {
  ScrollText, ShoppingBag, Users, Crown, Settings, Search,
  ArrowRightLeft, UserPlus, UserMinus, Truck, Plus, Edit2, Trash2, Power, Filter,
} from 'lucide-react'

interface AuditLog {
  id: string
  user_id: string
  action: string
  entity_type: string
  entity_id: string | null
  details: any
  created_at: string
  actor?: { name: string; avatar_url: string | null; role: string } | null
}

const actionConfig: Record<string, { label: string; icon: typeof Plus; variant: 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral' }> = {
  create: { label: 'إنشاء', icon: Plus, variant: 'success' },
  update: { label: 'تعديل', icon: Edit2, variant: 'info' },
  delete: { label: 'حذف', icon: Trash2, variant: 'danger' },
  status_change: { label: 'تغيير حالة', icon: ArrowRightLeft, variant: 'purple' },
  assign_driver: { label: 'تعيين سائق', icon: Truck, variant: 'info' },
  toggle_active: { label: 'تفعيل/إلغاء', icon: Power, variant: 'warning' },
  change_role: { label: 'تغيير صلاحية', icon: Settings, variant: 'purple' },
}

const entityConfig: Record<string, { label: string; icon: typeof ShoppingBag }> = {
  order: { label: 'طلب', icon: ShoppingBag },
  user: { label: 'مستخدم', icon: Users },
  plan: { label: 'باقة', icon: Crown },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'الآن'
  if (mins < 60) return `منذ ${mins} دقيقة`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `منذ ${hours} ساعة`
  const days = Math.floor(hours / 24)
  return `منذ ${days} يوم`
}

function fullDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) +
    ' — ' + d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function buildDescription(log: AuditLog): string {
  const d = log.details || {}
  switch (log.action) {
    case 'create':
      if (log.entity_type === 'order') return `أنشأ طلب ${d.order_number || ''} بقيمة ${d.total || 0} ج.م`
      if (log.entity_type === 'user') return `أضاف مستخدم "${d.name}" بدور ${d.role}`
      if (log.entity_type === 'plan') return `أنشأ باقة "${d.name}" بسعر ${d.price} ج.م`
      return 'إنشاء عنصر جديد'
    case 'status_change':
      return `غيّر حالة الطلب ${d.order_number || ''} من "${d.from}" إلى "${d.to}"`
    case 'assign_driver':
      return `عيّن سائق للطلب ${d.order_number || ''}`
    case 'toggle_active':
      return `${d.is_active ? 'فعّل' : 'ألغى تفعيل'} المستخدم "${d.name}"`
    case 'change_role':
      return `غيّر صلاحية "${d.name}" من ${d.from} إلى ${d.to}`
    case 'update':
      if (log.entity_type === 'plan') return `عدّل الباقة "${d.name}"`
      return 'تعديل عنصر'
    case 'delete':
      if (log.entity_type === 'order') return `حذف الطلب ${d.order_number || ''}`
      if (log.entity_type === 'plan') return `حذف الباقة "${d.name}"`
      return 'حذف عنصر'
    default:
      return log.action
  }
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [entityFilter, setEntityFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [limit, setLimit] = useState(50)

  useEffect(() => { loadLogs() }, [limit])

  async function loadLogs() {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) { console.error('audit_logs error:', error); setLoading(false); return }

    const logs = data ?? []
    const userIds = [...new Set(logs.map(l => l.user_id).filter(Boolean))]
    let usersMap: Record<string, { name: string; avatar_url: string | null; role: string }> = {}
    if (userIds.length > 0) {
      const orFilter = userIds.map(id => `id.eq.${id}`).join(',')
      const { data: users, error: usersError } = await supabase.from('users').select('id, name, role').or(orFilter)
      if (usersError) console.error('users fetch error:', usersError)
      for (const u of users ?? []) usersMap[u.id] = { name: u.name, avatar_url: null, role: u.role }
    }
    setLogs(logs.map(l => ({ ...l, actor: usersMap[l.user_id] || null })))
    setLoading(false)
  }

  const filtered = logs.filter(log => {
    if (entityFilter !== 'all' && log.entity_type !== entityFilter) return false
    if (actionFilter !== 'all' && log.action !== actionFilter) return false
    if (roleFilter !== 'all' && (log.actor?.role || '') !== roleFilter) return false
    if (search) {
      const s = search.toLowerCase()
      const desc = buildDescription(log).toLowerCase()
      const actorName = (log.actor?.name || '').toLowerCase()
      if (!desc.includes(s) && !actorName.includes(s)) return false
    }
    return true
  })

  const uniqueActions = [...new Set(logs.map(l => l.action))]
  const uniqueEntities = [...new Set(logs.map(l => l.entity_type))]

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-primary-500" /> سجل النشاطات
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">تتبع جميع العمليات التي تتم على النظام</p>
        </div>
        <div className="text-sm text-gray-400">{filtered.length} سجل</div>
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="بحث بالاسم أو العملية..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pr-10 pl-4 py-2.5 bg-white border border-surface-border/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-500/30 transition-all" />
        </div>
        <select value={entityFilter} onChange={e => setEntityFilter(e.target.value)}
          className="px-3 py-2.5 bg-white border border-surface-border/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/15 transition-all">
          <option value="all">كل الأقسام</option>
          {uniqueEntities.map(e => <option key={e} value={e}>{entityConfig[e]?.label || e}</option>)}
        </select>
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
          className="px-3 py-2.5 bg-white border border-surface-border/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/15 transition-all">
          <option value="all">كل العمليات</option>
          {uniqueActions.map(a => <option key={a} value={a}>{actionConfig[a]?.label || a}</option>)}
        </select>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className="px-3 py-2.5 bg-white border border-surface-border/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/15 transition-all">
          <option value="all">كل المستخدمين</option>
          <option value="admin">المديرين</option>
          <option value="super_admin">المدير العام</option>
          <option value="manager">المشرفين</option>
          <option value="driver">السائقين</option>
          <option value="customer">العملاء</option>
        </select>
      </motion.div>

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-[3px] border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-premium border border-surface-border/60 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-muted flex items-center justify-center mx-auto mb-4">
            <ScrollText size={28} className="text-gray-300" />
          </div>
          <h3 className="font-semibold text-gray-800 mb-1">لا توجد سجلات</h3>
          <p className="text-sm text-gray-400">ستظهر هنا جميع العمليات التي تتم على النظام</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-premium border border-surface-border/60 overflow-hidden">
          <div className="divide-y divide-surface-border/40">
            {filtered.map((log, i) => {
              const ac = actionConfig[log.action] || { label: log.action, icon: Settings, variant: 'neutral' as const }
              const ec = entityConfig[log.entity_type] || { label: log.entity_type, icon: Settings }
              const ActionIcon = ac.icon
              const EntityIcon = ec.icon

              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.5) }}
                  className="flex items-start gap-4 px-5 py-4 hover:bg-surface-muted/30 transition-colors"
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-accent-purple/80 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 mt-0.5 overflow-hidden">
                    {log.actor?.avatar_url ? (
                      <img src={log.actor.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      log.actor?.name?.[0] ?? '?'
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="font-bold text-sm text-gray-800">{log.actor?.name ?? 'نظام'}</span>
                      {log.actor?.role && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          log.actor.role === 'admin' || log.actor.role === 'super_admin' ? 'bg-purple-100 text-purple-600' :
                          log.actor.role === 'driver' ? 'bg-emerald-100 text-emerald-600' :
                          log.actor.role === 'customer' ? 'bg-blue-100 text-blue-600' :
                          log.actor.role === 'manager' ? 'bg-amber-100 text-amber-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {log.actor.role === 'admin' ? 'مدير' : log.actor.role === 'super_admin' ? 'مدير عام' :
                           log.actor.role === 'driver' ? 'سائق' : log.actor.role === 'customer' ? 'عميل' :
                           log.actor.role === 'manager' ? 'مشرف' : log.actor.role === 'accountant' ? 'محاسب' : log.actor.role}
                        </span>
                      )}
                      <Badge variant={ac.variant}>
                        <ActionIcon size={10} className="ml-1" />
                        {ac.label}
                      </Badge>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <EntityIcon size={12} /> {ec.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed mb-1.5">{buildDescription(log)}</p>
                    <div className="flex items-center gap-3">
                      <p className="text-[11px] text-gray-400">{fullDateTime(log.created_at)}</p>
                      <span className="text-[10px] text-primary-500 font-medium">({timeAgo(log.created_at)})</span>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {logs.length >= limit && (
            <div className="px-5 py-3 border-t border-surface-border/40 text-center">
              <button onClick={() => setLimit(l => l + 50)}
                className="text-sm text-primary-500 font-medium hover:text-primary-600 transition-colors">
                تحميل المزيد...
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
