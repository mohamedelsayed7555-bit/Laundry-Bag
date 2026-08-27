'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import StatCard from '@/components/ui/StatCard'
import DataTable from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import { DollarSign, TrendingUp, TrendingDown, CreditCard } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

export default function FinancePage() {
  const [stats, setStats] = useState({ revenue: 0, paid: 0, unpaid: 0, ordersCount: 0 })
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const { toast } = useToast()

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('orders')
        .select('*, customer:users!orders_customer_id_fkey(name, customer_code)')
        .order('created_at', { ascending: false })
      const all = data ?? []
      const revenue = all.reduce((s, o) => s + (o.total ?? 0), 0)
      const paid = all.filter(o => o.payment_status === 'paid').reduce((s, o) => s + (o.total ?? 0), 0)
      setStats({ revenue, paid, unpaid: revenue - paid, ordersCount: all.length })
      setOrders(all)
      setLoading(false)
    }
    load()
  }, [])

  const filtered = filter === 'all' ? orders : orders.filter(o => o.payment_status === filter)
  const paymentLabel: Record<string, string> = { cash: 'كاش', instapay: 'إنستاباي', wallet: 'محفظة' }

  async function markPaid(id: string) {
    await supabase.from('orders').update({ payment_status: 'paid' }).eq('id', id)
    setOrders(prev => prev.map(o => o.id === id ? { ...o, payment_status: 'paid' } : o))
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
      <Badge variant={item.payment_status === 'paid' ? 'success' : item.payment_status === 'refunded' ? 'danger' : 'warning'}>
        {item.payment_status === 'paid' ? 'مدفوع' : item.payment_status === 'refunded' ? 'مسترد' : 'غير مدفوع'}
      </Badge>
    )},
    { key: 'date', label: 'التاريخ', render: (item: any) => <span className="text-xs text-gray-400">{new Date(item.created_at).toLocaleDateString('ar-EG')}</span> },
    { key: 'actions', label: '', render: (item: any) => (
      item.payment_status !== 'paid' ? (
        <button onClick={() => markPaid(item.id)} className="text-xs bg-green-50 text-green-600 px-3 py-1.5 rounded-lg font-medium hover:bg-green-100 transition">
          تأكيد الدفع
        </button>
      ) : null
    )},
  ]

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><DollarSign className="w-5 h-5" /> المالية</h2>
        <p className="text-sm text-gray-400">ملخص الإيرادات والمدفوعات</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="إجمالي الإيرادات" value={`${stats.revenue.toLocaleString()} ج.م`} icon={DollarSign} color="green" />
        <StatCard label="المدفوع" value={`${stats.paid.toLocaleString()} ج.م`} icon={TrendingUp} color="blue" />
        <StatCard label="غير مدفوع" value={`${stats.unpaid.toLocaleString()} ج.م`} icon={TrendingDown} color="orange" />
        <StatCard label="عدد الطلبات" value={stats.ordersCount} icon={CreditCard} color="purple" />
      </div>

      <div className="flex gap-2">
        {[{ key: 'all', label: 'الكل' }, { key: 'pending', label: 'غير مدفوع' }, { key: 'paid', label: 'مدفوع' }].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filter === f.key ? 'bg-navy-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <DataTable columns={columns} data={filtered} emptyMessage="لا توجد معاملات" />
    </div>
  )
}
