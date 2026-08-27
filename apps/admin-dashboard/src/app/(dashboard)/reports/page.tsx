'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BarChart3, TrendingUp, Users, Truck } from 'lucide-react'
import StatCard from '@/components/ui/StatCard'

export default function ReportsPage() {
  const [stats, setStats] = useState({ totalOrders: 0, totalRevenue: 0, totalCustomers: 0, totalDrivers: 0, ordersByStatus: {} as Record<string, number>, ordersByService: {} as Record<string, number> })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [orders, customers, drivers] = await Promise.all([
        supabase.from('orders').select('status, service_type, total'),
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
    load()
  }, [])

  const statusLabel: Record<string, string> = { pending: 'في الانتظار', assigned: 'تم التعيين', picked_up: 'تم الاستلام', processing: 'جاري المعالجة', ready: 'جاهز', delivering: 'جاري التوصيل', delivered: 'تم التوصيل', cancelled: 'ملغي' }
  const serviceLabel: Record<string, string> = { wash: 'غسيل', iron: 'كوي', wash_iron: 'غسيل وكوي', dry_clean: 'تنظيف جاف' }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><BarChart3 className="w-5 h-5" /> التقارير</h2>
        <p className="text-sm text-gray-400">تقارير الأداء والإحصائيات</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="إجمالي الطلبات" value={stats.totalOrders} icon={BarChart3} color="blue" />
        <StatCard label="إجمالي الإيرادات" value={`${stats.totalRevenue.toFixed(0)} ج.م`} icon={TrendingUp} color="green" />
        <StatCard label="العملاء" value={stats.totalCustomers} icon={Users} color="purple" />
        <StatCard label="السائقين" value={stats.totalDrivers} icon={Truck} color="orange" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
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

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
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
