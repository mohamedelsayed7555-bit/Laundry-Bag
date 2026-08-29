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
} from 'lucide-react'
import { ORDER_STATUS_LABELS } from '@cleano/shared-types'
import type { Order } from '@cleano/shared-types'

const statusBadge = (status: string) => {
  const map: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple'> = {
    pending: 'warning',
    assigned: 'info',
    picked_up: 'purple',
    processing: 'info',
    ready: 'success',
    delivering: 'purple',
    delivered: 'success',
    cancelled: 'danger',
    refunded: 'neutral',
  }
  return (
    <Badge variant={map[status] ?? 'neutral'}>
      {ORDER_STATUS_LABELS[status as keyof typeof ORDER_STATUS_LABELS] ?? status}
    </Badge>
  )
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
      <div className="bg-white rounded-2xl p-6 border border-surface-border/60">
        <div className="skeleton w-32 h-5 mb-6" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-4 mb-4">
            <div className="skeleton w-20 h-4 flex-shrink-0" />
            <div className="skeleton w-28 h-4 flex-shrink-0" />
            <div className="skeleton flex-1 h-4" />
            <div className="skeleton w-16 h-4 flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    totalCustomers: 0,
    totalDrivers: 0,
    activeOrders: 0,
    deliveredToday: 0,
  })
  const [recentOrders, setRecentOrders] = useState<any[]>([])
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
    const [orders, customers, drivers, recent] = await Promise.all([
      supabase.from('orders').select('id, total, status', { count: 'exact' }),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'driver'),
      supabase.from('orders').select('*, customer:users!orders_customer_id_fkey(name, customer_code)').order('created_at', { ascending: false }).limit(7),
    ])

    const allOrders = orders.data ?? []
    const revenue = allOrders.reduce((sum, o) => sum + (o.total ?? 0), 0)
    const active = allOrders.filter(o => !['delivered', 'cancelled', 'refunded'].includes(o.status)).length

    setStats({
      totalRevenue: revenue,
      totalOrders: orders.count ?? 0,
      totalCustomers: customers.count ?? 0,
      totalDrivers: drivers.count ?? 0,
      activeOrders: active,
      deliveredToday: allOrders.filter(o => o.status === 'delivered').length,
    })

    setRecentOrders(recent.data ?? [])
    setLoading(false)
  }

  const orderColumns = [
    {
      key: 'order_number',
      label: 'رقم الطلب',
      render: (item: any) => (
        <span className="font-semibold text-navy-800">{item.order_number}</span>
      ),
    },
    {
      key: 'customer',
      label: 'العميل',
      render: (item: any) => (
        <div>
          <p className="font-medium text-gray-800">{item.customer?.name ?? '—'}</p>
          <p className="text-[10px] text-gray-400">{item.customer?.customer_code}</p>
        </div>
      ),
    },
    {
      key: 'items_count',
      label: 'القطع',
      render: (item: any) => <span className="text-gray-600">{item.items_count} قطعة</span>,
    },
    {
      key: 'total',
      label: 'المبلغ',
      render: (item: any) => (
        <span className="font-semibold text-gray-800">{item.total?.toFixed(2)} ج.م</span>
      ),
    },
    {
      key: 'status',
      label: 'الحالة',
      render: (item: any) => statusBadge(item.status),
    },
    {
      key: 'created_at',
      label: 'التاريخ',
      render: (item: any) => (
        <span className="text-gray-400 text-xs">
          {new Date(item.created_at).toLocaleDateString('ar-EG')}
        </span>
      ),
    },
  ]

  if (loading) return <SkeletonLoader />

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between"
      >
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            نظرة عامة
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary-50 text-primary-600 text-[10px] font-semibold">
              <Activity size={10} />
              مباشر
            </span>
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">ملخص أداء المنصة</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="إجمالي الإيرادات" value={`${stats.totalRevenue.toLocaleString()} ج.م`} change="+12.5%" changeType="up" icon={DollarSign} color="green" index={0} />
        <StatCard label="إجمالي الطلبات" value={stats.totalOrders} change="+8.7%" changeType="up" icon={ClipboardList} color="blue" index={1} />
        <StatCard label="العملاء" value={stats.totalCustomers} change="-0.4%" changeType="down" icon={Users} color="purple" index={2} />
        <StatCard label="السائقين" value={stats.totalDrivers} icon={Truck} color="orange" index={3} />
        <StatCard label="طلبات نشطة" value={stats.activeOrders} icon={ShoppingBag} color="cyan" index={4} />
        <StatCard label="تم التوصيل" value={stats.deliveredToday} change="+18.3%" changeType="up" icon={TrendingUp} color="green" index={5} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">آخر الطلبات</h3>
          <a href="/orders" className="inline-flex items-center gap-1 text-sm text-primary-500 hover:text-primary-600 font-medium transition-colors">
            عرض الكل
            <ArrowUpLeft size={14} />
          </a>
        </div>
        <DataTable columns={orderColumns} data={recentOrders} emptyMessage="لا توجد طلبات بعد" />
      </motion.div>
    </div>
  )
}
