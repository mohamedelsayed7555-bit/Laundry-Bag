'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import DataTable from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { Crown, Eye, Check, X } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import PermissionGate from '@/components/ui/PermissionGate'

const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  active: 'success',
  pending: 'warning',
  cancelled: 'danger',
  expired: 'neutral',
  paused: 'info',
}

const statusLabels: Record<string, string> = {
  active: 'نشط',
  pending: 'في الانتظار',
  cancelled: 'ملغي',
  expired: 'منتهي',
  paused: 'متوقف',
}

const durationLabels: Record<string, string> = {
  monthly: 'شهري',
  quarterly: 'ربع سنوي',
  biannual: 'نصف سنوي',
  annual: 'سنوي',
}

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [detail, setDetail] = useState<any>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadSubs()
    const ch = supabase.channel('subs-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, () => loadSubs())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  async function loadSubs() {
    const { data } = await supabase
      .from('subscriptions')
      .select('*, user:users!subscriptions_user_id_fkey(name, phone, customer_code), plans(name)')
      .order('created_at', { ascending: false })
    setSubs(data ?? [])
    setLoading(false)
  }

  async function activateSub(sub: any) {
    const now = new Date()
    const months = sub.duration === 'monthly' ? 1 : sub.duration === 'quarterly' ? 3 : sub.duration === 'biannual' ? 6 : 12
    const endDate = new Date(now)
    endDate.setMonth(endDate.getMonth() + months)

    await supabase.from('subscriptions').update({
      status: 'active',
      start_date: now.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
    }).eq('id', sub.id)

    const planName = sub.plans?.name ?? 'الباقة'
    await supabase.from('notifications').insert({
      user_id: sub.user_id,
      title: 'تم تفعيل اشتراكك',
      body: `تم قبول وتفعيل اشتراكك في باقة ${planName}. يمكنك الآن إنشاء طلباتك.`,
      type: 'system',
      data: { subscription_id: sub.id },
      sent_at: new Date().toISOString(),
    })

    const { data: userData } = await supabase.from('users').select('fcm_token').eq('id', sub.user_id).single()
    if (userData?.fcm_token) {
      fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: userData.fcm_token,
          title: 'تم تفعيل اشتراكك ✅',
          body: `تم قبول وتفعيل اشتراكك في باقة ${planName}. يمكنك الآن إنشاء طلباتك.`,
          sound: 'default',
          data: { type: 'subscription', subscription_id: sub.id },
        }),
      }).catch(() => {})
    }

    loadSubs()
    setDetail(null)
    toast('تم تفعيل الاشتراك بنجاح')
  }

  async function rejectSub(id: string) {
    await supabase.from('subscriptions').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', id)
    loadSubs()
    setDetail(null)
    toast('تم رفض الاشتراك', 'warning')
  }

  async function cancelSub(id: string) {
    await supabase.from('subscriptions').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', id)
    loadSubs()
    setDetail(null)
    toast('تم إلغاء الاشتراك', 'warning')
  }

  const allStatuses = ['all', 'pending', 'active', 'cancelled', 'expired']
  const filtered = subs.filter(s => statusFilter === 'all' || s.status === statusFilter)
  const pendingCount = subs.filter(s => s.status === 'pending').length

  const columns = [
    { key: 'user', label: 'العميل', render: (item: any) => (
      <div>
        <p className="font-medium text-gray-800">{item.user?.name ?? '—'}</p>
        <p className="text-[10px] text-gray-400">{item.user?.phone}</p>
      </div>
    )},
    { key: 'plan', label: 'الباقة', render: (item: any) => <span className="font-semibold text-gray-700">{item.plans?.name ?? '—'}</span> },
    { key: 'duration', label: 'المدة', render: (item: any) => <span className="text-gray-600 text-xs">{durationLabels[item.duration] ?? item.duration}</span> },
    { key: 'items', label: 'القطع', render: (item: any) => <span className="text-gray-600">{item.items_used ?? 0} / {item.items_limit}</span> },
    { key: 'total_paid', label: 'المبلغ', render: (item: any) => <span className="font-semibold text-gray-800">{item.total_paid ? `${item.total_paid} ج.م` : '—'}</span> },
    { key: 'status', label: 'الحالة', render: (item: any) => <Badge variant={statusVariant[item.status] ?? 'neutral'}>{statusLabels[item.status] ?? item.status}</Badge> },
    { key: 'actions', label: '', render: (item: any) => (
      <div className="flex gap-1">
        {item.status === 'pending' && (
          <>
            <button onClick={() => activateSub(item)} className="p-1.5 hover:bg-green-50 rounded-lg transition-colors" title="تفعيل">
              <Check size={15} className="text-green-500" />
            </button>
            <button onClick={() => rejectSub(item.id)} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors" title="رفض">
              <X size={15} className="text-red-500" />
            </button>
          </>
        )}
        <button onClick={() => setDetail(item)} className="p-1.5 hover:bg-surface-muted rounded-lg transition-colors">
          <Eye size={15} className="text-gray-400 hover:text-gray-600" />
        </button>
      </div>
    )},
  ]

  return (
    <PermissionGate permission="plans.manage">
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary-500" /> إدارة الاشتراكات
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {subs.length} اشتراك
            {pendingCount > 0 && <span className="text-amber-500 font-semibold mr-2">• {pendingCount} في الانتظار</span>}
          </p>
        </div>
      </motion.div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {allStatuses.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-2 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap ${statusFilter === s ? 'bg-navy-900 text-white shadow-premium-md' : 'bg-white text-gray-500 hover:bg-surface-muted border border-surface-border/60'}`}>
            {s === 'all' ? 'الكل' : statusLabels[s] ?? s}
            {s === 'pending' && pendingCount > 0 && <span className="mr-1 bg-amber-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{pendingCount}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-[3px] border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <DataTable columns={columns} data={filtered} emptyMessage="لا توجد اشتراكات" />
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title="تفاصيل الاشتراك">
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'العميل', value: detail.user?.name },
                { label: 'الباقة', value: detail.plans?.name },
                { label: 'الحالة', value: <Badge variant={statusVariant[detail.status]}>{statusLabels[detail.status]}</Badge> },
                { label: 'المدة', value: durationLabels[detail.duration] },
                { label: 'المبلغ', value: `${detail.total_paid ?? '—'} ج.م` },
                { label: 'تاريخ البداية', value: detail.start_date ?? '—' },
                { label: 'تاريخ الانتهاء', value: detail.end_date ?? '—' },
                { label: 'الأيام المتبقية', value: detail.end_date ? `${Math.max(0, Math.ceil((new Date(detail.end_date).getTime() - Date.now()) / 86400000))} يوم` : '—' },
              ].map((item, i) => (
                <div key={i} className="bg-surface-muted/50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 mb-0.5">{item.label}</p>
                  <div className="text-sm font-semibold text-gray-800">{item.value}</div>
                </div>
              ))}
            </div>

            {/* Items Progress */}
            {detail.status === 'active' && (
              <div className="bg-surface-muted/50 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-gray-500">القطع المستخدمة</span>
                  <span className="text-sm font-bold text-gray-800">{detail.items_used ?? 0} / {detail.items_limit}</span>
                </div>
                <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${Math.min(100, ((detail.items_used ?? 0) / detail.items_limit) * 100)}%` }} />
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5">متبقي {detail.items_limit - (detail.items_used ?? 0)} قطعة</p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              {detail.status === 'pending' && (
                <>
                  <button onClick={() => activateSub(detail)}
                    className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-l from-green-500 to-green-600 text-white p-3 rounded-xl font-semibold text-sm hover:shadow-lg transition-all">
                    <Check size={16} /> تفعيل الاشتراك
                  </button>
                  <button onClick={() => rejectSub(detail.id)}
                    className="px-4 py-3 border border-red-200 text-red-500 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors">
                    رفض
                  </button>
                </>
              )}
              {detail.status === 'active' && (
                <button onClick={() => cancelSub(detail.id)}
                  className="px-4 py-3 border border-red-200 text-red-500 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors">
                  إلغاء الاشتراك
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
    </PermissionGate>
  )
}
