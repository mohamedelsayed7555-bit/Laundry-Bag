'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { motion } from 'framer-motion'
import { Star, MessageSquare, TrendingUp, Users } from 'lucide-react'
import DataTable from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import { TableSkeleton } from '@/components/ui/Skeleton'
import PermissionGate from '@/components/ui/PermissionGate'

export default function RatingsPage() {
  const [ratings, setRatings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, avgService: 0, avgDriver: 0, withNotes: 0 })
  const [filter, setFilter] = useState<'all' | 'with_notes' | 'low'>('all')
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const PAGE_SIZE = 20

  useEffect(() => { loadRatings() }, [page, filter])
  useEffect(() => { loadStats() }, [])

  async function loadStats() {
    const { data } = await supabase
      .from('orders')
      .select('rating_service, rating_driver, rating_note')
      .not('rated_at', 'is', null)

    if (data && data.length > 0) {
      const total = data.length
      const avgService = data.reduce((sum, r) => sum + (r.rating_service || 0), 0) / total
      const avgDriver = data.filter(r => r.rating_driver).reduce((sum, r) => sum + r.rating_driver, 0) / (data.filter(r => r.rating_driver).length || 1)
      const withNotes = data.filter(r => r.rating_note).length
      setStats({ total, avgService: Math.round(avgService * 10) / 10, avgDriver: Math.round(avgDriver * 10) / 10, withNotes })
    }
  }

  async function loadRatings() {
    let query = supabase
      .from('orders')
      .select('id, order_number, rating_service, rating_driver, rating_note, rated_at, customer:users!orders_customer_id_fkey(name, phone), driver:users!orders_driver_id_fkey(name)', { count: 'exact' })
      .not('rated_at', 'is', null)
      .order('rated_at', { ascending: false })

    if (filter === 'with_notes') {
      query = query.not('rating_note', 'is', null).neq('rating_note', '') as any
    } else if (filter === 'low') {
      query = query.lte('rating_service', 2) as any
    }

    const { data, count } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    setRatings(data ?? [])
    setTotalCount(count ?? 0)
    setLoading(false)
  }

  function renderStars(count: number) {
    return '⭐'.repeat(count) + '☆'.repeat(5 - count)
  }

  const columns = [
    {
      key: 'order_number',
      label: 'رقم الطلب',
      render: (item: any) => <span className="font-semibold text-gray-800">{item.order_number}</span>,
    },
    {
      key: 'customer',
      label: 'العميل',
      render: (item: any) => (
        <div>
          <p className="font-medium text-gray-800">{item.customer?.name ?? '—'}</p>
          <p className="text-[10px] text-gray-400">{item.customer?.phone}</p>
        </div>
      ),
    },
    {
      key: 'rating_service',
      label: 'تقييم الخدمة',
      render: (item: any) => (
        <div className="flex items-center gap-1">
          <span className="text-sm">{renderStars(item.rating_service)}</span>
          <span className="text-xs font-bold text-gray-600 mr-1">{item.rating_service}/5</span>
        </div>
      ),
    },
    {
      key: 'rating_driver',
      label: 'تقييم السائق',
      render: (item: any) => item.rating_driver ? (
        <div>
          <span className="text-sm">{renderStars(item.rating_driver)}</span>
          <span className="text-xs font-bold text-gray-600 mr-1">{item.rating_driver}/5</span>
          {item.driver?.name && <p className="text-[10px] text-gray-400 mt-0.5">{item.driver.name}</p>}
        </div>
      ) : <span className="text-gray-300 text-xs">—</span>,
    },
    {
      key: 'rating_note',
      label: 'ملاحظات',
      render: (item: any) => item.rating_note ? (
        <p className="text-xs text-gray-600 max-w-[200px] line-clamp-2">{item.rating_note}</p>
      ) : <span className="text-gray-300 text-xs">—</span>,
    },
    {
      key: 'rated_at',
      label: 'التاريخ',
      render: (item: any) => (
        <div>
          <span className="text-xs text-gray-600">
            {new Date(item.rated_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
          </span>
          <p className="text-[10px] text-gray-400">
            {new Date(item.rated_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      ),
    },
  ]

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <PermissionGate permission="ratings.view">
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            التقييمات
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">تقييمات العملاء للطلبات والسواقين</p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <StatCard icon={<Star size={18} className="text-yellow-500" />} label="إجمالي التقييمات" value={stats.total} />
          <StatCard icon={<TrendingUp size={18} className="text-emerald-500" />} label="متوسط تقييم الخدمة" value={`${stats.avgService} / 5`} />
          <StatCard icon={<Users size={18} className="text-blue-500" />} label="متوسط تقييم السائق" value={`${stats.avgDriver} / 5`} />
          <StatCard icon={<MessageSquare size={18} className="text-purple-500" />} label="تقييمات بملاحظات" value={stats.withNotes} />
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex gap-2"
        >
          {([
            { key: 'all', label: 'الكل' },
            { key: 'with_notes', label: 'بملاحظات' },
            { key: 'low', label: 'تقييم منخفض (1-2)' },
          ] as { key: typeof filter; label: string }[]).map(f => (
            <button
              key={f.key}
              onClick={() => { setFilter(f.key); setPage(0) }}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                filter === f.key
                  ? 'bg-navy-900 text-white shadow-premium-md'
                  : 'bg-white text-gray-500 hover:bg-surface-muted border border-surface-border/60'
              }`}
            >
              {f.label}
            </button>
          ))}
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {loading ? (
            <TableSkeleton />
          ) : (
            <>
              <DataTable columns={columns} data={ratings} emptyMessage="لا توجد تقييمات بعد" />
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-surface-border/60 disabled:opacity-40"
                  >
                    السابق
                  </button>
                  <span className="text-xs text-gray-500">{page + 1} / {totalPages}</span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-surface-border/60 disabled:opacity-40"
                  >
                    التالي
                  </button>
                </div>
              )}
            </>
          )}
        </motion.div>
      </div>
    </PermissionGate>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-2xl border border-surface-border/60 p-4 flex flex-col items-center gap-2">
      <div className="w-9 h-9 rounded-xl bg-surface-muted flex items-center justify-center">{icon}</div>
      <span className="text-lg font-bold text-gray-800">{value}</span>
      <span className="text-[11px] text-gray-400">{label}</span>
    </div>
  )
}
