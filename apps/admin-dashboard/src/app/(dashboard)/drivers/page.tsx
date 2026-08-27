'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import DataTable from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import StatCard from '@/components/ui/StatCard'
import { Search, Plus, Edit2, Power, Eye, Truck, CheckCircle, Clock, XCircle } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

export default function DriversPage() {
  const [drivers, setDrivers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [detailItem, setDetailItem] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '', vehicle_type: 'motorcycle', vehicle_number: '' })
  const { toast } = useToast()

  useEffect(() => { loadDrivers() }, [])

  async function loadDrivers() {
    const { data } = await supabase.from('users').select('*').eq('role', 'driver').order('created_at', { ascending: false })
    setDrivers(data ?? [])
    setLoading(false)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, role: 'driver' }),
    })
    const result = await res.json()
    setSaving(false)
    if (result.success) { setShowAdd(false); setForm({ name: '', phone: '', email: '', vehicle_type: 'motorcycle', vehicle_number: '' }); loadDrivers(); toast('تم إضافة السائق بنجاح') }
    else { toast(result.error ?? 'حدث خطأ أثناء الإضافة', 'error') }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('users').update({ name: form.name, phone: form.phone, email: form.email, vehicle_type: form.vehicle_type, vehicle_number: form.vehicle_number }).eq('id', editItem.id)
    setSaving(false)
    setEditItem(null)
    loadDrivers()
    toast('تم تعديل بيانات السائق')
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('users').update({ is_active: !current }).eq('id', id)
    loadDrivers()
    toast(current ? 'تم تعطيل السائق' : 'تم تفعيل السائق')
  }

  function openEdit(item: any) {
    setForm({ name: item.name, phone: item.phone ?? '', email: item.email ?? '', vehicle_type: item.vehicle_type ?? 'motorcycle', vehicle_number: item.vehicle_number ?? '' })
    setEditItem(item)
  }

  const filtered = drivers.filter(d => !search || d.name?.includes(search) || d.phone?.includes(search))
  const activeDrivers = drivers.filter(d => d.is_active).length
  const vehicleLabel: Record<string, string> = { motorcycle: 'موتوسيكل', car: 'سيارة', van: 'فان' }

  const columns = [
    { key: 'name', label: 'السائق', render: (item: any) => (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xs font-bold">{item.name?.[0]}</div>
        <span className="font-medium">{item.name}</span>
      </div>
    )},
    { key: 'phone', label: 'الهاتف' },
    { key: 'email', label: 'البريد', render: (item: any) => item.email ?? <span className="text-gray-300">—</span> },
    { key: 'vehicle_type', label: 'المركبة', render: (item: any) => vehicleLabel[item.vehicle_type] ?? item.vehicle_type ?? '—' },
    { key: 'is_active', label: 'الحالة', render: (item: any) => <Badge variant={item.is_active ? 'success' : 'danger'}>{item.is_active ? 'متاح' : 'غير متاح'}</Badge> },
    { key: 'actions', label: '', render: (item: any) => (
      <div className="flex gap-1">
        <button onClick={() => setDetailItem(item)} className="p-1.5 hover:bg-gray-100 rounded-lg transition"><Eye size={14} className="text-gray-500" /></button>
        <button onClick={() => openEdit(item)} className="p-1.5 hover:bg-gray-100 rounded-lg transition"><Edit2 size={14} className="text-gray-500" /></button>
        <button onClick={() => toggleActive(item.id, item.is_active)} className="p-1.5 hover:bg-gray-100 rounded-lg transition"><Power size={14} className={item.is_active ? 'text-red-400' : 'text-green-500'} /></button>
      </div>
    )},
  ]

  const formFields = (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">الاسم</label>
        <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">الهاتف</label>
        <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} dir="ltr" className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">البريد الإلكتروني</label>
        <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} dir="ltr" className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">نوع المركبة</label>
        <select value={form.vehicle_type} onChange={e => setForm({ ...form, vehicle_type: e.target.value })} className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20">
          <option value="motorcycle">موتوسيكل</option><option value="car">سيارة</option><option value="van">فان</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">رقم المركبة</label>
        <input type="text" value={form.vehicle_number} onChange={e => setForm({ ...form, vehicle_number: e.target.value })} dir="ltr" className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
      </div>
    </>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-gray-800">إدارة السائقين</h2><p className="text-sm text-gray-400">{drivers.length} سائق</p></div>
        <button onClick={() => { setForm({ name: '', phone: '', email: '', vehicle_type: 'motorcycle', vehicle_number: '' }); setShowAdd(true) }}
          className="flex items-center gap-2 bg-primary-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-600 transition shadow-lg shadow-primary-500/25">
          <Plus size={16} /> سائق جديد
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="إجمالي السائقين" value={drivers.length} icon={Truck} color="blue" />
        <StatCard label="متاح" value={activeDrivers} icon={CheckCircle} color="green" />
        <StatCard label="في مهمة" value={0} icon={Clock} color="orange" />
        <StatCard label="غير متاح" value={drivers.length - activeDrivers} icon={XCircle} color="red" />
      </div>

      <div className="relative">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="بحث بالاسم أو الهاتف..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full max-w-md pr-10 pl-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition" />
      </div>

      {loading ? <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
        : <DataTable columns={columns} data={filtered} emptyMessage="لا يوجد سائقين" />}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="سائق جديد">
        <form onSubmit={handleAdd} className="space-y-4">
          {formFields}
          <button type="submit" disabled={saving} className="w-full bg-primary-500 text-white p-3 rounded-xl font-semibold hover:bg-primary-600 disabled:opacity-50 transition">
            {saving ? 'جاري الحفظ...' : 'إضافة السائق'}
          </button>
        </form>
      </Modal>

      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="تعديل السائق">
        <form onSubmit={handleEdit} className="space-y-4">
          {formFields}
          <button type="submit" disabled={saving} className="w-full bg-primary-500 text-white p-3 rounded-xl font-semibold hover:bg-primary-600 disabled:opacity-50 transition">
            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
        </form>
      </Modal>

      <Modal open={!!detailItem} onClose={() => setDetailItem(null)} title="تفاصيل السائق">
        {detailItem && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-2xl font-bold">{detailItem.name?.[0]}</div>
              <div><h4 className="text-lg font-bold">{detailItem.name}</h4><Badge variant={detailItem.is_active ? 'success' : 'danger'}>{detailItem.is_active ? 'متاح' : 'غير متاح'}</Badge></div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-400">الهاتف:</span> <span className="font-medium">{detailItem.phone ?? '—'}</span></div>
              <div><span className="text-gray-400">البريد:</span> <span className="font-medium">{detailItem.email ?? '—'}</span></div>
              <div><span className="text-gray-400">المركبة:</span> <span className="font-medium">{vehicleLabel[detailItem.vehicle_type] ?? '—'}</span></div>
              <div><span className="text-gray-400">رقم المركبة:</span> <span className="font-medium">{detailItem.vehicle_number ?? '—'}</span></div>
              <div><span className="text-gray-400">تاريخ الانضمام:</span> <span className="font-medium">{new Date(detailItem.created_at).toLocaleDateString('ar-EG')}</span></div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
