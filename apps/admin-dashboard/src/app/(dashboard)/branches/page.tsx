'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import DataTable from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { MapPin, Plus, Edit2, Power } from 'lucide-react'
import { motion } from 'framer-motion'
import { useToast } from '@/components/ui/Toast'
import Tooltip from '@/components/ui/Tooltip'
import PermissionGate from '@/components/ui/PermissionGate'
import { useAuth } from '@/lib/auth-context'

export default function BranchesPage() {
  const [branches, setBranches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', address: '', phone: '' })
  const { toast } = useToast()
  const { hasPermission } = useAuth()

  useEffect(() => { loadBranches() }, [])

  async function loadBranches() {
    const { data } = await supabase.from('branches').select('id, name, address, phone, is_active, created_at').order('created_at', { ascending: false })
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
        {hasPermission('branches.edit') && <Tooltip content="تعديل"><button onClick={() => openEdit(item)} className="p-1.5 hover:bg-surface-muted rounded-lg transition-colors"><Edit2 size={14} className="text-gray-500" /></button></Tooltip>}
        {hasPermission('branches.edit') && <Tooltip content={item.is_active ? 'تعطيل' : 'تفعيل'}><button onClick={() => toggleActive(item.id, item.is_active)} className="p-1.5 hover:bg-surface-muted rounded-lg transition-colors"><Power size={14} className={item.is_active ? 'text-red-400' : 'text-green-500'} /></button></Tooltip>}
      </div>
    )},
  ]

  const formFields = (
    <>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">اسم الفرع <span className="text-red-400">*</span></label>
        <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
          className="w-full p-3 border border-surface-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-500/30 transition-all" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">العنوان <span className="text-red-400">*</span></label>
        <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} required
          className="w-full p-3 border border-surface-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-500/30 transition-all" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">الهاتف</label>
        <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} dir="ltr"
          className="w-full p-3 border border-surface-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-500/30 transition-all" />
      </div>
    </>
  )

  return (
    <PermissionGate permission="branches.view">
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><MapPin className="w-5 h-5 text-blue-500" /> إدارة الفروع</h2>
          <p className="text-sm text-gray-400 mt-0.5">{branches.length} فرع</p>
        </div>
        {hasPermission('branches.create') && (
          <button onClick={() => { setForm({ name: '', address: '', phone: '' }); setShowAdd(true) }}
            className="flex items-center gap-2 bg-gradient-to-l from-primary-500 to-primary-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:shadow-glow-green transition-all duration-300">
            <Plus size={16} /> فرع جديد
          </button>
        )}
      </motion.div>

      {loading ? <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
        : <DataTable columns={columns} data={branches} emptyMessage="لا توجد فروع" />}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="فرع جديد">
        <form onSubmit={handleAdd} className="space-y-4">
          {formFields}
          <button type="submit" disabled={saving} className="w-full bg-gradient-to-l from-primary-500 to-primary-600 text-white p-3 rounded-xl font-semibold hover:shadow-glow-green disabled:opacity-50 transition-all">
            {saving ? 'جاري الحفظ...' : 'إضافة الفرع'}
          </button>
        </form>
      </Modal>

      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="تعديل الفرع">
        <form onSubmit={handleEdit} className="space-y-4">
          {formFields}
          <button type="submit" disabled={saving} className="w-full bg-gradient-to-l from-primary-500 to-primary-600 text-white p-3 rounded-xl font-semibold hover:shadow-glow-green disabled:opacity-50 transition-all">
            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
        </form>
      </Modal>
    </div>
    </PermissionGate>
  )
}
