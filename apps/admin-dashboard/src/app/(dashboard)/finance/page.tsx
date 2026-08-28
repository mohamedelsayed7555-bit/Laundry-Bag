'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import StatCard from '@/components/ui/StatCard'
import DataTable from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import { DollarSign, TrendingUp, TrendingDown, CreditCard, Calendar, RotateCcw } from 'lucide-react'
import Tooltip from '@/components/ui/Tooltip'
import PermissionGate from '@/components/ui/PermissionGate'
import { motion } from 'framer-motion'
import { useToast } from '@/components/ui/Toast'

const today = () => new Date().toISOString().split('T')[0]
const monthStart = () => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0] }

type DatePreset = 'all' | 'today' | 'week' | 'month' | 'custom'

export default function FinancePage() {
  const [stats, setStats] = useState({ revenue: 0, paid: 0, unpaid: 0, ordersCount: 0 })
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [payFilter, setPayFilter] = useState('all')
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
    let query = supabase.from('orders')
      .select('*, customer:users!orders_customer_id_fkey(name, customer_code)')
      .order('created_at', { ascending: false })

    const { from, to } = getDateRange()
    if (from) query = query.gte('created_at', from)
    if (to) query = query.lte('created_at', to)

    const { data } = await query
    const all = data ?? []
    const revenue = all.reduce((s, o) => s + (o.total ?? 0), 0)
    const paid = all.filter(o => o.payment_status === 'confirmed').reduce((s, o) => s + (o.total ?? 0), 0)
    setStats({ revenue, paid, unpaid: revenue - paid, ordersCount: all.length })
    setOrders(all)
    setLoading(false)
  }

  function resetFilters() {
    setPreset('all')
    setPayFilter('all')
    setDateFrom('')
    setDateTo('')
  }

  const filtered = payFilter === 'all' ? orders : orders.filter(o => o.payment_status === payFilter)
  const paymentLabel: Record<string, string> = { cash: 'كاش', instapay: 'إنستاباي', wallet: 'محفظة' }

  async function markPaid(id: string) {
    const { error } = await supabase.from('orders').update({ payment_status: 'confirmed' }).eq('id', id)
    if (error) { console.error('markPaid error:', error); toast('حدث خطأ: ' + error.message, 'error'); return }
    setOrders(prev => prev.map(o => o.id === id ? { ...o, payment_status: 'confirmed' } : o))
    toast('تم تأكيد الدفع بنجاح')
    setStats(prev => {
      const order = orders.find(o => o.id === id)
      const amount = order?.total ?? 0
      return { ...prev, paid: prev.paid + amount, unpaid: prev.unpaid - amount }
    })
  }

  const columns = [
    { key: 'order_number', label: 'رقم الطلب', render: (item: any) => <span className="font-bold text-navy-800">{item.order_number}</span> },
    { key: 'customer', label: 'العميل', render: (item: any) => item.customer?.name ?? '—' },
    { key: 'total', label: 'المبلغ', render: (item: any) => <span className="font-semibold">{item.total?.toFixed(2)} ج.م</span> },
    { key: 'payment_method', label: 'طريقة الدفع', render: (item: any) => paymentLabel[item.payment_method] ?? item.payment_method },
    { key: 'payment_status', label: 'حالة الدفع', render: (item: any) => (
      <Badge variant={item.payment_status === 'confirmed' ? 'success' : item.payment_status === 'refunded' ? 'danger' : 'warning'}>
        {item.payment_status === 'confirmed' ? 'مدفوع' : item.payment_status === 'refunded' ? 'مسترد' : 'غير مدفوع'}
      </Badge>
    )},
    { key: 'date', label: 'التاريخ', render: (item: any) => (
      <div>
        <span className="text-xs text-gray-600">{new Date(item.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
        <p className="text-[10px] text-gray-400">{new Date(item.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</p>
      </div>
    )},
    { key: 'actions', label: '', render: (item: any) => (
      item.payment_status !== 'confirmed' ? (
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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <PermissionGate permission="finance.view">
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><DollarSign className="w-5 h-5 text-emerald-500" /> المالية</h2>
          <p className="text-sm text-gray-400 mt-0.5">ملخص الإيرادات والمدفوعات</p>
        </div>
        {(preset !== 'all' || payFilter !== 'all') && (
          <button onClick={resetFilters} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-500 transition-colors">
            <RotateCcw size={14} /> إعادة تعيين
          </button>
        )}
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="إجمالي الإيرادات" value={`${stats.revenue.toLocaleString()} ج.م`} icon={DollarSign} color="green" />
        <StatCard label="المدفوع" value={`${stats.paid.toLocaleString()} ج.م`} icon={TrendingUp} color="blue" />
        <StatCard label="غير مدفوع" value={`${stats.unpaid.toLocaleString()} ج.م`} icon={TrendingDown} color="orange" />
        <StatCard label="عدد الطلبات" value={stats.ordersCount} icon={CreditCard} color="purple" />
      </div>

      {/* Payment status filter */}
      <div className="flex gap-2">
        {[{ key: 'all', label: 'الكل' }, { key: 'pending', label: 'غير مدفوع' }, { key: 'confirmed', label: 'مدفوع' }].map(f => (
          <button key={f.key} onClick={() => setPayFilter(f.key)}
            className={`px-3 py-2 rounded-lg text-[11px] font-medium transition-all ${payFilter === f.key ? 'bg-navy-900 text-white shadow-premium-md' : 'bg-white text-gray-500 hover:bg-surface-muted border border-surface-border/60'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <DataTable columns={columns} data={filtered} emptyMessage="لا توجد معاملات" />
    </div>
    </PermissionGate>
  )
}
