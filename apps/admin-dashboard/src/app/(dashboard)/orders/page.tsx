'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import DataTable from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import {
  ClipboardList,
  Plus,
  Search,
  Eye,
  ArrowRight,
  CheckSquare,
} from 'lucide-react'
import { PageSkeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import Tooltip from '@/components/ui/Tooltip'
import PermissionGate from '@/components/ui/PermissionGate'
import { isValidEgyptianPhone } from '@/lib/utils'
import { ORDER_STATUS_LABELS, SERVICE_TYPE_LABELS } from '@cleano/shared-types'
import type { OrderStatus, ServiceType } from '@cleano/shared-types'

const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple'> = {
  scheduled: 'purple', pending: 'warning', assigned: 'info', picked_up: 'purple', processing: 'info',
  ready: 'success', delivering: 'purple', delivered: 'success', cancelled: 'danger', refunded: 'neutral',
}

const statusFlow: Record<string, string> = {
  scheduled: 'pending', pending: 'assigned', assigned: 'picked_up', picked_up: 'processing',
  processing: 'ready', ready: 'delivering', delivering: 'delivered',
}

const walkinStatusFlow: Record<string, string> = {
  pending: 'processing', assigned: 'processing', picked_up: 'processing',
  processing: 'ready', ready: 'delivered',
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [detail, setDetail] = useState<any>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [drivers, setDrivers] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ customer_id: '', service_type: 'wash', items_count: 1, notes: '', total: '' as any, order_type: 'delivery' as 'delivery' | 'walkin', walkin_name: '', walkin_phone: '' })
  const [messages, setMessages] = useState<any[]>([])
  const [msgsLoading, setMsgsLoading] = useState(false)
  const [deliveryFeeSetting, setDeliveryFeeSetting] = useState(0)
  const [avgPrices, setAvgPrices] = useState<Record<string, number>>({})
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const { toast } = useToast()
  const PAGE_SIZE = 20

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const debouncedLoadOrders = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => loadOrders(), 2000)
  }, [])

  useEffect(() => {
    loadOrders()
    loadDriversCustomers()
    supabase.from('settings').select('value').eq('key', 'delivery_fee').single().then(({ data }) => {
      if (data) setDeliveryFeeSetting(Number(data.value) || 0)
    })
    supabase.from('prices').select('service_type, price').eq('is_active', true).then(({ data }) => {
      if (data) {
        const grouped: Record<string, number[]> = {}
        data.forEach((p: any) => { (grouped[p.service_type] ??= []).push(Number(p.price)) })
        const avgs: Record<string, number> = {}
        for (const [k, v] of Object.entries(grouped)) { avgs[k] = Math.round(v.reduce((a, b) => a + b, 0) / v.length) }
        setAvgPrices(avgs)
      }
    })
    const ch = supabase.channel('orders-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => debouncedLoadOrders())
      .subscribe()
    return () => { supabase.removeChannel(ch); if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  useEffect(() => { loadOrders(); setSelected(new Set()) }, [page, statusFilter])

  async function loadOrders() {
    let query = supabase.from('orders')
      .select('id, order_number, status, service_type, items_count, total, delivery_fee, cancellation_fee, cancellation_reason, notes, payment_status, payment_method, subscription_id, customer_id, driver_id, created_at, is_scheduled, scheduled_at, cancelled_at, customer:users!orders_customer_id_fkey(name, phone, customer_code), driver:users!orders_driver_id_fkey(name, phone), subscription:subscriptions(items_used, items_limit)', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (statusFilter !== 'all') query = query.eq('status', statusFilter)

    query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    const { data, count } = await query
    setOrders(data ?? [])
    setTotalCount(count ?? 0)
    setLoading(false)
  }

  async function loadDriversCustomers() {
    const [d, c] = await Promise.all([
      supabase.from('users').select('id, name, phone').eq('role', 'driver').eq('is_active', true),
      supabase.from('users').select('id, name, phone, customer_code').eq('role', 'customer'),
    ])
    setDrivers(d.data ?? [])
    setCustomers(c.data ?? [])
  }

  async function assignDriver(orderId: string, driverId: string) {
    const order = orders.find(o => o.id === orderId)
    if (order?.notes?.includes('[من المحل]')) { toast('طلب من المحل لا يحتاج سائق', 'error'); return }
    const driverInfo = drivers.find(d => d.id === driverId)
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, driver_id: driverId, status: 'assigned', driver: driverInfo } : o))
    setDetail((prev: any) => prev?.id === orderId ? { ...prev, driver_id: driverId, status: 'assigned', driver: driverInfo ?? prev.driver } : prev)
    toast('تم تعيين السائق')
    const { error } = await supabase.from('orders').update({ driver_id: driverId, status: 'assigned' }).eq('id', orderId)
    if (error) { toast('حدث خطأ — جاري التحديث', 'error'); loadOrders(); return }
    await supabase.from('order_status_history').insert({ order_id: orderId, status: 'assigned', changed_by: driverId })
    sendPushToCustomer(orderId, 'assigned')
  }

  async function sendPushToCustomer(orderId: string, newStatus: string) {
    try {
      const { data: order } = await supabase.from('orders').select('customer_id, order_number').eq('id', orderId).single()
      if (!order) return
      const msgs: Record<string, string> = {
        assigned: 'تم تعيين سائق لطلبك', picked_up: 'تم استلام ملابسك', processing: 'ملابسك قيد المعالجة',
        ready: 'ملابسك جاهزة للتوصيل!', delivering: 'السائق في طريقه إليك', delivered: 'تم توصيل طلبك بنجاح!', cancelled: 'تم إلغاء طلبك',
      }
      if (!msgs[newStatus]) return
      const title = `طلب ${order.order_number}`
      const body = msgs[newStatus]
      await supabase.from('notifications').insert({
        user_id: order.customer_id,
        title,
        body,
        type: 'order',
        data: { type: 'order_update', order_id: orderId, status: newStatus },
        sent_at: new Date().toISOString(),
      })
      const { data: customer } = await supabase.from('users').select('fcm_token').eq('id', order.customer_id).single()
      if (customer?.fcm_token) {
        fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: customer.fcm_token, title, body, sound: 'default', data: { type: 'order_update', order_id: orderId, status: newStatus } }),
        }).catch(() => {})
      }
    } catch {}
  }

  async function advanceStatus(order: any) {
    const isWalkin = order.notes?.includes('[من المحل]')
    const flow = isWalkin ? walkinStatusFlow : statusFlow
    const next = flow[order.status]
    if (!next) return
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: next } : o))
    setDetail((prev: any) => prev ? { ...prev, status: next } : null)
    toast(`تم تحديث الحالة إلى: ${ORDER_STATUS_LABELS[next as OrderStatus]}`)
    const { error } = await supabase.from('orders').update({ status: next }).eq('id', order.id)
    if (error) { toast('حدث خطأ — جاري التحديث', 'error'); loadOrders(); return }
    await supabase.from('order_status_history').insert({ order_id: order.id, status: next })
    sendPushToCustomer(order.id, next)
    if (next === 'ready') {
      const lat = order.delivery_location?.lat
      const lng = order.delivery_location?.lng
      const { data: driverId } = await supabase.rpc('assign_delivery_driver', { p_order_id: order.id, p_lat: lat ? Number(lat) : null, p_lng: lng ? Number(lng) : null })
      if (driverId) {
        toast('تم تعيين سائق التوصيل تلقائياً')
      } else {
        toast('لا يوجد سائق متاح للتوصيل — يمكنك التعيين يدوياً', 'error')
      }
      loadOrders()
    }
  }

  async function bulkAdvanceStatus() {
    if (selected.size === 0) return
    const selectedOrders = orders.filter(o => selected.has(o.id))
    const advanceable = selectedOrders.filter(o => {
      const isWalkin = o.notes?.includes('[من المحل]')
      const flow = isWalkin ? walkinStatusFlow : statusFlow
      return !!flow[o.status]
    })
    if (advanceable.length === 0) { toast('لا توجد طلبات يمكن تقديم حالتها', 'error'); return }
    setBulkUpdating(true)
    for (const order of advanceable) {
      await advanceStatus(order)
    }
    setSelected(new Set())
    setBulkUpdating(false)
    toast(`تم تحديث ${advanceable.length} طلب`)
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(o => o.id)))
    }
  }

  async function loadMessages(orderId: string) {
    setMsgsLoading(true)
    const { data } = await supabase.from('messages')
      .select('*, sender:users!messages_sender_id_fkey(name, role)')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true })
    setMessages(data ?? [])
    setMsgsLoading(false)
  }

  function openDetail(order: any) {
    setDetail(order)
    loadMessages(order.id)
  }

  async function cancelOrder(id: string) {
    const order = orders.find(o => o.id === id)
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'cancelled' } : o))
    setDetail(null)
    toast('تم إلغاء الطلب', 'warning')
    const { error } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', id)
    if (error) { toast('حدث خطأ — جاري التحديث', 'error'); loadOrders(); return }
    await supabase.from('order_status_history').insert({ order_id: id, status: 'cancelled' })
    if (order?.subscription_id && order.items_count) {
      const { data: sub } = await supabase.from('subscriptions').select('items_used').eq('id', order.subscription_id).single()
      if (sub) {
        const newUsed = Math.max(0, (sub.items_used ?? 0) - order.items_count)
        await supabase.from('subscriptions').update({ items_used: newUsed }).eq('id', order.subscription_id)
      }
    }
  }

  async function handleAddOrder(e: React.FormEvent) {
    e.preventDefault()
    const isWalkin = form.order_type === 'walkin'
    if (isWalkin && !isValidEgyptianPhone(form.walkin_phone)) { toast('رقم الموبايل غير صحيح — يجب أن يبدأ بـ 01 ويكون 11 رقم', 'error'); return }
    setSaving(true)
    const total = form.total || 0

    let customerId = form.customer_id

    if (isWalkin) {
      const { data: existing } = await supabase.from('users').select('id').eq('phone', form.walkin_phone).eq('role', 'customer').single()
      if (existing) {
        customerId = existing.id
      } else {
        const { data: newId, error: rpcErr } = await supabase.rpc('create_walkin_customer', { p_name: form.walkin_name, p_phone: form.walkin_phone })
        if (rpcErr || !newId) { setSaving(false); toast('خطأ في إنشاء العميل', 'error'); return }
        customerId = newId
      }
    }

    const { error } = await supabase.from('orders').insert({
      customer_id: customerId, service_type: form.service_type,
      items_count: form.items_count, notes: isWalkin ? `[من المحل] ${form.walkin_name} - ${form.walkin_phone}${form.notes ? '\n' + form.notes : ''}` : (form.notes || null),
      status: isWalkin ? 'processing' : 'pending',
      payment_status: 'pending', payment_method: 'cash',
      subtotal: total, delivery_fee: isWalkin ? 0 : deliveryFeeSetting, total: isWalkin ? total : total + deliveryFeeSetting, delivery_location: {},
    })
    setSaving(false)
    if (!error) {
      setShowAdd(false)
      setForm({ customer_id: '', service_type: 'wash', items_count: 1, notes: '', total: 0, order_type: 'delivery', walkin_name: '', walkin_phone: '' })
      loadOrders(); toast(isWalkin ? 'تم إضافة طلب من المحل' : 'تم إضافة الطلب')
    } else { console.error('Order insert error:', error); toast('حدث خطأ', 'error') }
  }

  const allStatuses = ['all', 'scheduled', 'pending', 'assigned', 'picked_up', 'processing', 'ready', 'delivering', 'delivered', 'cancelled']
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const filtered = useMemo(() => orders.filter(o => {
    if (!search) return true
    const s = search.toLowerCase()
    return o.order_number?.toLowerCase().includes(s) || o.customer?.name?.toLowerCase().includes(s)
  }), [orders, search])

  const columns = [
    { key: 'select', label: '', render: (item: any) => (
      <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)}
        className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500/20 cursor-pointer" />
    )},
    { key: 'order_number', label: 'رقم الطلب', render: (item: any) => <span className="font-semibold text-navy-800">{item.order_number}</span> },
    { key: 'customer', label: 'العميل', render: (item: any) => (
      <div>
        <p className="font-medium text-gray-800">{item.customer?.name ?? '—'}</p>
        <p className="text-[10px] text-gray-400">{item.customer?.customer_code}</p>
      </div>
    )},
    { key: 'type', label: 'النوع', render: (item: any) => {
      if (item.notes?.includes('[من المحل]')) return <Badge variant="warning">من المحل</Badge>
      if (item.subscription_id) return <Badge variant="info">باقة</Badge>
      return <Badge variant="neutral">عادي</Badge>
    }},
    { key: 'service_type', label: 'الخدمة', render: (item: any) => <span className="text-gray-600 text-xs">{SERVICE_TYPE_LABELS[item.service_type as ServiceType] ?? item.service_type}</span> },
    { key: 'items_count', label: 'القطع', render: (item: any) => (
      <div>
        <span className="text-gray-600">{item.items_count}</span>
        {item.subscription && (
          <p className="text-[10px] text-primary-500 font-medium">{item.subscription.items_used} من {item.subscription.items_limit}</p>
        )}
      </div>
    )},
    { key: 'total', label: 'المبلغ', render: (item: any) => <span className="font-semibold text-gray-800">{item.total ? `${item.total.toFixed(2)} ج.م` : '—'}</span> },
    { key: 'payment', label: 'الدفع', render: (item: any) => {
      const pmLabels: Record<string, string> = { cash: 'كاش', visa: 'فيزا', e_wallet: 'محفظة', instapay: 'إنستاباي' }
      const psVariant: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = { confirmed: 'success', pending: 'warning', failed: 'danger' }
      const psLabels: Record<string, string> = { confirmed: 'مدفوع', pending: 'معلق', failed: 'فشل' }
      return (
        <div className="text-center">
          <Badge variant={psVariant[item.payment_status as string] as any ?? 'neutral'}>{psLabels[item.payment_status] ?? item.payment_status}</Badge>
          <p className="text-[10px] text-gray-400 mt-0.5">{pmLabels[item.payment_method] ?? item.payment_method}</p>
        </div>
      )
    }},
    { key: 'driver', label: 'السائق', render: (item: any) => item.notes?.includes('[من المحل]') ? <span className="text-gray-300">—</span> : (item.driver?.name ?? <span className="text-gray-300">—</span>) },
    { key: 'scheduled', label: 'الموعد', render: (item: any) => item.is_scheduled && item.scheduled_at ? (
      <span className="text-xs text-amber-500 font-medium">🕐 {new Date(item.scheduled_at).toLocaleDateString('ar-EG')} {new Date(item.scheduled_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
    ) : <span className="text-gray-300 text-xs">فوري</span> },
    { key: 'status', label: 'الحالة', render: (item: any) => <Badge variant={statusVariant[item.status] ?? 'neutral'}>{ORDER_STATUS_LABELS[item.status as OrderStatus] ?? item.status}</Badge> },
    { key: 'actions', label: '', render: (item: any) => (
      <Tooltip content="عرض التفاصيل">
        <button onClick={() => openDetail(item)} className="p-1.5 hover:bg-surface-muted rounded-lg transition-colors">
          <Eye size={15} className="text-gray-400 hover:text-gray-600" />
        </button>
      </Tooltip>
    )},
  ]

  const inputClass = "w-full p-3 border border-surface-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-500/30 transition-all"

  return (
    <PermissionGate permission="orders.view">
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary-500" /> إدارة الطلبات
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">{totalCount} طلب</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-gradient-to-l from-primary-500 to-primary-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:shadow-glow-green transition-all duration-300">
          <Plus size={16} /> طلب جديد
        </button>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="بحث برقم الطلب أو اسم العميل..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pr-10 pl-4 py-2.5 bg-white border border-surface-border/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-500/30 transition-all" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {allStatuses.map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(0) }}
              className={`px-3 py-2 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap ${statusFilter === s ? 'bg-navy-900 text-white shadow-premium-md' : 'bg-white text-gray-500 hover:bg-surface-muted border border-surface-border/60'}`}>
              {s === 'all' ? 'الكل' : ORDER_STATUS_LABELS[s as OrderStatus] ?? s}
            </button>
          ))}
        </div>
      </motion.div>

      {selected.size > 0 && (
        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 bg-primary-50 border border-primary-200 rounded-xl px-4 py-3">
          <input type="checkbox" checked={selected.size === filtered.length} onChange={toggleSelectAll}
            className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500/20 cursor-pointer" />
          <span className="text-sm font-medium text-primary-700">تم تحديد {selected.size} طلب</span>
          <button onClick={bulkAdvanceStatus} disabled={bulkUpdating}
            className="mr-auto flex items-center gap-2 bg-gradient-to-l from-primary-500 to-primary-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:shadow-glow-green transition-all disabled:opacity-50">
            <ArrowRight size={14} />
            {bulkUpdating ? 'جاري التحديث...' : 'تقديم الحالة للمحدد'}
          </button>
          <button onClick={() => setSelected(new Set())} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
            إلغاء التحديد
          </button>
        </motion.div>
      )}

      {loading ? (
        <PageSkeleton stats={0} tableRows={6} tableCols={6} />
      ) : (
        <>
          <DataTable columns={columns} data={filtered} emptyMessage="لا توجد طلبات" pageSize={PAGE_SIZE} />
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-gray-400">صفحة {page + 1} من {totalPages}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => p - 1)} disabled={page === 0}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <span className="text-gray-600 text-sm">›</span>
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const pageNum = totalPages <= 5 ? i : page < 3 ? i : page > totalPages - 4 ? totalPages - 5 + i : page - 2 + i
                  return (
                    <button key={pageNum} onClick={() => setPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${page === pageNum ? 'bg-navy-900 text-white shadow-premium-md' : 'text-gray-500 hover:bg-surface-muted'}`}>
                      {pageNum + 1}
                    </button>
                  )
                })}
                <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <span className="text-gray-600 text-sm">‹</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`تفاصيل الطلب ${detail?.order_number ?? ''}`}>
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'العميل', value: <div><p>{detail.customer?.name}</p>{detail.customer?.phone && <p className="text-[11px] text-gray-400 font-normal mt-0.5" dir="ltr">{detail.customer.phone}</p>}</div> },
                { label: 'الحالة', value: <Badge variant={statusVariant[detail.status]}>{ORDER_STATUS_LABELS[detail.status as OrderStatus]}</Badge> },
                { label: 'المبلغ', value: `${detail.total?.toFixed(2) ?? '—'} ج.م` },
                { label: 'الدفع', value: <div>
                  <Badge variant={detail.payment_status === 'confirmed' ? 'success' : detail.payment_status === 'failed' ? 'danger' : 'warning'}>
                    {detail.payment_status === 'confirmed' ? 'مدفوع' : detail.payment_status === 'failed' ? 'فشل' : 'معلق'}
                  </Badge>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {{ cash: 'كاش', visa: 'فيزا', e_wallet: 'محفظة', instapay: 'إنستاباي' }[detail.payment_method as string] ?? detail.payment_method}
                  </p>
                </div> },
              ].map((item, i) => (
                <div key={i} className="bg-surface-muted/50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 mb-0.5">{item.label}</p>
                  <div className="text-sm font-semibold text-gray-800">{item.value}</div>
                </div>
              ))}
            </div>

            {detail.notes && (
              <div className="bg-amber-50/50 rounded-xl p-3 border border-amber-100">
                <p className="text-[10px] text-amber-600 mb-0.5">ملاحظات</p>
                <p className="text-sm text-amber-800">{detail.notes}</p>
              </div>
            )}

            {detail.status === 'cancelled' && (
              <div className="bg-red-50/50 rounded-xl p-3 border border-red-100">
                <p className="text-[10px] text-red-600 mb-0.5">الإلغاء</p>
                <p className="text-sm text-red-800">{detail.cancellation_reason ?? 'بدون سبب'}</p>
                {detail.cancellation_fee > 0 && (
                  <p className="text-sm font-semibold text-red-700 mt-1">💰 رسوم إلغاء: {Number(detail.cancellation_fee).toFixed(2)} ج.م</p>
                )}
                {detail.cancelled_at && (
                  <p className="text-[10px] text-red-400 mt-1">{new Date(detail.cancelled_at).toLocaleString('ar-EG')}</p>
                )}
              </div>
            )}

            {detail.payment_status !== 'confirmed' && !['cancelled', 'refunded'].includes(detail.status) && (
              <div className="flex gap-2">
                <button onClick={async () => {
                  await supabase.from('orders').update({ payment_status: 'confirmed' }).eq('id', detail.id)
                  setDetail({ ...detail, payment_status: 'confirmed' })
                  setOrders(prev => prev.map(o => o.id === detail.id ? { ...o, payment_status: 'confirmed' } : o))
                  toast('تم تأكيد الدفع')
                }} className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 text-white p-2.5 rounded-xl font-semibold text-sm hover:bg-emerald-600 transition-colors">
                  تأكيد الدفع ✓
                </button>
                {detail.payment_status !== 'failed' && (
                  <button onClick={async () => {
                    await supabase.from('orders').update({ payment_status: 'failed' }).eq('id', detail.id)
                    setDetail({ ...detail, payment_status: 'failed' })
                    setOrders(prev => prev.map(o => o.id === detail.id ? { ...o, payment_status: 'failed' } : o))
                    toast('تم رفض الدفع')
                  }} className="px-4 py-2.5 border border-red-200 text-red-500 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors">
                    رفض
                  </button>
                )}
              </div>
            )}

            {['pending', 'assigned'].includes(detail.status) && !detail.notes?.includes('[من المحل]') && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1.5">{detail.driver_id ? 'تغيير السائق' : 'تعيين سائق'}</p>
                <select value={detail.driver_id ?? ''} onChange={e => { if (e.target.value && e.target.value !== detail.driver_id) assignDriver(detail.id, e.target.value) }} className={inputClass}>
                  {!detail.driver_id && <option value="">اختر سائق...</option>}
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.name} — {d.phone}</option>)}
                </select>
              </div>
            )}

            {detail.driver && !detail.notes?.includes('[من المحل]') && (
              <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100">
                <p className="text-[10px] text-blue-600 mb-0.5">السائق الحالي</p>
                <p className="text-sm font-semibold text-blue-800">{detail.driver.name} — {detail.driver.phone}</p>
              </div>
            )}

            <div className="bg-surface-muted/30 rounded-xl p-3 border border-navy-100">
              <p className="text-[10px] text-gray-400 mb-2 font-medium">المحادثة</p>
              {msgsLoading ? (
                <p className="text-xs text-gray-400 text-center py-4">جاري التحميل...</p>
              ) : messages.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">لا توجد رسائل</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {messages.map(msg => (
                    <div key={msg.id} className={`flex flex-col ${msg.sender?.role === 'driver' ? 'items-start' : 'items-end'}`}>
                      <p className="text-[10px] text-gray-400 mb-0.5">{msg.sender?.name} — {msg.sender?.role === 'driver' ? 'سائق' : 'عميل'}</p>
                      <div className={`px-3 py-2 rounded-xl max-w-[80%] text-sm ${msg.sender?.role === 'driver' ? 'bg-blue-50 text-blue-800' : 'bg-green-50 text-green-800'}`}>
                        {msg.body}
                      </div>
                      <p className="text-[9px] text-gray-300 mt-0.5">{new Date(msg.created_at).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              {(() => {
                const isWalkin = detail.notes?.includes('[من المحل]')
                const flow = isWalkin ? walkinStatusFlow : statusFlow
                const next = flow[detail.status]
                return next ? (
                  <button onClick={() => advanceStatus(detail)}
                    className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-l from-primary-500 to-primary-600 text-white p-3 rounded-xl font-semibold text-sm hover:shadow-glow-green transition-all">
                    <ArrowRight size={16} /> {ORDER_STATUS_LABELS[next as OrderStatus]}
                  </button>
                ) : null
              })()}
              {!['delivered', 'cancelled', 'refunded'].includes(detail.status) && (
                <button onClick={() => cancelOrder(detail.id)}
                  className="px-4 py-3 border border-red-200 text-red-500 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors">
                  إلغاء
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="طلب جديد">
        <form onSubmit={handleAddOrder} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">نوع الطلب</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setForm({ ...form, order_type: 'delivery' })}
                className={`flex-1 p-2.5 rounded-xl text-sm font-semibold transition-all ${form.order_type === 'delivery' ? 'bg-primary-500 text-white' : 'bg-navy-50 text-gray-500 hover:bg-navy-100'}`}>
                توصيل
              </button>
              <button type="button" onClick={() => setForm({ ...form, order_type: 'walkin' })}
                className={`flex-1 p-2.5 rounded-xl text-sm font-semibold transition-all ${form.order_type === 'walkin' ? 'bg-accent-orange text-white' : 'bg-navy-50 text-gray-500 hover:bg-navy-100'}`}>
                من المحل
              </button>
            </div>
          </div>
          {form.order_type === 'delivery' ? (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">العميل <span className="text-red-400">*</span></label>
            <select value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })} required className={inputClass}>
              <option value="">اختر عميل...</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.customer_code})</option>)}
            </select>
          </div>
          ) : (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">اسم العميل <span className="text-red-400">*</span></label>
              <input type="text" value={form.walkin_name} onChange={e => setForm({ ...form, walkin_name: e.target.value })} required className={inputClass} placeholder="اسم العميل" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">رقم الموبايل <span className="text-red-400">*</span></label>
              <input type="tel" value={form.walkin_phone} onChange={e => setForm({ ...form, walkin_phone: e.target.value })} required className={inputClass} placeholder="01xxxxxxxxx" dir="ltr" />
            </div>
          </>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">الخدمة <span className="text-red-400">*</span></label>
            <select value={form.service_type} onChange={e => {
              const st = e.target.value
              const avg = avgPrices[st] ?? 0
              setForm({ ...form, service_type: st, total: avg ? avg * form.items_count : form.total })
            }} required className={inputClass}>
              <option value="wash">غسيل</option><option value="iron">كوي</option>
              <option value="wash_iron">غسيل وكوي</option><option value="dry_clean">تنظيف جاف</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">عدد القطع <span className="text-red-400">*</span></label>
            <input type="number" min={1} value={form.items_count} onChange={e => {
              const count = +e.target.value || 1
              const avg = avgPrices[form.service_type] ?? 0
              setForm({ ...form, items_count: count, total: avg ? avg * count : form.total })
            }} required className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">المبلغ (ج.م) <span className="text-red-400">*</span></label>
            <input type="number" min={0} step="0.01" value={form.total} onChange={e => setForm({ ...form, total: e.target.value === '' ? '' as any : +e.target.value })} required className={inputClass} placeholder="0.00" />
            {avgPrices[form.service_type] && <p className="text-[10px] text-gray-400 mt-1">محسوب تلقائي (متوسط {avgPrices[form.service_type]} ج.م × {form.items_count} قطعة) — يمكنك تعديله</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">ملاحظات</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className={inputClass + ' resize-none'} placeholder="اختياري" />
          </div>
          <button type="submit" disabled={saving}
            className="w-full bg-gradient-to-l from-primary-500 to-primary-600 text-white p-3 rounded-xl font-semibold hover:shadow-glow-green disabled:opacity-50 transition-all">
            {saving ? 'جاري الحفظ...' : 'إضافة الطلب'}
          </button>
        </form>
      </Modal>
    </div>
    </PermissionGate>
  )
}
