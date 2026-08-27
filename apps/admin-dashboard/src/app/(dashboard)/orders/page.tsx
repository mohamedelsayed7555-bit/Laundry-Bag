'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import DataTable from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { Search, Plus, Eye, Edit2 } from 'lucide-react'
import { ORDER_STATUS_LABELS } from '@cleano/shared-types'
import { useToast } from '@/components/ui/Toast'

const statusVariant = (status: string) => {
  const map: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple'> = {
    pending: 'warning', assigned: 'info', picked_up: 'purple', processing: 'info',
    ready: 'success', delivering: 'purple', delivered: 'success', cancelled: 'danger', refunded: 'neutral',
  }
  return map[status] ?? 'neutral'
}

const paymentLabel: Record<string, string> = {
  cash: 'كاش', instapay: 'إنستاباي', wallet: 'محفظة',
}

const statusFlow = ['pending', 'assigned', 'picked_up', 'processing', 'ready', 'delivering', 'delivered']

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [prices, setPrices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showDetail, setShowDetail] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    customer_id: '', service_type: 'wash', items_count: 1, payment_method: 'cash', notes: '',
  })
  const { toast } = useToast()

  useEffect(() => { loadOrders() }, [filter])

  useEffect(() => {
    const channel = supabase.channel('admin-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => loadOrders())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [filter])

  useEffect(() => {
    supabase.from('users').select('id, name, customer_code').eq('role', 'customer').then(({ data }) => setCustomers(data ?? []))
    supabase.from('users').select('id, name').eq('role', 'driver').eq('is_active', true).then(({ data }) => setDrivers(data ?? []))
    supabase.from('prices').select('*').eq('is_active', true).then(({ data }) => setPrices(data ?? []))
  }, [])

  async function loadOrders() {
    setLoading(true)
    let query = supabase
      .from('orders')
      .select('*, customer:users!orders_customer_id_fkey(name, customer_code, phone), driver:users!orders_driver_id_fkey(name)')
      .order('created_at', { ascending: false })
    if (filter !== 'all') query = query.eq('status', filter)
    const { data } = await query
    setOrders(data ?? [])
    setLoading(false)
  }

  async function handleAddOrder(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const matchingPrices = prices.filter(p => p.service_type === form.service_type)
    const avgPrice = matchingPrices.length > 0 ? matchingPrices.reduce((s, p) => s + p.price, 0) / matchingPrices.length : 0
    const total = avgPrice * form.items_count

    const { error } = await supabase.from('orders').insert({
      customer_id: form.customer_id,
      service_type: form.service_type,
      items_count: form.items_count,
      total,
      payment_method: form.payment_method,
      notes: form.notes || null,
      status: 'pending',
      payment_status: 'pending',
    })
    setSaving(false)
    if (!error) {
      setShowAdd(false)
      setForm({ customer_id: '', service_type: 'wash', items_count: 1, payment_method: 'cash', notes: '' })
      loadOrders()
      toast('تم إنشاء الطلب بنجاح')
    } else { toast('حدث خطأ أثناء إنشاء الطلب', 'error') }
  }

  async function updateOrderStatus(orderId: string, newStatus: string) {
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId)
    await supabase.from('order_status_history').insert({ order_id: orderId, status: newStatus, changed_by: (await supabase.auth.getUser()).data.user?.id })
    loadOrders()
    setShowDetail(null)
    toast(`تم تحديث حالة الطلب إلى: ${ORDER_STATUS_LABELS[newStatus as keyof typeof ORDER_STATUS_LABELS] ?? newStatus}`)
  }

  async function assignDriver(orderId: string, driverId: string) {
    await supabase.from('orders').update({ driver_id: driverId, status: 'assigned' }).eq('id', orderId)
    loadOrders()
    setShowDetail(null)
    toast('تم تعيين السائق بنجاح')
  }

  const filtered = orders.filter(o => {
    if (!search) return true
    return o.order_number?.includes(search) || o.customer?.name?.includes(search) ||
      o.customer?.customer_code?.includes(search) || o.customer?.phone?.includes(search)
  })

  const columns = [
    { key: 'order_number', label: 'رقم الطلب', render: (item: any) => <span className="font-bold text-navy-800">{item.order_number}</span> },
    { key: 'customer', label: 'العميل', render: (item: any) => (
      <div><p className="font-medium">{item.customer?.name ?? '—'}</p><p className="text-[10px] text-gray-400">{item.customer?.customer_code}</p></div>
    )},
    { key: 'items_count', label: 'القطع' },
    { key: 'total', label: 'المبلغ', render: (item: any) => <span className="font-semibold">{item.total?.toFixed(2)} ج.م</span> },
    { key: 'payment_method', label: 'الدفع', render: (item: any) => paymentLabel[item.payment_method] ?? item.payment_method },
    { key: 'driver', label: 'السائق', render: (item: any) => item.driver?.name ?? <span className="text-gray-300">غير معين</span> },
    { key: 'status', label: 'الحالة', render: (item: any) => (
      <Badge variant={statusVariant(item.status)}>{ORDER_STATUS_LABELS[item.status as keyof typeof ORDER_STATUS_LABELS] ?? item.status}</Badge>
    )},
    { key: 'actions', label: '', render: (item: any) => (
      <button onClick={() => setShowDetail(item)} className="p-1.5 hover:bg-gray-100 rounded-lg transition"><Eye size={16} className="text-gray-500" /></button>
    )},
  ]

  const statusFilters = [
    { key: 'all', label: 'الكل' }, { key: 'pending', label: 'في الانتظار' }, { key: 'assigned', label: 'تم التعيين' },
    { key: 'picked_up', label: 'تم الاستلام' }, { key: 'processing', label: 'جاري المعالجة' }, { key: 'ready', label: 'جاهز' },
    { key: 'delivering', label: 'جاري التوصيل' }, { key: 'delivered', label: 'تم التوصيل' }, { key: 'cancelled', label: 'ملغي' },
  ]

  const nextStatus = (current: string) => {
    const idx = statusFlow.indexOf(current)
    return idx >= 0 && idx < statusFlow.length - 1 ? statusFlow[idx + 1] : null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">إدارة الطلبات</h2>
          <p className="text-sm text-gray-400">{orders.length} طلب</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-primary-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-600 transition shadow-lg shadow-primary-500/25">
          <Plus size={16} /> طلب جديد
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="بحث برقم الطلب أو اسم العميل..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full max-w-md pr-10 pl-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition" />
      </div>

      <div className="flex gap-2 flex-wrap">
        {statusFilters.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filter === f.key ? 'bg-navy-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <DataTable columns={columns} data={filtered} emptyMessage="لا توجد طلبات" />
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="طلب جديد">
        <form onSubmit={handleAddOrder} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">العميل</label>
            <select value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })} required
              className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20">
              <option value="">اختر العميل</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.customer_code})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">نوع الخدمة</label>
            <select value={form.service_type} onChange={e => setForm({ ...form, service_type: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20">
              <option value="wash">غسيل</option>
              <option value="iron">كوي</option>
              <option value="wash_iron">غسيل وكوي</option>
              <option value="dry_clean">تنظيف جاف</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">عدد القطع</label>
            <input type="number" min={1} value={form.items_count} onChange={e => setForm({ ...form, items_count: +e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">طريقة الدفع</label>
            <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20">
              <option value="cash">كاش</option>
              <option value="instapay">إنستاباي</option>
              <option value="wallet">محفظة</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">ملاحظات</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
              className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none" />
          </div>
          <button type="submit" disabled={saving}
            className="w-full bg-primary-500 text-white p-3 rounded-xl font-semibold hover:bg-primary-600 disabled:opacity-50 transition">
            {saving ? 'جاري الحفظ...' : 'إنشاء الطلب'}
          </button>
        </form>
      </Modal>

      <Modal open={!!showDetail} onClose={() => setShowDetail(null)} title={`تفاصيل الطلب ${showDetail?.order_number ?? ''}`}>
        {showDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-400">العميل:</span> <span className="font-medium">{showDetail.customer?.name}</span></div>
              <div><span className="text-gray-400">الكود:</span> <span className="font-medium">{showDetail.customer?.customer_code}</span></div>
              <div><span className="text-gray-400">القطع:</span> <span className="font-medium">{showDetail.items_count}</span></div>
              <div><span className="text-gray-400">المبلغ:</span> <span className="font-medium">{showDetail.total?.toFixed(2)} ج.م</span></div>
              <div><span className="text-gray-400">الدفع:</span> <span className="font-medium">{paymentLabel[showDetail.payment_method] ?? showDetail.payment_method}</span></div>
              <div><span className="text-gray-400">الحالة:</span> <Badge variant={statusVariant(showDetail.status)}>{ORDER_STATUS_LABELS[showDetail.status as keyof typeof ORDER_STATUS_LABELS]}</Badge></div>
              <div><span className="text-gray-400">السائق:</span> <span className="font-medium">{showDetail.driver?.name ?? 'غير معين'}</span></div>
              <div><span className="text-gray-400">التاريخ:</span> <span className="font-medium">{new Date(showDetail.created_at).toLocaleDateString('ar-EG')}</span></div>
            </div>
            {showDetail.notes && <div className="text-sm"><span className="text-gray-400">ملاحظات:</span> <p className="mt-1">{showDetail.notes}</p></div>}

            {showDetail.status === 'pending' && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">تعيين سائق</label>
                <select onChange={e => e.target.value && assignDriver(showDetail.id, e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20">
                  <option value="">اختر سائق</option>
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}

            <div className="flex gap-2">
              {nextStatus(showDetail.status) && (
                <button onClick={() => updateOrderStatus(showDetail.id, nextStatus(showDetail.status)!)}
                  className="flex-1 bg-primary-500 text-white p-2.5 rounded-xl text-sm font-medium hover:bg-primary-600 transition">
                  نقل إلى: {ORDER_STATUS_LABELS[nextStatus(showDetail.status) as keyof typeof ORDER_STATUS_LABELS]}
                </button>
              )}
              {!['delivered', 'cancelled', 'refunded'].includes(showDetail.status) && (
                <button onClick={() => updateOrderStatus(showDetail.id, 'cancelled')}
                  className="px-4 py-2.5 border border-red-300 text-red-500 rounded-xl text-sm font-medium hover:bg-red-50 transition">
                  إلغاء
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
