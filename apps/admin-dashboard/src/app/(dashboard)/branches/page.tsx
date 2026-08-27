'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import DataTable from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { MapPin, Plus, Edit2, Power } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

export default function BranchesPage() {
  const [branches, setBranches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', address: '', phone: '' })
  const { toast } = useToast()

  useEffect(() => { loadBranches() }, [])

  async function loadBranches() {
    const { data } = await supabase.from('branches').select('*').order('created_at', { ascending: false })
    setBranches(data ?? [])
    setLoading(false)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('branches').insert({ ...form, is_active: true })
    setSaving(false)
    if (!error) { setShowAdd(false); setForm({ name: '', address: '', phone: '' }); loadBranches(); toast('تم إضافة الفرع بنجاح') }
    else { toast('حدث خطأ أثناء الإضافة', 'error') }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('branches').update({ name: form.name, address: form.address, phone: form.phone }).eq('id', editItem.id)
    setSaving(false)
    if (!error) { setEditItem(null); loadBranches(); toast('تم تعديل الفرع') }
    else { toast('حدث خطأ أثناء التعديل', 'error') }
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('branches').update({ is_active: !current }).eq('id', id)
    loadBranches()
    toast(current ? 'تم تعطيل الفرع' : 'تم تفعيل الفرع')
  }

  function openEdit(item: any) {
    setForm({ name: item.name, address: item.address ?? '', phone: item.phone ?? '' })
    setEditItem(item)
  }

  const columns = [
    { key: 'name', label: 'اسم الفرع', render: (item: any) => <span className="font-semibold">{item.name}</span> },
    { key: 'address', label: 'العنوان', render: (item: any) => item.address ?? '—' },
    { key: 'phone', label: 'الهاتف', render: (item: any) => <span dir="ltr">{item.phone ?? '—'}</span> },
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
        <label className="block text-sm font-medium text-gray-600 mb-1">اسم الفرع</label>
        <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
          className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">العنوان</label>
        <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
          className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">الهاتف</label>
        <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} dir="ltr"
          className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
      </div>
    </>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><MapPin className="w-5 h-5" /> إدارة الفروع</h2>
          <p className="text-sm text-gray-400">{branches.length} فرع</p>
        </div>
        <button onClick={() => { setForm({ name: '', address: '', phone: '' }); setShowAdd(true) }}
          className="flex items-center gap-2 bg-primary-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-600 transition shadow-lg shadow-primary-500/25">
          <Plus size={16} /> فرع جديد
        </button>
      </div>

      {loading ? <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
        : <DataTable columns={columns} data={branches} emptyMessage="لا توجد فروع" />}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="فرع جديد">
        <form onSubmit={handleAdd} className="space-y-4">
          {formFields}
          <button type="submit" disabled={saving} className="w-full bg-primary-500 text-white p-3 rounded-xl font-semibold hover:bg-primary-600 disabled:opacity-50 transition">
            {saving ? 'جاري الحفظ...' : 'إضافة الفرع'}
          </button>
        </form>
      </Modal>

      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="تعديل الفرع">
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
