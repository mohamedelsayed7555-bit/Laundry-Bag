'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import StatCard from '@/components/ui/StatCard'
import DataTable from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import { DollarSign, TrendingUp, TrendingDown, CreditCard, Calendar, RotateCcw, Crown, Truck, Download } from 'lucide-react'
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

  useEffect(() => { load() }, [preset, dateFrom, dateTo])

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

    // Load orders
    let oQuery = supabase.from('orders')
      .select('id, order_number, status, total, delivery_fee, payment_status, payment_method, subscription_id, created_at, customer:users!orders_customer_id_fkey(name, customer_code)')
      .order('created_at', { ascending: false })
      .limit(500)
    if (from) oQuery = oQuery.gte('created_at', from)
    if (to) oQuery = oQuery.lte('created_at', to)
    const { data: ordersData } = await oQuery

    // Load subscriptions
    let sQuery = supabase.from('subscriptions')
      .select('id, status, total_paid, created_at, user:users!subscriptions_user_id_fkey(name, customer_code), plan:plans(name)')
      .order('created_at', { ascending: false })
      .limit(500)
    if (from) sQuery = sQuery.gte('created_at', from)
    if (to) sQuery = sQuery.lte('created_at', to)
    const { data: subsData } = await sQuery

    const allOrders = ordersData ?? []
    const activeOrders = allOrders.filter((o: any) => !['cancelled', 'refunded'].includes(o.status))
    const allSubs = (subsData ?? []).filter((s: any) => !['pending', 'cancelled'].includes(s.status))

    const orderRevenue = activeOrders.reduce((s, o) => s + (o.total ?? 0), 0)
    const paid = activeOrders.filter(o => o.payment_status === 'confirmed').reduce((s, o) => s + (o.total ?? 0), 0)
    const subsRevenue = allSubs.reduce((s: number, sub: any) => s + (Number(sub.total_paid) || 0), 0)
    const deliveryFees = activeOrders.reduce((s, o) => s + (o.delivery_fee ?? 0), 0)

    setStats({
      revenue: orderRevenue + subsRevenue,
      paid,
      unpaid: orderRevenue - paid,
      ordersCount: activeOrders.length,
      subsRevenue,
      subsCount: allSubs.length,
      deliveryFees,
    })

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
      payment_status: s.status === 'active' ? 'confirmed' : 'pending',
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
    const amount = row?._amount ?? 0
    setRows(prev => prev.map(r => r.id === id ? { ...r, payment_status: 'confirmed' } : r))
    setStats(prev => ({ ...prev, paid: prev.paid + amount, unpaid: prev.unpaid - amount }))
    toast('تم تأكيد الدفع بنجاح')
    const { error } = await supabase.from('orders').update({ payment_status: 'confirmed' }).eq('id', id)
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
    { key: 'actions', label: '', render: (item: any) => (
      item._source === 'order' && item.payment_status !== 'confirmed' ? (
        <Tooltip content="تأكيد استلام المبلغ">
          <button onClick={() => markPaid(item.id)} className="text-[11px] bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg font-medium hover:bg-emerald-100 transition-colors">
            تأكيد الدفع
          </button>
        </Tooltip>
      ) : null
    )},
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
          {[{ key: 'all', label: 'الكل' }, { key: 'pending', label: 'غير مدفوع' }, { key: 'confirmed', label: 'مدفوع' }].map(f => (
            <button key={f.key} onClick={() => setPayFilter(f.key)}
              className={`px-3 py-2 rounded-lg text-[11px] font-medium transition-all ${payFilter === f.key ? 'bg-navy-900 text-white shadow-premium-md' : 'bg-white text-gray-500 hover:bg-surface-muted border border-surface-border/60'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <DataTable columns={columns} data={filtered} emptyMessage="لا توجد معاملات" />
    </div>
    </PermissionGate>
  )
}
