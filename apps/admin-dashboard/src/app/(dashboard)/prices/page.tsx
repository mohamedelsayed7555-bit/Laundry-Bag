'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import DataTable from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { SERVICE_TYPE_LABELS } from '@cleano/shared-types'
import type { ServiceType } from '@cleano/shared-types'
import { Plus, Edit2, Power, Tag } from 'lucide-react'
import { motion } from 'framer-motion'
import { useToast } from '@/components/ui/Toast'

const serviceVariant: Record<string, 'success' | 'info' | 'purple' | 'warning'> = {
  wash: 'info', iron: 'warning', wash_iron: 'purple', dry_clean: 'success',
}

export default function PricesPage() {
  const [prices, setPrices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ item_type: '', service_type: 'wash', price: 0 })
  const { toast } = useToast()

  useEffect(() => { loadPrices() }, [])

  async function loadPrices() {
    const { data } = await supabase.from('prices').select('*').order('item_type')
    setPrices(data ?? [])
    setLoading(false)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('prices').insert({ ...form, is_active: true })
    setSaving(false)
    if (!error) { setShowAdd(false); setForm({ item_type: '', service_type: 'wash', price: 0 }); loadPrices(); toast('تم إضافة السعر بنجاح') }
    else { toast('حدث خطأ أثناء الإضافة', 'error') }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('prices').update({ item_type: form.item_type, service_type: form.service_type, price: form.price }).eq('id', editItem.id)
    setSaving(false)
    if (!error) { setEditItem(null); loadPrices(); toast('تم تعديل السعر') }
    else { toast('حدث خطأ أثناء التعديل', 'error') }
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('prices').update({ is_active: !current }).eq('id', id)
    loadPrices()
    toast(current ? 'تم تعطيل السعر' : 'تم تفعيل السعر')
  }

  function openEdit(item: any) {
    setForm({ item_type: item.item_type, service_type: item.service_type, price: item.price })
    setEditItem(item)
  }

  const columns = [
    { key: 'item_type', label: 'نوع القطعة', render: (item: any) => <span className="font-semibold">{item.item_type}</span> },
    { key: 'service_type', label: 'الخدمة', render: (item: any) => (
      <Badge variant={serviceVariant[item.service_type] ?? 'info'}>{SERVICE_TYPE_LABELS[item.service_type as ServiceType] ?? item.service_type}</Badge>
    )},
    { key: 'price', label: 'السعر', render: (item: any) => <span className="font-bold text-primary-600">{item.price} ج.م</span> },
    { key: 'is_active', label: 'الحالة', render: (item: any) => <Badge variant={item.is_active ? 'success' : 'danger'}>{item.is_active ? 'نشط' : 'معطل'}</Badge> },
    { key: 'actions', label: '', render: (item: any) => (
      <div className="flex gap-1">
        <button onClick={() => openEdit(item)} className="p-1.5 hover:bg-surface-muted rounded-lg transition-colors"><Edit2 size={14} className="text-gray-400" /></button>
        <button onClick={() => toggleActive(item.id, item.is_active)} className="p-1.5 hover:bg-surface-muted rounded-lg transition-colors"><Power size={14} className={item.is_active ? 'text-red-400' : 'text-green-500'} /></button>
      </div>
    )},
  ]

  const formFields = (
    <>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">نوع القطعة</label>
        <input type="text" value={form.item_type} onChange={e => setForm({ ...form, item_type: e.target.value })} required
          placeholder="مثال: قميص، بنطلون، بدلة..." className="w-full p-3 border border-surface-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-500/30 transition-all" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">نوع الخدمة</label>
        <select value={form.service_type} onChange={e => setForm({ ...form, service_type: e.target.value })}
          className="w-full p-3 border border-surface-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-500/30 transition-all">
          <option value="wash">غسيل</option><option value="iron">كوي</option>
          <option value="wash_iron">غسيل وكوي</option><option value="dry_clean">تنظيف جاف</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">السعر (ج.م)</label>
        <input type="number" min={0} step={0.5} value={form.price} onChange={e => setForm({ ...form, price: +e.target.value })} required
          className="w-full p-3 border border-surface-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-500/30 transition-all" dir="ltr" />
      </div>
    </>
  )

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Tag className="w-5 h-5 text-accent-purple" /> إدارة الأسعار</h2>
          <p className="text-sm text-gray-400 mt-0.5">{prices.length} سعر</p>
        </div>
        <button onClick={() => { setForm({ item_type: '', service_type: 'wash', price: 0 }); setShowAdd(true) }}
          className="flex items-center gap-2 bg-gradient-to-l from-primary-500 to-primary-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:shadow-glow-green transition-all duration-300">
          <Plus size={16} /> سعر جديد
        </button>
      </motion.div>

      {loading ? <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
        : <DataTable columns={columns} data={prices} emptyMessage="لا توجد أسعار" />}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="سعر جديد">
        <form onSubmit={handleAdd} className="space-y-4">
          {formFields}
          <button type="submit" disabled={saving} className="w-full bg-gradient-to-l from-primary-500 to-primary-600 text-white p-3 rounded-xl font-semibold hover:shadow-glow-green disabled:opacity-50 transition-all">
            {saving ? 'جاري الحفظ...' : 'إضافة السعر'}
          </button>
        </form>
      </Modal>

      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="تعديل السعر">
        <form onSubmit={handleEdit} className="space-y-4">
          {formFields}
          <button type="submit" disabled={saving} className="w-full bg-gradient-to-l from-primary-500 to-primary-600 text-white p-3 rounded-xl font-semibold hover:shadow-glow-green disabled:opacity-50 transition-all">
            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
        </form>
      </Modal>
    </div>
  )
}
