'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import StatCard from '@/components/ui/StatCard'
import DataTable from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import {
  DollarSign,
  ClipboardList,
  Users,
  Truck,
  TrendingUp,
  ShoppingBag,
  ArrowUpLeft,
  Sparkles,
  Activity,
  Crown,
} from 'lucide-react'
import { ORDER_STATUS_LABELS } from '@cleano/shared-types'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { format, subDays, startOfDay } from 'date-fns'
import { ar } from 'date-fns/locale'

const statusBadge = (status: string) => {
  const map: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple'> = {
    pending: 'warning', assigned: 'info', picked_up: 'purple', processing: 'info',
    ready: 'success', delivering: 'purple', delivered: 'success', cancelled: 'danger', refunded: 'neutral',
  }
  return (
    <Badge variant={map[status] ?? 'neutral'}>
      {ORDER_STATUS_LABELS[status as keyof typeof ORDER_STATUS_LABELS] ?? status}
    </Badge>
  )
}

const PIE_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6']

const SERVICE_LABELS: Record<string, string> = {
  wash: 'غسيل', iron: 'كي', wash_iron: 'غسيل وكي', dry_clean: 'تنظيف جاف',
}

const STATUS_LABELS_AR: Record<string, string> = {
  pending: 'في الانتظار', assigned: 'معيّن', picked_up: 'تم الاستلام',
  processing: 'معالجة', ready: 'جاهز', delivering: 'توصيل',
  delivered: 'تم التوصيل', cancelled: 'ملغي',
}

function SkeletonLoader() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 border border-surface-border/60">
            <div className="skeleton w-10 h-10 rounded-xl mb-4" />
            <div className="skeleton w-20 h-7 mb-2" />
            <div className="skeleton w-16 h-3" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-6 border border-surface-border/60"><div className="skeleton w-full h-56" /></div>
        <div className="bg-white rounded-2xl p-6 border border-surface-border/60"><div className="skeleton w-full h-56" /></div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalRevenue: 0, totalOrders: 0, totalCustomers: 0, totalDrivers: 0,
    activeOrders: 0, deliveredToday: 0, subsRevenue: 0,
  })
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [dailyData, setDailyData] = useState<any[]>([])
  const [serviceData, setServiceData] = useState<any[]>([])
  const [statusData, setStatusData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
    const channel = supabase.channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => loadDashboard())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => loadDashboard())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function loadDashboard() {
    const [orders, customers, drivers, recent, subs] = await Promise.all([
      supabase.from('orders').select('id, total, status, service_type, created_at', { count: 'exact' }),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'driver'),
      supabase.from('orders').select('*, customer:users!orders_customer_id_fkey(name, customer_code)').order('created_at', { ascending: false }).limit(7),
      supabase.from('subscriptions').select('*, plan:plans(price)').neq('status', 'pending'),
    ])

    const allOrders = orders.data ?? []
    const allSubs = subs.data ?? []
    const revenue = allOrders.reduce((sum, o) => sum + (o.total ?? 0), 0)
    const subsRevenue = allSubs.reduce((sum: number, s: any) => sum + (s.plan?.price ?? 0), 0)
    const active = allOrders.filter(o => !['delivered', 'cancelled', 'refunded'].includes(o.status)).length
    const todayStr = new Date().toISOString().split('T')[0]
    const deliveredToday = allOrders.filter(o => o.status === 'delivered' && o.created_at?.startsWith(todayStr)).length

    setStats({
      totalRevenue: revenue + subsRevenue,
      totalOrders: orders.count ?? 0,
      totalCustomers: customers.count ?? 0,
      totalDrivers: drivers.count ?? 0,
      activeOrders: active,
      deliveredToday,
      subsRevenue,
    })

    // Daily revenue chart (last 14 days)
    const days: Record<string, { date: string; revenue: number; orders: number }> = {}
    for (let i = 13; i >= 0; i--) {
      const d = format(subDays(new Date(), i), 'yyyy-MM-dd')
      const label = format(subDays(new Date(), i), 'd MMM', { locale: ar })
      days[d] = { date: label, revenue: 0, orders: 0 }
    }
    allOrders.forEach(o => {
      const d = o.created_at?.split('T')[0]
      if (d && days[d]) {
        days[d].revenue += o.total ?? 0
        days[d].orders += 1
      }
    })
    setDailyData(Object.values(days))

    // Service distribution
    const svcCount: Record<string, number> = {}
    allOrders.forEach(o => {
      const svc = o.service_type ?? 'other'
      svcCount[svc] = (svcCount[svc] ?? 0) + 1
    })
    setServiceData(Object.entries(svcCount).map(([key, value]) => ({
      name: SERVICE_LABELS[key] ?? key, value,
    })))

    // Status distribution
    const stCount: Record<string, number> = {}
    allOrders.forEach(o => {
      stCount[o.status] = (stCount[o.status] ?? 0) + 1
    })
    setStatusData(Object.entries(stCount).map(([key, value]) => ({
      name: STATUS_LABELS_AR[key] ?? key, value,
    })))

    setRecentOrders(recent.data ?? [])
    setLoading(false)
  }

  const orderColumns = [
    { key: 'order_number', label: 'رقم الطلب', render: (item: any) => <span className="font-semibold text-navy-800">{item.order_number}</span> },
    { key: 'customer', label: 'العميل', render: (item: any) => (
      <div>
        <p className="font-medium text-gray-800">{item.customer?.name ?? '—'}</p>
        <p className="text-[10px] text-gray-400">{item.customer?.customer_code}</p>
      </div>
    )},
    { key: 'items_count', label: 'القطع', render: (item: any) => <span className="text-gray-600">{item.items_count} قطعة</span> },
    { key: 'total', label: 'المبلغ', render: (item: any) => <span className="font-semibold text-gray-800">{item.total?.toFixed(2)} ج.م</span> },
    { key: 'status', label: 'الحالة', render: (item: any) => statusBadge(item.status) },
    { key: 'created_at', label: 'التاريخ', render: (item: any) => <span className="text-gray-400 text-xs">{new Date(item.created_at).toLocaleDateString('ar-EG')}</span> },
  ]

  if (loading) return <SkeletonLoader />

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            نظرة عامة
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary-50 text-primary-600 text-[10px] font-semibold">
              <Activity size={10} /> مباشر
            </span>
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">ملخص أداء المنصة</p>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="إجمالي الإيرادات" value={`${stats.totalRevenue.toLocaleString()} ج.م`} icon={DollarSign} color="green" index={0} />
        <StatCard label="إجمالي الطلبات" value={stats.totalOrders} icon={ClipboardList} color="blue" index={1} />
        <StatCard label="العملاء" value={stats.totalCustomers} icon={Users} color="purple" index={2} />
        <StatCard label="السائقين" value={stats.totalDrivers} icon={Truck} color="orange" index={3} />
        <StatCard label="طلبات نشطة" value={stats.activeOrders} icon={ShoppingBag} color="cyan" index={4} />
        <StatCard label="إيرادات الاشتراكات" value={`${stats.subsRevenue.toLocaleString()} ج.م`} icon={Crown} color="yellow" index={5} />
      </div>

      {/* Charts Row 1: Revenue + Orders Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl p-6 border border-surface-border/60 shadow-premium-sm">
          <h3 className="text-sm font-bold text-gray-700 mb-4">📈 الإيرادات — آخر 14 يوم</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={dailyData}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <ReTooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                formatter={(value: number) => [`${value.toLocaleString()} ج.م`, 'الإيرادات']} />
              <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} fill="url(#revGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl p-6 border border-surface-border/60 shadow-premium-sm">
          <h3 className="text-sm font-bold text-gray-700 mb-4">📦 عدد الطلبات — آخر 14 يوم</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} />
              <ReTooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                formatter={(value: number) => [`${value} طلب`, 'الطلبات']} />
              <Bar dataKey="orders" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Charts Row 2: Service Distribution + Status Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="bg-white rounded-2xl p-6 border border-surface-border/60 shadow-premium-sm">
          <h3 className="text-sm font-bold text-gray-700 mb-4">👔 توزيع الخدمات</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={serviceData} cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={{ stroke: '#d1d5db', strokeWidth: 1 }}>
                {serviceData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <ReTooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                formatter={(value: number) => [`${value} طلب`, 'العدد']} />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl p-6 border border-surface-border/60 shadow-premium-sm">
          <h3 className="text-sm font-bold text-gray-700 mb-4">📊 حالة الطلبات</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={statusData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} width={80} />
              <ReTooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                formatter={(value: number) => [`${value} طلب`, 'العدد']} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {statusData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Recent Orders Table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.35 }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">آخر الطلبات</h3>
          <a href="/orders" className="inline-flex items-center gap-1 text-sm text-primary-500 hover:text-primary-600 font-medium transition-colors">
            عرض الكل <ArrowUpLeft size={14} />
          </a>
        </div>
        <DataTable columns={orderColumns} data={recentOrders} emptyMessage="لا توجد طلبات بعد" />
      </motion.div>
    </div>
  )
}
