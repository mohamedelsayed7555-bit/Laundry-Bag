'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import StatCard from '@/components/ui/StatCard'
import DataTable from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import { DollarSign, TrendingUp, TrendingDown, CreditCard, Calendar, RotateCcw, Crown, Truck, Download, Undo2 } from 'lucide-react'
import { PageSkeleton } from '@/components/ui/Skeleton'
import Tooltip from '@/components/ui/Tooltip'
import PermissionGate from '@/components/ui/PermissionGate'
import { motion } from 'framer-motion'
import { useToast } from '@/components/ui/Toast'

const today = () => new Date().toISOString().split('T')[0]
const monthStart = () => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0] }

type DatePreset = 'all' | 'today' | 'week' | 'month' | 'custom'
type SourceFilter = 'all' | 'orders' | 'subscriptions'

export default function FinancePage() {
  const [stats, setStats] = useState({ revenue: 0, paid: 0, unpaid: 0, ordersCount: 0, subsRevenue: 0, subsCount: 0, deliveryFees: 0 })
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [payFilter, setPayFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [preset, setPreset] = useState<DatePreset>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const { toast } = useToast()
  const [confirmModal, setConfirmModal] = useState<{ type: 'pay' | 'refund'; id: string; amount: number; orderNumber: string } | null>(null)

  useEffect(() => { load() }, [preset, dateFrom, dateTo])

  useEffect(() => {
    const ch = supabase.channel('finance-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  function getDateRange(): { from: string | null; to: string | null } {
    const now = new Date()
    switch (preset) {
      case 'today':
        return { from: today() + 'T00:00:00', to: today() + 'T23:59:59' }
      case 'week': {
        const w = new Date(now)
        w.setDate(now.getDate() - 7)
        return { from: w.toISOString(), to: now.toISOString() }
      }
      case 'month':
        return { from: monthStart() + 'T00:00:00', to: now.toISOString() }
      case 'custom':
        return { from: dateFrom ? dateFrom + 'T00:00:00' : null, to: dateTo ? dateTo + 'T23:59:59' : null }
      default:
        return { from: null, to: null }
    }
  }

  async function load() {
    const { from, to } = getDateRange()

    // Stats from server-side aggregation (accurate, no row limit)
    const { data: serverStats } = await supabase.rpc('get_finance_stats', {
      date_from: from ?? undefined,
      date_to: to ?? undefined,
    })
    if (serverStats) {
      const s = serverStats as any
      setStats({
        revenue: (Number(s.order_revenue) || 0) + (Number(s.subs_revenue) || 0),
        paid: Number(s.order_paid) || 0,
        unpaid: Number(s.order_unpaid) || 0,
        ordersCount: Number(s.orders_count) || 0,
        subsRevenue: Number(s.subs_revenue) || 0,
        subsCount: Number(s.subs_count) || 0,
        deliveryFees: Number(s.delivery_fees) || 0,
      })
    }

    // Load rows for the table (paginated display)
    let oQuery = supabase.from('orders')
      .select('id, order_number, status, total, delivery_fee, payment_status, payment_method, subscription_id, created_at, customer:users!orders_customer_id_fkey(name, customer_code)')
      .order('created_at', { ascending: false })
      .limit(200)
    if (from) oQuery = oQuery.gte('created_at', from)
    if (to) oQuery = oQuery.lte('created_at', to)
    const { data: ordersData } = await oQuery

    let sQuery = supabase.from('subscriptions')
      .select('id, status, total_paid, created_at, user:users!subscriptions_user_id_fkey(name, customer_code), plan:plans(name)')
      .in('status', ['active', 'expired', 'upgraded', 'cancelled'])
      .not('start_date', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200)
    if (from) sQuery = sQuery.gte('created_at', from)
    if (to) sQuery = sQuery.lte('created_at', to)
    const { data: subsData } = await sQuery

    const allOrders = ordersData ?? []
    const allSubs = subsData ?? []

    // Merge into unified rows
    const orderRows = allOrders.map((o: any) => ({
      ...o,
      _source: 'order' as const,
      _amount: o.total ?? 0,
      _customerName: o.customer?.name ?? '—',
      _customerCode: o.customer?.customer_code,
      _date: o.created_at,
    }))

    const subRows = allSubs.map((s: any) => ({
      ...s,
      _source: 'subscription' as const,
      _amount: Number(s.total_paid) || 0,
      _customerName: s.user?.name ?? '—',
      _customerCode: s.user?.customer_code,
      _date: s.created_at,
      payment_status: 'confirmed',
      payment_method: 'subscription',
    }))

    const merged = [...orderRows, ...subRows].sort((a, b) =>
      new Date(b._date).getTime() - new Date(a._date).getTime()
    )

    setRows(merged)
    setLoading(false)
  }

  function resetFilters() {
    setPreset('all')
    setPayFilter('all')
    setSourceFilter('all')
    setDateFrom('')
    setDateTo('')
  }

  const filtered = useMemo(() => {
    let result = rows
    if (sourceFilter !== 'all') result = result.filter(r => r._source === (sourceFilter === 'orders' ? 'order' : 'subscription'))
    if (payFilter !== 'all') result = result.filter(r => r.payment_status === payFilter)
    return result
  }, [rows, sourceFilter, payFilter])

  const paymentLabel: Record<string, string> = { cash: 'كاش', instapay: 'إنستاباي', wallet: 'محفظة', subscription: 'اشتراك' }

  function exportExcel() {
    import('xlsx').then(XLSX => {
      const exportData = filtered.map(r => ({
        'النوع': r._source === 'order' ? 'طلب' : 'اشتراك',
        'المرجع': r._source === 'order' ? r.order_number : r.plan?.name ?? '—',
        'العميل': r._customerName,
        'المبلغ': r._amount?.toFixed(2),
        'طريقة الدفع': paymentLabel[r.payment_method] ?? r.payment_method,
        'حالة الدفع': r.payment_status === 'confirmed' ? 'مدفوع' : r.payment_status === 'refunded' ? 'مسترد' : 'غير مدفوع',
        'التاريخ': new Date(r._date).toLocaleDateString('ar-EG'),
      }))
      const ws = XLSX.utils.json_to_sheet(exportData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'المالية')
      XLSX.writeFile(wb, `تقرير-مالي-${new Date().toISOString().split('T')[0]}.xlsx`)
      toast('تم تصدير التقرير بنجاح')
    })
  }

  async function markPaid(id: string) {
    const row = rows.find(r => r.id === id)
    const total = row?._amount ?? 0
    const deliveryFee = Number(row?.delivery_fee) || 0
    const paidAmount = total - deliveryFee
    setConfirmModal(null)
    setRows(prev => prev.map(r => r.id === id ? { ...r, payment_status: 'confirmed' } : r))
    setStats(prev => ({ ...prev, paid: prev.paid + paidAmount, unpaid: Math.max(0, prev.unpaid - total), deliveryFees: prev.deliveryFees + deliveryFee }))
    toast('تم تأكيد الدفع بنجاح')
    const { error } = await supabase.from('orders').update({ payment_status: 'confirmed' }).eq('id', id)
    if (error) { toast('حدث خطأ — جاري التحديث', 'error'); load() }
  }

  async function markRefunded(id: string) {
    const row = rows.find(r => r.id === id)
    const deliveryFee = Number(row?.delivery_fee) || 0
    const refundAmount = (row?._amount ?? 0) - deliveryFee
    setConfirmModal(null)
    setRows(prev => prev.map(r => r.id === id ? { ...r, payment_status: 'refunded', status: 'refunded' } : r))
    setStats(prev => ({ ...prev, revenue: prev.revenue - refundAmount, paid: prev.paid - refundAmount }))
    toast(`تم استرداد ${refundAmount.toFixed(2)} ج.م (بدون رسوم التوصيل)`)
    const { error } = await supabase.from('orders').update({ payment_status: 'refunded', status: 'refunded' }).eq('id', id)
    if (error) { toast('حدث خطأ — جاري التحديث', 'error'); load() }
  }

  const columns = [
    { key: 'source', label: 'النوع', render: (item: any) => (
      item._source === 'subscription'
        ? <Badge variant="warning"><span className="flex items-center gap-1">👑 اشتراك</span></Badge>
        : <Badge variant="info">🧺 طلب</Badge>
    )},
    { key: 'ref', label: 'المرجع', render: (item: any) => (
      <span className="font-bold text-navy-800">
        {item._source === 'order' ? item.order_number : item.plan?.name ?? '—'}
      </span>
    )},
    { key: 'customer', label: 'العميل', render: (item: any) => item._customerName },
    { key: 'total', label: 'المبلغ', render: (item: any) => <span className="font-semibold">{item._amount?.toFixed(2)} ج.م</span> },
    { key: 'payment_method', label: 'طريقة الدفع', render: (item: any) => paymentLabel[item.payment_method] ?? item.payment_method },
    { key: 'payment_status', label: 'حالة الدفع', render: (item: any) => (
      <Badge variant={item.payment_status === 'confirmed' ? 'success' : item.payment_status === 'refunded' ? 'danger' : 'warning'}>
        {item.payment_status === 'confirmed' ? 'مدفوع' : item.payment_status === 'refunded' ? 'مسترد' : 'غير مدفوع'}
      </Badge>
    )},
    { key: 'date', label: 'التاريخ', render: (item: any) => (
      <div>
        <span className="text-xs text-gray-600">{new Date(item._date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
        <p className="text-[10px] text-gray-400">{new Date(item._date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</p>
      </div>
    )},
    { key: 'status', label: 'حالة الطلب', render: (item: any) => {
      if (item._source === 'subscription') return null
      const statusMap: Record<string, { label: string; variant: string }> = {
        pending: { label: 'معلق', variant: 'warning' },
        assigned: { label: 'تم التعيين', variant: 'info' },
        picked_up: { label: 'تم الاستلام', variant: 'info' },
        processing: { label: 'جاري المعالجة', variant: 'info' },
        ready: { label: 'جاهز', variant: 'success' },
        delivering: { label: 'جاري التوصيل', variant: 'info' },
        delivered: { label: 'تم التسليم', variant: 'success' },
        cancelled: { label: 'ملغي', variant: 'danger' },
        refunded: { label: 'مسترد', variant: 'danger' },
      }
      const s = statusMap[item.status] ?? { label: item.status, variant: 'warning' }
      return <Badge variant={s.variant as any}>{s.label}</Badge>
    }},
    { key: 'actions', label: '', render: (item: any) => {
      if (item._source !== 'order') return null
      const isCancelled = ['cancelled', 'refunded'].includes(item.status)
      const canConfirm = item.payment_status === 'pending' && !isCancelled
      const canRefund = item.payment_status === 'confirmed' && ['visa', 'e_wallet', 'wallet', 'instapay'].includes(item.payment_method) && ['pending', 'assigned', 'arrived', 'picked_up', 'cancelled'].includes(item.status)
      return (
        <div className="flex gap-1.5">
          {canConfirm && (
            <Tooltip content="تأكيد استلام المبلغ">
              <button onClick={() => setConfirmModal({ type: 'pay', id: item.id, amount: item._amount, orderNumber: item.order_number })} className="text-[11px] bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg font-medium hover:bg-emerald-100 transition-colors">
                تأكيد الدفع
              </button>
            </Tooltip>
          )}
          {canRefund && (
            <Tooltip content="استرداد المبلغ">
              <button onClick={() => setConfirmModal({ type: 'refund', id: item.id, amount: item._amount - (Number(item.delivery_fee) || 0), orderNumber: item.order_number })} className="text-[11px] bg-red-50 text-red-600 px-3 py-1.5 rounded-lg font-medium hover:bg-red-100 transition-colors">
                استرداد
              </button>
            </Tooltip>
          )}
        </div>
      )
    }},
  ]

  const presets: { key: DatePreset; label: string }[] = [
    { key: 'all', label: 'الكل' }, { key: 'today', label: 'اليوم' },
    { key: 'week', label: 'آخر أسبوع' }, { key: 'month', label: 'هذا الشهر' },
    { key: 'custom', label: 'مخصص' },
  ]

  const inputClass = 'px-3 py-2 bg-white border border-surface-border/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/15 transition-all'

  if (loading) return <PageSkeleton stats={4} tableRows={5} tableCols={5} />

  return (
    <PermissionGate permission="finance.view">
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><DollarSign className="w-5 h-5 text-emerald-500" /> المالية</h2>
          <p className="text-sm text-gray-400 mt-0.5">ملخص الإيرادات والمدفوعات</p>
        </div>
        <div className="flex items-center gap-3">
          {(preset !== 'all' || payFilter !== 'all' || sourceFilter !== 'all') && (
            <button onClick={resetFilters} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-500 transition-colors">
              <RotateCcw size={14} /> إعادة تعيين
            </button>
          )}
          <button onClick={exportExcel} className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-3 py-2 rounded-xl text-xs font-medium hover:bg-emerald-100 transition-colors">
            <Download size={14} /> تصدير Excel
          </button>
        </div>
      </motion.div>

      {/* Date filters */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }} className="flex flex-wrap items-center gap-3">
        <Calendar size={16} className="text-gray-400" />
        <div className="flex gap-1.5">
          {presets.map(p => (
            <button key={p.key} onClick={() => setPreset(p.key)}
              className={`px-3 py-2 rounded-lg text-[11px] font-medium transition-all ${preset === p.key ? 'bg-navy-900 text-white shadow-premium-md' : 'bg-white text-gray-500 hover:bg-surface-muted border border-surface-border/60'}`}>
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputClass} />
            <span className="text-gray-400 text-xs">إلى</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputClass} />
          </div>
        )}
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="إجمالي الإيرادات" value={`${stats.revenue.toLocaleString()} ج.م`} icon={DollarSign} color="green" />
        <StatCard label="المدفوع (طلبات)" value={`${stats.paid.toLocaleString()} ج.م`} icon={TrendingUp} color="blue" />
        <StatCard label="غير مدفوع" value={`${stats.unpaid.toLocaleString()} ج.م`} icon={TrendingDown} color="orange" />
        <StatCard label="رسوم التوصيل" value={`${stats.deliveryFees.toLocaleString()} ج.م`} icon={Truck} color="purple" />
        <StatCard label="إيرادات الاشتراكات" value={`${stats.subsRevenue.toLocaleString()} ج.م`} icon={Crown} color="yellow" />
        <StatCard label="عدد الطلبات" value={stats.ordersCount} icon={CreditCard} color="purple" />
      </div>

      {/* Source + Payment filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex gap-1.5">
          {([['all', 'الكل'], ['orders', '🧺 الطلبات'], ['subscriptions', '👑 الاشتراكات']] as [SourceFilter, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setSourceFilter(key)}
              className={`px-3 py-2 rounded-lg text-[11px] font-medium transition-all ${sourceFilter === key ? 'bg-navy-900 text-white shadow-premium-md' : 'bg-white text-gray-500 hover:bg-surface-muted border border-surface-border/60'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {[{ key: 'all', label: 'الكل' }, { key: 'pending', label: 'غير مدفوع' }, { key: 'confirmed', label: 'مدفوع' }, { key: 'refunded', label: 'مسترد' }].map(f => (
            <button key={f.key} onClick={() => setPayFilter(f.key)}
              className={`px-3 py-2 rounded-lg text-[11px] font-medium transition-all ${payFilter === f.key ? 'bg-navy-900 text-white shadow-premium-md' : 'bg-white text-gray-500 hover:bg-surface-muted border border-surface-border/60'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <DataTable columns={columns} data={filtered} emptyMessage="لا توجد معاملات" />

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setConfirmModal(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 mb-2 text-center">
              {confirmModal.type === 'pay' ? 'تأكيد الدفع' : 'تأكيد الاسترداد'}
            </h3>
            <p className="text-sm text-gray-500 text-center mb-1">
              طلب رقم <span className="font-bold text-gray-800">{confirmModal.orderNumber}</span>
            </p>
            <p className="text-center text-2xl font-bold text-gray-800 mb-4">
              {confirmModal.amount.toFixed(2)} ج.م
            </p>
            <p className="text-xs text-gray-400 text-center mb-5">
              {confirmModal.type === 'pay'
                ? 'هل أنت متأكد من تأكيد استلام هذا المبلغ؟'
                : 'هل أنت متأكد من استرداد هذا المبلغ؟ سيتم خصمه من الإيرادات.'}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors">
                إلغاء
              </button>
              <button
                onClick={() => confirmModal.type === 'pay' ? markPaid(confirmModal.id) : markRefunded(confirmModal.id)}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-colors ${
                  confirmModal.type === 'pay' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'
                }`}>
                {confirmModal.type === 'pay' ? 'تأكيد الدفع' : 'تأكيد الاسترداد'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </PermissionGate>
  )
}
