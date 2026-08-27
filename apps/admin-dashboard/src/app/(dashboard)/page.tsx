'use client'

import { useEffect, useState } from 'react'
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
      render: (item: any) => <span>{item.items_count} قطعة</span>,
    },
    {
      key: 'total',
      label: 'المبلغ',
      render: (item: any) => (
        <span className="font-semibold">{item.total?.toFixed(2)} ج.م</span>
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800">نظرة عامة</h2>
        <p className="text-sm text-gray-400">ملخص أداء المنصة</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          label="إجمالي الإيرادات"
          value={`${stats.totalRevenue.toLocaleString()} ج.م`}
          change="+12.5%"
          changeType="up"
          icon={DollarSign}
          color="green"
        />
        <StatCard
          label="إجمالي الطلبات"
          value={stats.totalOrders}
          change="+8.7%"
          changeType="up"
          icon={ClipboardList}
          color="blue"
        />
        <StatCard
          label="العملاء"
          value={stats.totalCustomers}
          change="-0.4%"
          changeType="down"
          icon={Users}
          color="purple"
        />
        <StatCard
          label="السائقين"
          value={stats.totalDrivers}
          icon={Truck}
          color="orange"
        />
        <StatCard
          label="طلبات نشطة"
          value={stats.activeOrders}
          icon={ShoppingBag}
          color="cyan"
        />
        <StatCard
          label="تم التوصيل"
          value={stats.deliveredToday}
          change="+18.3%"
          changeType="up"
          icon={TrendingUp}
          color="green"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">آخر الطلبات</h3>
          <a href="/orders" className="text-sm text-primary-500 hover:text-primary-600 font-medium">
            عرض الكل ←
          </a>
        </div>
        <DataTable columns={orderColumns} data={recentOrders} emptyMessage="لا توجد طلبات بعد" />
      </div>
    </div>
  )
}
