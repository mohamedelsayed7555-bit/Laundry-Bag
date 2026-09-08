'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import DataTable from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { Crown, Eye, Check, X, Plus, Edit2, Trash2 } from 'lucide-react'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import PermissionGate from '@/components/ui/PermissionGate'
import { useAuth } from '@/lib/auth-context'

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

const emptyForm = {
  user_id: '',
  plan_id: '',
  duration: 'monthly',
  status: 'pending',
  items_used: 0,
  items_limit: 0,
  payment_method: 'cash',
  total_paid: 0,
  auto_renew: false,
}

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [detail, setDetail] = useState<any>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [editSub, setEditSub] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [customers, setCustomers] = useState<any[]>([])
  const [plans, setPlans] = useState<any[]>([])
  const { toast } = useToast()
  const { hasPermission } = useAuth()

  useEffect(() => {
    supabase.rpc('expire_subscriptions').then(() => loadSubs())
    loadOptions()
    const ch = supabase.channel('subs-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, () => loadSubs())
      .subscribe((status, err) => {
        if (err) console.warn('subs-rt realtime error:', err.message)
      })
    return () => { supabase.removeChannel(ch) }
  }, [])

  async function loadSubs() {
    const { data } = await supabase
      .from('subscriptions')
      .select('*, user:users!subscriptions_user_id_fkey(name, phone, customer_code), plans:plans!subscriptions_plan_id_fkey(name)')
      .order('created_at', { ascending: false })
    setSubs(data ?? [])
    setLoading(false)
  }

  async function loadOptions() {
    const [c, p] = await Promise.all([
      supabase.from('users').select('id, name, phone').eq('role', 'customer').eq('is_active', true).order('name'),
      supabase.from('plans').select('id, name, items_per_month, monthly_price, quarterly_price, biannual_price, annual_price').eq('is_active', true).order('monthly_price'),
    ])
    setCustomers(c.data ?? [])
    setPlans(p.data ?? [])
  }

  function getPlanPrice(planId: string, duration: string): number {
    const plan = plans.find(p => p.id === planId)
    if (!plan) return 0
    const priceMap: Record<string, number> = {
      monthly: plan.monthly_price,
      quarterly: plan.quarterly_price ?? plan.monthly_price * 3,
      biannual: plan.biannual_price ?? plan.monthly_price * 6,
      annual: plan.annual_price ?? plan.monthly_price * 12,
    }
    return priceMap[duration] ?? 0
  }

  function getPlanItemsLimit(planId: string, duration: string): number {
    const plan = plans.find(p => p.id === planId)
    if (!plan) return 0
    const months = duration === 'monthly' ? 1 : duration === 'quarterly' ? 3 : duration === 'biannual' ? 6 : 12
    return plan.items_per_month * months
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.user_id || !form.plan_id) { toast('اختر العميل والباقة', 'error'); return }
    setSaving(true)
    const { data: existing } = await supabase.from('subscriptions').select('id').eq('user_id', form.user_id).eq('plan_id', form.plan_id).eq('status', 'active').maybeSingle()
    if (existing) { setSaving(false); toast('العميل عنده اشتراك نشط في نفس الباقة بالفعل', 'error'); return }
    const totalPaid = getPlanPrice(form.plan_id, form.duration)
    const itemsLimit = getPlanItemsLimit(form.plan_id, form.duration)
    const { error } = await supabase.from('subscriptions').insert({
      user_id: form.user_id,
      plan_id: form.plan_id,
      duration: form.duration,
      status: form.status,
      items_used: 0,
      items_limit: itemsLimit,
      payment_method: form.payment_method,
      total_paid: totalPaid,
      auto_renew: form.auto_renew,
    })
    setSaving(false)
    if (!error) {
      const planName = plans.find(p => p.id === form.plan_id)?.name ?? 'الباقة'
      const durationText = durationLabels[form.duration] ?? form.duration
      const notifTitle = form.status === 'active' ? 'تم تفعيل اشتراكك' : 'تم إنشاء اشتراك جديد'
      const notifBody = form.status === 'active'
        ? `تم تفعيل اشتراكك في باقة ${planName} (${durationText}). يمكنك الآن إنشاء طلباتك.`
        : `تم إنشاء اشتراك في باقة ${planName} (${durationText}). في انتظار التفعيل.`

      await supabase.from('notifications').insert({
        user_id: form.user_id,
        title: notifTitle,
        body: notifBody,
        type: 'system',
        data: { plan_id: form.plan_id },
        sent_at: new Date().toISOString(),
      })

      const { data: userData } = await supabase.from('users').select('fcm_token').eq('id', form.user_id).single()
      if (userData?.fcm_token) {
        fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: userData.fcm_token,
            title: notifTitle,
            body: notifBody,
            sound: 'default',
            data: { type: 'subscription' },
          }),
        }).catch(() => {})
      }

      setShowAdd(false); setForm(emptyForm); loadSubs(); toast('تم إضافة الاشتراك بنجاح')
    } else { toast('حدث خطأ: ' + error.message, 'error') }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const totalPaid = getPlanPrice(form.plan_id, form.duration)
    const itemsLimit = getPlanItemsLimit(form.plan_id, form.duration)
    const { error } = await supabase.from('subscriptions').update({
      plan_id: form.plan_id,
      duration: form.duration,
      status: form.status,
      items_used: form.items_used,
      items_limit: itemsLimit,
      payment_method: form.payment_method,
      total_paid: totalPaid,
      auto_renew: form.auto_renew,
    }).eq('id', editSub.id)
    setSaving(false)
    if (!error) { setEditSub(null); loadSubs(); toast('تم تعديل الاشتراك') }
    else { toast('حدث خطأ: ' + error.message, 'error') }
  }

  function openEdit(sub: any) {
    setForm({
      user_id: sub.user_id,
      plan_id: sub.plan_id,
      duration: sub.duration,
      status: sub.status,
      items_used: sub.items_used ?? 0,
      items_limit: sub.items_limit ?? 0,
      payment_method: sub.payment_method ?? 'cash',
      total_paid: sub.total_paid ?? 0,
      auto_renew: sub.auto_renew ?? false,
    })
    setEditSub(sub)
  }

  async function deleteSub(id: string) {
    const sub = subs.find(s => s.id === id)
    if (sub?.status === 'active') { toast('لا يمكن حذف اشتراك نشط — قم بإلغائه أولاً', 'error'); return }
    const { data: linkedOrders } = await supabase.from('orders').select('id').eq('subscription_id', id).not('status', 'in', '("delivered","cancelled","refunded")').limit(1)
    if (linkedOrders && linkedOrders.length > 0) { toast('لا يمكن الحذف — يوجد طلبات مرتبطة لم تكتمل بعد', 'error'); return }
    if (!confirm('هل أنت متأكد من حذف هذا الاشتراك؟')) return
    const { error } = await supabase.from('subscriptions').delete().eq('id', id)
    if (!error) { loadSubs(); setDetail(null); toast('تم حذف الاشتراك', 'warning') }
    else { toast('حدث خطأ أثناء الحذف', 'error') }
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
        {item.status === 'pending' && hasPermission('subscriptions.edit') && (
          <>
            <button onClick={() => activateSub(item)} className="p-1.5 hover:bg-green-50 rounded-lg transition-colors" title="تفعيل">
              <Check size={15} className="text-green-500" />
            </button>
            <button onClick={() => rejectSub(item.id)} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors" title="رفض">
              <X size={15} className="text-red-500" />
            </button>
          </>
        )}
        {hasPermission('subscriptions.edit') && (
          <button onClick={() => openEdit(item)} className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors" title="تعديل">
            <Edit2 size={15} className="text-blue-500" />
          </button>
        )}
        <button onClick={() => setDetail(item)} className="p-1.5 hover:bg-surface-muted rounded-lg transition-colors" title="عرض">
          <Eye size={15} className="text-gray-400 hover:text-gray-600" />
        </button>
      </div>
    )},
  ]

  const selectClass = 'w-full p-3 border border-surface-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-500/30 transition-all'
  const inputClass = selectClass

  const formFields = (
    <>
      {!editSub && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">العميل <span className="text-red-400">*</span></label>
          <select value={form.user_id} onChange={e => setForm({ ...form, user_id: e.target.value })} required className={selectClass}>
            <option value="">اختر العميل...</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">الباقة <span className="text-red-400">*</span></label>
        <select value={form.plan_id} onChange={e => {
          const newPlanId = e.target.value
          setForm({ ...form, plan_id: newPlanId, total_paid: getPlanPrice(newPlanId, form.duration), items_limit: getPlanItemsLimit(newPlanId, form.duration) })
        }} required className={selectClass}>
          <option value="">اختر الباقة...</option>
          {plans.map(p => <option key={p.id} value={p.id}>{p.name} — {p.monthly_price} ج.م/شهر</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">المدة</label>
          <select value={form.duration} onChange={e => {
            const newDuration = e.target.value
            setForm({ ...form, duration: newDuration, total_paid: getPlanPrice(form.plan_id, newDuration), items_limit: getPlanItemsLimit(form.plan_id, newDuration) })
          }} className={selectClass}>
            <option value="monthly">شهري</option>
            <option value="quarterly">ربع سنوي</option>
            <option value="biannual">نصف سنوي</option>
            <option value="annual">سنوي</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">الحالة</label>
          <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={selectClass}>
            <option value="pending">في الانتظار</option>
            <option value="active">نشط</option>
            <option value="cancelled">ملغي</option>
            <option value="paused">متوقف</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">طريقة الدفع</label>
          <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })} className={selectClass}>
            <option value="cash">كاش</option>
            <option value="visa">فيزا</option>
            <option value="instapay">انستاباي</option>
            <option value="e_wallet">محفظة</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">المبلغ المدفوع</label>
          <input type="number" min={0} value={form.total_paid} onChange={e => setForm({ ...form, total_paid: +e.target.value })} className={inputClass} />
        </div>
      </div>
      {editSub && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">القطع المستخدمة</label>
          <input type="number" min={0} value={form.items_used} onChange={e => setForm({ ...form, items_used: +e.target.value })} className={inputClass} />
        </div>
      )}
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.auto_renew} onChange={e => setForm({ ...form, auto_renew: e.target.checked })}
          className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500/20" />
        <span className="text-sm text-gray-600">تجديد تلقائي</span>
      </label>
    </>
  )

  return (
    <PermissionGate permission="subscriptions.view">
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
        {hasPermission('subscriptions.create') && (
          <button onClick={() => { setForm(emptyForm); setShowAdd(true) }}
            className="flex items-center gap-2 bg-gradient-to-l from-primary-500 to-primary-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:shadow-glow-green transition-all duration-300">
            <Plus size={16} /> اشتراك جديد
          </button>
        )}
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
        <TableSkeleton rows={5} cols={6} />
      ) : (
        <DataTable columns={columns} data={filtered} emptyMessage="لا توجد اشتراكات" />
      )}

      {/* Add Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="اشتراك جديد">
        <form onSubmit={handleAdd} className="space-y-4">
          {formFields}
          <button type="submit" disabled={saving} className="w-full bg-gradient-to-l from-primary-500 to-primary-600 text-white p-3 rounded-xl font-semibold hover:shadow-glow-green disabled:opacity-50 transition-all">
            {saving ? 'جاري الحفظ...' : 'إضافة الاشتراك'}
          </button>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editSub} onClose={() => setEditSub(null)} title="تعديل الاشتراك">
        <form onSubmit={handleEdit} className="space-y-4">
          {editSub && (
            <div className="bg-surface-muted/50 rounded-xl p-3 mb-2">
              <p className="text-xs text-gray-400">العميل</p>
              <p className="text-sm font-semibold text-gray-800">{editSub.user?.name ?? '—'}</p>
            </div>
          )}
          {formFields}
          <button type="submit" disabled={saving} className="w-full bg-gradient-to-l from-primary-500 to-primary-600 text-white p-3 rounded-xl font-semibold hover:shadow-glow-green disabled:opacity-50 transition-all">
            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
        </form>
      </Modal>

      {/* Detail Modal */}
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
              {detail.status === 'pending' && hasPermission('subscriptions.edit') && (
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
              {detail.status === 'active' && hasPermission('subscriptions.edit') && (
                <button onClick={() => cancelSub(detail.id)}
                  className="px-4 py-3 border border-red-200 text-red-500 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors">
                  إلغاء الاشتراك
                </button>
              )}
              {hasPermission('subscriptions.delete') && (
                <button onClick={() => deleteSub(detail.id)}
                  className="px-4 py-3 border border-red-200 text-red-500 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors flex items-center gap-1">
                  <Trash2 size={14} /> حذف
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
