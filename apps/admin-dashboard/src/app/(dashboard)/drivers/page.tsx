'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import DataTable from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import StatCard from '@/components/ui/StatCard'
import { Search, Plus, Edit2, Power, Eye, Truck, CheckCircle, Clock, XCircle } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import Tooltip from '@/components/ui/Tooltip'
import PermissionGate from '@/components/ui/PermissionGate'

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
    const { data } = await supabase.from('users').select('id, name, phone, email, vehicle_type, vehicle_number, is_active, created_at').eq('role', 'driver').order('created_at', { ascending: false })
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
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xs font-bold shadow-premium">{item.name?.[0]}</div>
        <span className="font-medium">{item.name}</span>
      </div>
    )},
    { key: 'phone', label: 'الهاتف' },
    { key: 'email', label: 'البريد', render: (item: any) => item.email ?? <span className="text-gray-300">—</span> },
    { key: 'vehicle_type', label: 'المركبة', render: (item: any) => vehicleLabel[item.vehicle_type] ?? item.vehicle_type ?? '—' },
    { key: 'is_active', label: 'الحالة', render: (item: any) => <Badge variant={item.is_active ? 'success' : 'danger'}>{item.is_active ? 'متاح' : 'غير متاح'}</Badge> },
    { key: 'actions', label: '', render: (item: any) => (
      <div className="flex gap-1">
        <Tooltip content="عرض التفاصيل"><button onClick={() => setDetailItem(item)} className="p-1.5 hover:bg-surface-muted rounded-lg transition-colors"><Eye size={14} className="text-gray-400" /></button></Tooltip>
        <Tooltip content="تعديل"><button onClick={() => openEdit(item)} className="p-1.5 hover:bg-surface-muted rounded-lg transition-colors"><Edit2 size={14} className="text-gray-400" /></button></Tooltip>
        <Tooltip content={item.is_active ? 'تعطيل' : 'تفعيل'}><button onClick={() => toggleActive(item.id, item.is_active)} className="p-1.5 hover:bg-surface-muted rounded-lg transition-colors"><Power size={14} className={item.is_active ? 'text-red-400' : 'text-green-500'} /></button></Tooltip>
      </div>
    )},
  ]

  const inputClass = "w-full p-3 border border-surface-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-500/30 transition-all"

  const formFields = (
    <>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">الاسم <span className="text-red-400">*</span></label>
        <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className={inputClass} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">الهاتف <span className="text-red-400">*</span></label>
        <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required dir="ltr" className={inputClass} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">البريد الإلكتروني</label>
        <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} dir="ltr" className={inputClass} placeholder="اختياري" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">نوع المركبة</label>
        <select value={form.vehicle_type} onChange={e => setForm({ ...form, vehicle_type: e.target.value })} className={inputClass}>
          <option value="motorcycle">موتوسيكل</option><option value="car">سيارة</option><option value="van">فان</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">رقم المركبة</label>
        <input type="text" value={form.vehicle_number} onChange={e => setForm({ ...form, vehicle_number: e.target.value })} dir="ltr" className={inputClass} />
      </div>
    </>
  )

  return (
    <PermissionGate permission="drivers.view">
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Truck className="w-5 h-5 text-orange-500" /> إدارة السائقين</h2>
          <p className="text-sm text-gray-400 mt-0.5">{drivers.length} سائق</p>
        </div>
        <button onClick={() => { setForm({ name: '', phone: '', email: '', vehicle_type: 'motorcycle', vehicle_number: '' }); setShowAdd(true) }}
          className="flex items-center gap-2 bg-gradient-to-l from-primary-500 to-primary-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:shadow-glow-green transition-all duration-300">
          <Plus size={16} /> سائق جديد
        </button>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="إجمالي السائقين" value={drivers.length} icon={Truck} color="blue" index={0} />
        <StatCard label="متاح" value={activeDrivers} icon={CheckCircle} color="green" index={1} />
        <StatCard label="في مهمة" value={0} icon={Clock} color="orange" index={2} />
        <StatCard label="غير متاح" value={drivers.length - activeDrivers} icon={XCircle} color="red" index={3} />
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="relative max-w-md">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="بحث بالاسم أو الهاتف..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pr-10 pl-4 py-2.5 bg-white border border-surface-border/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-500/30 transition-all" />
      </motion.div>

      {loading ? <div className="flex items-center justify-center h-32"><div className="w-7 h-7 border-[3px] border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
        : <DataTable columns={columns} data={filtered} emptyMessage="لا يوجد سائقين" />}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="سائق جديد">
        <form onSubmit={handleAdd} className="space-y-4">
          {formFields}
          <button type="submit" disabled={saving} className="w-full bg-gradient-to-l from-primary-500 to-primary-600 text-white p-3 rounded-xl font-semibold hover:shadow-glow-green disabled:opacity-50 transition-all">
            {saving ? 'جاري الحفظ...' : 'إضافة السائق'}
          </button>
        </form>
      </Modal>

      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="تعديل السائق">
        <form onSubmit={handleEdit} className="space-y-4">
          {formFields}
          <button type="submit" disabled={saving} className="w-full bg-gradient-to-l from-primary-500 to-primary-600 text-white p-3 rounded-xl font-semibold hover:shadow-glow-green disabled:opacity-50 transition-all">
            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
        </form>
      </Modal>

      <Modal open={!!detailItem} onClose={() => setDetailItem(null)} title="تفاصيل السائق">
        {detailItem && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xl font-bold shadow-premium-md">{detailItem.name?.[0]}</div>
              <div><h4 className="text-lg font-bold text-gray-800">{detailItem.name}</h4><Badge variant={detailItem.is_active ? 'success' : 'danger'}>{detailItem.is_active ? 'متاح' : 'غير متاح'}</Badge></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'الهاتف', value: detailItem.phone ?? '—' },
                { label: 'البريد', value: detailItem.email ?? '—' },
                { label: 'المركبة', value: vehicleLabel[detailItem.vehicle_type] ?? '—' },
                { label: 'رقم المركبة', value: detailItem.vehicle_number ?? '—' },
              ].map((item, i) => (
                <div key={i} className="bg-surface-muted/50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 mb-0.5">{item.label}</p>
                  <p className="text-sm font-semibold text-gray-800">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
    </PermissionGate>
  )
}
