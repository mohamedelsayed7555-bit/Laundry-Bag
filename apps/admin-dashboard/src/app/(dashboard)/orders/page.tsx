'use client'

import { useEffect, useState } from 'react'
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
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import Tooltip from '@/components/ui/Tooltip'
import PermissionGate from '@/components/ui/PermissionGate'
import { ORDER_STATUS_LABELS, SERVICE_TYPE_LABELS } from '@cleano/shared-types'
import type { OrderStatus, ServiceType } from '@cleano/shared-types'

const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple'> = {
  pending: 'warning', assigned: 'info', picked_up: 'purple', processing: 'info',
  ready: 'success', delivering: 'purple', delivered: 'success', cancelled: 'danger', refunded: 'neutral',
}

const statusFlow: Record<string, string> = {
  pending: 'assigned', assigned: 'picked_up', picked_up: 'processing',
  processing: 'ready', ready: 'delivering', delivering: 'delivered',
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [detail, setDetail] = useState<any>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [drivers, setDrivers] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ customer_id: '', service_type: 'wash', items_count: 1, notes: '', total: 0, order_type: 'delivery' as 'delivery' | 'walkin', walkin_name: '', walkin_phone: '' })
  const [messages, setMessages] = useState<any[]>([])
  const [msgsLoading, setMsgsLoading] = useState(false)
  const [deliveryFeeSetting, setDeliveryFeeSetting] = useState(0)
  const { toast } = useToast()

  useEffect(() => {
    loadOrders()
    loadDriversCustomers()
    supabase.from('settings').select('value').eq('key', 'delivery_fee').single().then(({ data }) => {
      if (data) setDeliveryFeeSetting(Number(data.value) || 0)
    })
    const ch = supabase.channel('orders-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => loadOrders())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  async function loadOrders() {
    const { data } = await supabase.from('orders')
      .select('*, customer:users!orders_customer_id_fkey(name, phone, customer_code), driver:users!orders_driver_id_fkey(name, phone), subscription:subscriptions(items_used, items_limit)')
      .order('created_at', { ascending: false })
    setOrders(data ?? [])
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
    await supabase.from('orders').update({ driver_id: driverId, status: 'assigned' }).eq('id', orderId)
    await supabase.from('order_status_history').insert({ order_id: orderId, status: 'assigned', changed_by: driverId })
    const driverInfo = drivers.find(d => d.id === driverId)
    setDetail((prev: any) => prev?.id === orderId ? { ...prev, driver_id: driverId, status: 'assigned', driver: driverInfo ?? prev.driver } : prev)
    loadOrders()
    toast('تم تعيين السائق')
  }

  async function advanceStatus(order: any) {
    const next = statusFlow[order.status]
    if (!next) return
    await supabase.from('orders').update({ status: next }).eq('id', order.id)
    await supabase.from('order_status_history').insert({ order_id: order.id, status: next })
    loadOrders()
    setDetail((prev: any) => prev ? { ...prev, status: next } : null)
    toast(`تم تحديث الحالة إلى: ${ORDER_STATUS_LABELS[next as OrderStatus]}`)
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
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', id)
    loadOrders()
    setDetail(null)
    toast('تم إلغاء الطلب', 'warning')
  }

  async function handleAddOrder(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const total = form.total || 0
    const isWalkin = form.order_type === 'walkin'

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

  const allStatuses = ['all', 'pending', 'assigned', 'picked_up', 'processing', 'ready', 'delivering', 'delivered', 'cancelled']
  const filtered = orders.filter(o => {
    const matchSearch = !search || o.order_number?.toLowerCase().includes(search.toLowerCase()) || o.customer?.name?.includes(search)
    const matchStatus = statusFilter === 'all' || o.status === statusFilter
    return matchSearch && matchStatus
  })

  const columns = [
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
    { key: 'driver', label: 'السائق', render: (item: any) => item.driver?.name ?? <span className="text-gray-300">—</span> },
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
          <p className="text-sm text-gray-400 mt-0.5">{orders.length} طلب</p>
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
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap ${statusFilter === s ? 'bg-navy-900 text-white shadow-premium-md' : 'bg-white text-gray-500 hover:bg-surface-muted border border-surface-border/60'}`}>
              {s === 'all' ? 'الكل' : ORDER_STATUS_LABELS[s as OrderStatus] ?? s}
            </button>
          ))}
        </div>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-[3px] border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <DataTable columns={columns} data={filtered} emptyMessage="لا توجد طلبات" />
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`تفاصيل الطلب ${detail?.order_number ?? ''}`}>
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'العميل', value: detail.customer?.name },
                { label: 'الحالة', value: <Badge variant={statusVariant[detail.status]}>{ORDER_STATUS_LABELS[detail.status as OrderStatus]}</Badge> },
                { label: 'المبلغ', value: `${detail.total?.toFixed(2) ?? '—'} ج.م` },
                { label: 'القطع', value: `${detail.items_count} قطعة` },
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

            {['pending', 'assigned'].includes(detail.status) && !detail.notes?.includes('[من المحل]') && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1.5">{detail.driver_id ? 'تغيير السائق' : 'تعيين سائق'}</p>
                <select value={detail.driver_id ?? ''} onChange={e => { if (e.target.value && e.target.value !== detail.driver_id) assignDriver(detail.id, e.target.value) }} className={inputClass}>
                  {!detail.driver_id && <option value="">اختر سائق...</option>}
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.name} — {d.phone}</option>)}
                </select>
              </div>
            )}

            {detail.driver && (
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
              {statusFlow[detail.status] && (
                <button onClick={() => advanceStatus(detail)}
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-l from-primary-500 to-primary-600 text-white p-3 rounded-xl font-semibold text-sm hover:shadow-glow-green transition-all">
                  <ArrowRight size={16} /> {ORDER_STATUS_LABELS[statusFlow[detail.status] as OrderStatus]}
                </button>
              )}
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
                className={`flex-1 p-2.5 rounded-xl text-sm font-semibold transition-all ${form.order_type === 'walkin' ? 'bg-accent text-white' : 'bg-navy-50 text-gray-500 hover:bg-navy-100'}`}>
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
            <select value={form.service_type} onChange={e => setForm({ ...form, service_type: e.target.value })} required className={inputClass}>
              <option value="wash">غسيل</option><option value="iron">كوي</option>
              <option value="wash_iron">غسيل وكوي</option><option value="dry_clean">تنظيف جاف</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">عدد القطع <span className="text-red-400">*</span></label>
            <input type="number" min={1} value={form.items_count} onChange={e => setForm({ ...form, items_count: +e.target.value })} required className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">المبلغ (ج.م) <span className="text-red-400">*</span></label>
            <input type="number" min={0} step="0.01" value={form.total} onChange={e => setForm({ ...form, total: +e.target.value })} required className={inputClass} />
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
