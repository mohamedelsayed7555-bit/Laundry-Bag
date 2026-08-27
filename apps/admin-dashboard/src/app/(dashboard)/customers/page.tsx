'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import DataTable from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { Search, Plus, Edit2, Power } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '', tier: 'bronze' })
  const { toast } = useToast()

  useEffect(() => { loadCustomers() }, [])

  async function loadCustomers() {
    const { data } = await supabase.from('users').select('*').eq('role', 'customer').order('created_at', { ascending: false })
    setCustomers(data ?? [])
    setLoading(false)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, role: 'customer' }),
    })
    const result = await res.json()
    setSaving(false)
    if (result.success) { setShowAdd(false); setForm({ name: '', phone: '', email: '', tier: 'bronze' }); loadCustomers(); toast('تم إضافة العميل بنجاح') }
    else { toast(result.error ?? 'حدث خطأ أثناء الإضافة', 'error') }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('users').update({ name: form.name, phone: form.phone, email: form.email, tier: form.tier }).eq('id', editItem.id)
    setSaving(false)
    if (!error) { setEditItem(null); loadCustomers(); toast('تم تعديل بيانات العميل') }
    else { toast('حدث خطأ أثناء التعديل', 'error') }
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('users').update({ is_active: !current }).eq('id', id)
    loadCustomers()
    toast(current ? 'تم تعطيل العميل' : 'تم تفعيل العميل')
  }

  function openEdit(item: any) {
    setForm({ name: item.name, phone: item.phone ?? '', email: item.email ?? '', tier: item.tier ?? 'bronze' })
    setEditItem(item)
  }

  const filtered = customers.filter(c => {
    if (!search) return true
    return c.name?.includes(search) || c.phone?.includes(search) || c.customer_code?.includes(search)
  })

  const tierVariant = (tier: string) => {
    const map: Record<string, 'success' | 'warning' | 'info' | 'purple'> = { bronze: 'warning', silver: 'info', gold: 'success', platinum: 'purple' }
    return map[tier] ?? 'info'
  }
  const tierLabel: Record<string, string> = { bronze: 'برونزي', silver: 'فضي', gold: 'ذهبي', platinum: 'بلاتيني' }

  const columns = [
    { key: 'customer_code', label: 'الكود', render: (item: any) => <span className="font-bold text-primary-600">{item.customer_code}</span> },
    { key: 'name', label: 'الاسم', render: (item: any) => (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-navy-400 to-navy-600 flex items-center justify-center text-white text-xs font-bold">{item.name?.[0]}</div>
        <span className="font-medium">{item.name}</span>
      </div>
    )},
    { key: 'phone', label: 'الهاتف' },
    { key: 'email', label: 'البريد', render: (item: any) => item.email ?? <span className="text-gray-300">—</span> },
    { key: 'tier', label: 'المستوى', render: (item: any) => <Badge variant={tierVariant(item.tier)}>{tierLabel[item.tier] ?? item.tier}</Badge> },
    { key: 'points', label: 'النقاط', render: (item: any) => <span className="font-semibold">{item.points}</span> },
    { key: 'is_active', label: 'الحالة', render: (item: any) => <Badge variant={item.is_active ? 'success' : 'danger'}>{item.is_active ? 'نشط' : 'معطل'}</Badge> },
    { key: 'actions', label: '', render: (item: any) => (
      <div className="flex gap-1">
        <button onClick={() => openEdit(item)} className="p-1.5 hover:bg-gray-100 rounded-lg transition"><Edit2 size={14} className="text-gray-500" /></button>
        <button onClick={() => toggleActive(item.id, item.is_active)} className="p-1.5 hover:bg-gray-100 rounded-lg transition"><Power size={14} className={item.is_active ? 'text-red-400' : 'text-green-500'} /></button>
      </div>
    )},
  ]

  const formFields = (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">الاسم</label>
        <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
          className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">الهاتف</label>
        <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} dir="ltr"
          className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">البريد الإلكتروني</label>
        <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} dir="ltr"
          className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">المستوى</label>
        <select value={form.tier} onChange={e => setForm({ ...form, tier: e.target.value })}
          className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20">
          <option value="bronze">برونزي</option><option value="silver">فضي</option>
          <option value="gold">ذهبي</option><option value="platinum">بلاتيني</option>
        </select>
      </div>
    </>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-gray-800">إدارة العملاء</h2><p className="text-sm text-gray-400">{customers.length} عميل</p></div>
        <button onClick={() => { setForm({ name: '', phone: '', email: '', tier: 'bronze' }); setShowAdd(true) }}
          className="flex items-center gap-2 bg-primary-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-600 transition shadow-lg shadow-primary-500/25">
          <Plus size={16} /> عميل جديد
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="بحث بالاسم أو الكود أو الهاتف..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full max-w-md pr-10 pl-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition" />
      </div>

      {loading ? <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
        : <DataTable columns={columns} data={filtered} emptyMessage="لا يوجد عملاء مسجلين" />}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="عميل جديد">
        <form onSubmit={handleAdd} className="space-y-4">
          {formFields}
          <button type="submit" disabled={saving} className="w-full bg-primary-500 text-white p-3 rounded-xl font-semibold hover:bg-primary-600 disabled:opacity-50 transition">
            {saving ? 'جاري الحفظ...' : 'إضافة العميل'}
          </button>
        </form>
      </Modal>

      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="تعديل العميل">
        <form onSubmit={handleEdit} className="space-y-4">
          {formFields}
          <button type="submit" disabled={saving} className="w-full bg-primary-500 text-white p-3 rounded-xl font-semibold hover:bg-primary-600 disabled:opacity-50 transition">
            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
        </form>
      </Modal>
    </div>
  )
}
