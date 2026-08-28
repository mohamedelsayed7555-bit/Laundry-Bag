'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BarChart3, TrendingUp, Users, Truck, Calendar, RotateCcw } from 'lucide-react'
import { motion } from 'framer-motion'
import StatCard from '@/components/ui/StatCard'

const today = () => new Date().toISOString().split('T')[0]
const monthStart = () => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0] }

type DatePreset = 'all' | 'today' | 'week' | 'month' | 'custom'

export default function ReportsPage() {
  const [stats, setStats] = useState({ totalOrders: 0, totalRevenue: 0, totalCustomers: 0, totalDrivers: 0, ordersByStatus: {} as Record<string, number>, ordersByService: {} as Record<string, number> })
  const [loading, setLoading] = useState(true)
  const [preset, setPreset] = useState<DatePreset>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

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
    let query = supabase.from('orders').select('status, service_type, total, created_at')
    const { from, to } = getDateRange()
    if (from) query = query.gte('created_at', from)
    if (to) query = query.lte('created_at', to)

    const [orders, customers, drivers] = await Promise.all([
      query,
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'driver'),
    ])

    const orderData = orders.data ?? []
    const totalRevenue = orderData.reduce((s, o) => s + (o.total ?? 0), 0)
    const ordersByStatus: Record<string, number> = {}
    const ordersByService: Record<string, number> = {}
    orderData.forEach(o => {
      ordersByStatus[o.status] = (ordersByStatus[o.status] ?? 0) + 1
      ordersByService[o.service_type] = (ordersByService[o.service_type] ?? 0) + 1
    })

    setStats({ totalOrders: orderData.length, totalRevenue, totalCustomers: customers.count ?? 0, totalDrivers: drivers.count ?? 0, ordersByStatus, ordersByService })
    setLoading(false)
  }

  function resetFilters() {
    setPreset('all')
    setDateFrom('')
    setDateTo('')
  }

  const statusLabel: Record<string, string> = { pending: 'في الانتظار', assigned: 'تم التعيين', picked_up: 'تم الاستلام', processing: 'جاري المعالجة', ready: 'جاهز', delivering: 'جاري التوصيل', delivered: 'تم التوصيل', cancelled: 'ملغي' }
  const serviceLabel: Record<string, string> = { wash: 'غسيل', iron: 'كوي', wash_iron: 'غسيل وكوي', dry_clean: 'تنظيف جاف' }
  const presets: { key: DatePreset; label: string }[] = [
    { key: 'all', label: 'الكل' }, { key: 'today', label: 'اليوم' },
    { key: 'week', label: 'آخر أسبوع' }, { key: 'month', label: 'هذا الشهر' },
    { key: 'custom', label: 'مخصص' },
  ]

  const inputClass = 'px-3 py-2 bg-white border border-surface-border/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/15 transition-all'

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-blue-500" /> التقارير</h2>
          <p className="text-sm text-gray-400 mt-0.5">تقارير الأداء والإحصائيات</p>
        </div>
        {preset !== 'all' && (
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="إجمالي الطلبات" value={stats.totalOrders} icon={BarChart3} color="blue" />
        <StatCard label="إجمالي الإيرادات" value={`${stats.totalRevenue.toFixed(0)} ج.م`} icon={TrendingUp} color="green" />
        <StatCard label="العملاء" value={stats.totalCustomers} icon={Users} color="purple" />
        <StatCard label="السائقين" value={stats.totalDrivers} icon={Truck} color="orange" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-premium border border-surface-border/60 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">الطلبات حسب الحالة</h3>
          <div className="space-y-3">
            {Object.entries(stats.ordersByStatus).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{statusLabel[status] ?? status}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-primary-500 rounded-full" style={{ width: `${stats.totalOrders ? (count / stats.totalOrders) * 100 : 0}%` }} />
                  </div>
                  <span className="text-sm font-bold text-gray-800 w-8 text-left">{count}</span>
                </div>
              </div>
            ))}
            {Object.keys(stats.ordersByStatus).length === 0 && <p className="text-sm text-gray-400 text-center py-4">لا توجد بيانات</p>}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-premium border border-surface-border/60 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">الطلبات حسب الخدمة</h3>
          <div className="space-y-3">
            {Object.entries(stats.ordersByService).map(([service, count]) => (
              <div key={service} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{serviceLabel[service] ?? service}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-accent-purple rounded-full" style={{ width: `${stats.totalOrders ? (count / stats.totalOrders) * 100 : 0}%` }} />
                  </div>
                  <span className="text-sm font-bold text-gray-800 w-8 text-left">{count}</span>
                </div>
              </div>
            ))}
            {Object.keys(stats.ordersByService).length === 0 && <p className="text-sm text-gray-400 text-center py-4">لا توجد بيانات</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
