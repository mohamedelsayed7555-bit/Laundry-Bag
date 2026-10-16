'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useActions } from '@/lib/actions-context'
import StatCard from '@/components/ui/StatCard'
import DataTable from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { motion } from 'framer-motion'
import { CreditCard, Undo2, Truck, Crown, CheckCircle, XCircle } from 'lucide-react'
import { PageSkeleton } from '@/components/ui/Skeleton'
import { ORDER_STATUS_LABELS } from '@cleano/shared-types'

type ActionTab = 'payments' | 'refunds' | 'unassigned' | 'subs'
type ConfirmType = 'payment' | 'refund' | 'subActivate' | 'subReject'

export default function ActionsPage() {
  const { counts, refresh } = useActions()
  const { toast } = useToast()
  const [tab, setTab] = useState<ActionTab>('payments')
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  // Every task-center action asks for confirmation before it runs.
  const [confirmAction, setConfirmAction] = useState<{ type: ConfirmType; id: string; title: string; amount?: number } | null>(null)

  function runConfirm() {
    if (!confirmAction) return
    const { type, id } = confirmAction
    setConfirmAction(null)
    if (type === 'payment') confirmPayment(id)
    else if (type === 'refund') markRefunded(id)
    else if (type === 'subActivate') confirmSub(id)
    else if (type === 'subReject') rejectSub(id)
  }

  useEffect(() => { loadTab() }, [tab])

  useEffect(() => {
    const ch = supabase.channel(`actions-rt-${tab}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { loadTab(); refresh() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, () => { loadTab(); refresh() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [tab])

  async function loadTab() {
    setLoading(true)
    let data: any[] = []
    if (tab === 'payments') {
      const { data: d } = await supabase.from('orders')
        .select('id, order_number, total, payment_method, status, created_at, customer:users!orders_customer_id_fkey(name)')
        .not('payment_status', 'in', '("confirmed","refunded")')
        .not('status', 'in', '("cancelled","refunded")')
        .in('payment_method', ['instapay', 'cash'])
        .order('created_at', { ascending: false }).limit(100)
      data = (d ?? []).map(r => ({ ...r, _type: 'payment' }))
    } else if (tab === 'refunds') {
      const { data: d } = await supabase.from('orders')
        .select('id, order_number, total, delivery_fee, cancellation_fee, payment_method, status, created_at, customer:users!orders_customer_id_fkey(name)')
        .eq('status', 'cancelled')
        .eq('payment_status', 'confirmed')
        .order('created_at', { ascending: false }).limit(100)
      data = (d ?? []).map(r => ({ ...r, _type: 'refund' }))
    } else if (tab === 'unassigned') {
      const { data: d } = await supabase.from('orders')
        .select('id, order_number, total, status, created_at, customer:users!orders_customer_id_fkey(name)')
        .eq('status', 'pending')
        .is('driver_id', null)
        .order('created_at', { ascending: false }).limit(100)
      data = (d ?? []).map(r => ({ ...r, _type: 'unassigned' }))
    } else if (tab === 'subs') {
      const { data: d } = await supabase.from('subscriptions')
        .select('id, status, total_paid, payment_method, created_at, user:users!subscriptions_user_id_fkey(name), plan:plans(name)')
        .eq('payment_method', 'instapay')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }).limit(100)
      data = (d ?? []).map(r => ({ ...r, _type: 'sub' }))
    }
    setRows(data)
    setLoading(false)
  }

  async function confirmPayment(id: string) {
    setRows(prev => prev.filter(r => r.id !== id))
    const { error } = await supabase.from('orders').update({ payment_status: 'confirmed' }).eq('id', id)
    if (error) { toast('حدث خطأ', 'error'); loadTab() } else { toast('تم تأكيد الدفع', 'success'); refresh() }
  }

  async function markRefunded(id: string) {
    const row = rows.find(r => r.id === id)
    const total = Number(row?.total) || 0
    const deliveryFee = Number(row?.delivery_fee) || 0
    const driverArrived = ['arrived', 'picked_up'].includes(row?.status ?? '') || Number(row?.cancellation_fee) > 0
    const refundAmount = driverArrived ? (total - deliveryFee) : total
    setRows(prev => prev.filter(r => r.id !== id))
    const { error } = await supabase.from('orders').update({ payment_status: 'refunded', status: 'refunded', refund_amount: refundAmount }).eq('id', id)
    if (error) { toast('حدث خطأ', 'error'); loadTab() } else { toast(`تم استرداد ${refundAmount.toFixed(2)} ج.م`, 'success'); refresh() }
  }

  async function confirmSub(id: string) {
    setRows(prev => prev.filter(r => r.id !== id))
    const { error } = await supabase.from('subscriptions').update({ status: 'active', start_date: new Date().toISOString() }).eq('id', id)
    if (error) { toast('حدث خطأ', 'error'); loadTab() } else { toast('تم تفعيل الاشتراك', 'success'); refresh() }
  }

  async function rejectSub(id: string) {
    setRows(prev => prev.filter(r => r.id !== id))
    const { error } = await supabase.from('subscriptions').update({ status: 'cancelled' }).eq('id', id)
    if (error) { toast('حدث خطأ', 'error'); loadTab() } else { toast('تم رفض الاشتراك', 'success'); refresh() }
  }

  const tabs: { key: ActionTab; label: string; count: number; icon: typeof CreditCard }[] = [
    { key: 'payments', label: 'تأكيد دفع', count: counts.pendingPayments, icon: CreditCard },
    { key: 'refunds', label: 'استرداد', count: counts.pendingRefunds, icon: Undo2 },
    { key: 'unassigned', label: 'بدون سائق', count: counts.unassignedOrders, icon: Truck },
    { key: 'subs', label: 'اشتراكات معلقة', count: counts.pendingSubPayments, icon: Crown },
  ]

  const columns: any[] = tab === 'payments' ? [
    { key: 'order_number', label: 'رقم الطلب' },
    { key: 'customer', label: 'العميل', render: (r: any) => r.customer?.name ?? '—' },
    { key: 'total', label: 'المبلغ', render: (r: any) => `${Number(r.total).toFixed(2)} ج.م` },
    { key: 'payment_method', label: 'طريقة الدفع', render: (r: any) => <Badge variant="info">{r.payment_method}</Badge> },
    { key: 'status', label: 'الحالة', render: (r: any) => <Badge variant="warning">{ORDER_STATUS_LABELS[r.status as keyof typeof ORDER_STATUS_LABELS] ?? r.status}</Badge> },
    { key: 'created_at', label: 'التاريخ', render: (r: any) => new Date(r.created_at).toLocaleDateString('ar-EG') },
    { key: 'actions', label: 'إجراء', render: (r: any) => (
      <button onClick={() => setConfirmAction({ type: 'payment', id: r.id, title: `طلب ${r.order_number}`, amount: Number(r.total) })} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 text-white rounded-lg text-xs font-medium hover:bg-primary-600 transition-colors">
        <CheckCircle size={14} /> تأكيد
      </button>
    )},
  ] : tab === 'refunds' ? [
    { key: 'order_number', label: 'رقم الطلب' },
    { key: 'customer', label: 'العميل', render: (r: any) => r.customer?.name ?? '—' },
    { key: 'total', label: 'المبلغ الكلي', render: (r: any) => `${Number(r.total).toFixed(2)} ج.م` },
    { key: 'refund', label: 'المسترد', render: (r: any) => {
      const driverArr = ['arrived', 'picked_up'].includes(r.status) || Number(r.cancellation_fee) > 0
      const amt = driverArr ? Number(r.total) - (Number(r.delivery_fee) || 0) : Number(r.total)
      return <span className="font-bold text-red-500">{amt.toFixed(2)} ج.م</span>
    }},
    { key: 'payment_method', label: 'طريقة الدفع', render: (r: any) => <Badge variant="info">{r.payment_method}</Badge> },
    { key: 'created_at', label: 'التاريخ', render: (r: any) => new Date(r.created_at).toLocaleDateString('ar-EG') },
    { key: 'actions', label: 'إجراء', render: (r: any) => (
      <button onClick={() => {
        const driverArr = ['arrived', 'picked_up'].includes(r.status) || Number(r.cancellation_fee) > 0
        const amt = driverArr ? Number(r.total) - (Number(r.delivery_fee) || 0) : Number(r.total)
        setConfirmAction({ type: 'refund', id: r.id, title: `طلب ${r.order_number}`, amount: amt })
      }} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition-colors">
        <Undo2 size={14} /> استرداد
      </button>
    )},
  ] : tab === 'unassigned' ? [
    { key: 'order_number', label: 'رقم الطلب' },
    { key: 'customer', label: 'العميل', render: (r: any) => r.customer?.name ?? '—' },
    { key: 'total', label: 'المبلغ', render: (r: any) => `${Number(r.total).toFixed(2)} ج.م` },
    { key: 'created_at', label: 'التاريخ', render: (r: any) => new Date(r.created_at).toLocaleDateString('ar-EG') },
    { key: 'waiting', label: 'منتظر منذ', render: (r: any) => {
      const mins = Math.round((Date.now() - new Date(r.created_at).getTime()) / 60000)
      return mins < 60 ? `${mins} دقيقة` : `${Math.round(mins / 60)} ساعة`
    }},
  ] : [
    { key: 'plan', label: 'الباقة', render: (r: any) => r.plan?.name ?? '—' },
    { key: 'user', label: 'العميل', render: (r: any) => r.user?.name ?? '—' },
    { key: 'total_paid', label: 'المبلغ', render: (r: any) => `${Number(r.total_paid).toFixed(2)} ج.م` },
    { key: 'created_at', label: 'التاريخ', render: (r: any) => new Date(r.created_at).toLocaleDateString('ar-EG') },
    { key: 'actions', label: 'إجراء', render: (r: any) => (
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setConfirmAction({ type: 'subActivate', id: r.id, title: r.plan?.name ?? 'اشتراك', amount: Number(r.total_paid) })} className="flex items-center gap-1 px-3 py-1.5 bg-primary-500 text-white rounded-lg text-xs font-medium hover:bg-primary-600 transition-colors">
          <CheckCircle size={14} /> تفعيل
        </button>
        <button onClick={() => setConfirmAction({ type: 'subReject', id: r.id, title: r.plan?.name ?? 'اشتراك' })} className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition-colors">
          <XCircle size={14} /> رفض
        </button>
      </div>
    )},
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">مركز المهام</h1>
        <p className="text-sm text-gray-400 mt-1">كل الإجراءات المعلقة في مكان واحد</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="تأكيد دفع" value={counts.pendingPayments} icon={CreditCard} color="orange" index={0} />
        <StatCard label="استرداد" value={counts.pendingRefunds} icon={Undo2} color="red" index={1} />
        <StatCard label="بدون سائق" value={counts.unassignedOrders} icon={Truck} color="blue" index={2} />
        <StatCard label="اشتراكات معلقة" value={counts.pendingSubPayments} icon={Crown} color="purple" index={3} />
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-primary-500 text-white shadow-md'
                : 'bg-white text-gray-600 border border-surface-border hover:bg-gray-50'
            }`}
          >
            <t.icon size={16} />
            {t.label}
            {t.count > 0 && (
              <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                tab === t.key ? 'bg-white/20 text-white' : 'bg-red-500 text-white'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? <PageSkeleton /> : rows.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-surface-border">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-gray-500 font-medium">لا توجد إجراءات معلقة</p>
        </motion.div>
      ) : (
        <DataTable columns={columns} data={rows} />
      )}

      {confirmAction && (() => {
        const meta = {
          payment: { heading: 'تأكيد الدفع', question: 'متأكد إنك عايز تأكد استلام الدفع للطلب ده؟', btn: 'تأكيد الدفع', danger: false },
          refund: { heading: 'تأكيد الاسترداد', question: 'متأكد إنك عايز تسترجع المبلغ ده؟ هيتخصم من الإيرادات.', btn: 'استرداد', danger: true },
          subActivate: { heading: 'تفعيل الاشتراك', question: 'متأكد إنك عايز تفعّل الاشتراك ده؟', btn: 'تفعيل', danger: false },
          subReject: { heading: 'رفض الاشتراك', question: 'متأكد إنك عايز ترفض الاشتراك ده؟', btn: 'رفض', danger: true },
        }[confirmAction.type]
        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setConfirmAction(null)}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-gray-800 mb-2 text-center">{meta.heading}</h3>
              <p className="text-sm text-gray-500 text-center mb-1">{confirmAction.title}</p>
              {typeof confirmAction.amount === 'number' && (
                <p className="text-center text-2xl font-bold text-gray-800 mb-4">{confirmAction.amount.toFixed(2)} ج.م</p>
              )}
              <p className="text-xs text-gray-400 text-center mb-5">{meta.question}</p>
              <div className="flex flex-wrap gap-3">
                <button onClick={() => setConfirmAction(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors">
                  إلغاء
                </button>
                <button onClick={runConfirm}
                  className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-colors ${meta.danger ? 'bg-red-500 hover:bg-red-600' : 'bg-primary-500 hover:bg-primary-600'}`}>
                  {meta.btn}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
