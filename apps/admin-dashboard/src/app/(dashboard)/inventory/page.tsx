'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import DataTable from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { Package, Plus, Edit2, AlertTriangle } from 'lucide-react'
import StatCard from '@/components/ui/StatCard'
import { useToast } from '@/components/ui/Toast'

export default function InventoryPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', category: 'detergent', quantity: 0, unit: 'لتر', min_quantity: 5 })
  const { toast } = useToast()

  useEffect(() => { loadItems() }, [])

  async function loadItems() {
    const { data } = await supabase.from('inventory').select('*').order('name')
    setItems(data ?? [])
    setLoading(false)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('inventory').insert(form)
    setSaving(false)
    if (!error) { setShowAdd(false); setForm({ name: '', category: 'detergent', quantity: 0, unit: 'لتر', min_quantity: 5 }); loadItems(); toast('تم إضافة الصنف بنجاح') }
    else { toast('حدث خطأ أثناء الإضافة', 'error') }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('inventory').update(form).eq('id', editItem.id)
    setSaving(false)
    if (!error) { setEditItem(null); loadItems(); toast('تم تعديل الصنف') }
    else { toast('حدث خطأ أثناء التعديل', 'error') }
  }

  function openEdit(item: any) {
    setForm({ name: item.name, category: item.category, quantity: item.quantity, unit: item.unit, min_quantity: item.min_quantity })
    setEditItem(item)
  }

  const lowStock = items.filter(i => i.quantity <= i.min_quantity)
  const categoryLabel: Record<string, string> = { detergent: 'منظفات', packaging: 'تغليف', equipment: 'معدات', chemicals: 'كيماويات', other: 'أخرى' }

  const columns = [
    { key: 'name', label: 'الصنف', render: (item: any) => <span className="font-semibold">{item.name}</span> },
    { key: 'category', label: 'التصنيف', render: (item: any) => <Badge variant="info">{categoryLabel[item.category] ?? item.category}</Badge> },
    { key: 'quantity', label: 'الكمية', render: (item: any) => (
      <span className={`font-bold ${item.quantity <= item.min_quantity ? 'text-red-500' : 'text-green-600'}`}>
        {item.quantity} {item.unit}
      </span>
    )},
    { key: 'min_quantity', label: 'الحد الأدنى', render: (item: any) => <span className="text-gray-500">{item.min_quantity} {item.unit}</span> },
    { key: 'status', label: 'الحالة', render: (item: any) => (
      item.quantity <= item.min_quantity
        ? <Badge variant="danger">نفاد قريب</Badge>
        : <Badge variant="success">متوفر</Badge>
    )},
    { key: 'actions', label: '', render: (item: any) => (
      <button onClick={() => openEdit(item)} className="p-1.5 hover:bg-gray-100 rounded-lg transition"><Edit2 size={14} className="text-gray-500" /></button>
    )},
  ]

  const formFields = (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">اسم الصنف</label>
        <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
          className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">التصنيف</label>
        <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
          className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20">
          <option value="detergent">منظفات</option><option value="packaging">تغليف</option>
          <option value="equipment">معدات</option><option value="chemicals">كيماويات</option><option value="other">أخرى</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">الكمية</label>
          <input type="number" min={0} value={form.quantity} onChange={e => setForm({ ...form, quantity: +e.target.value })}
            className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">الوحدة</label>
          <input type="text" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}
            className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">الحد الأدنى (للتنبيه)</label>
        <input type="number" min={0} value={form.min_quantity} onChange={e => setForm({ ...form, min_quantity: +e.target.value })}
          className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
      </div>
    </>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Package className="w-5 h-5" /> المخزون</h2>
          <p className="text-sm text-gray-400">إدارة المواد والمستلزمات</p>
        </div>
        <button onClick={() => { setForm({ name: '', category: 'detergent', quantity: 0, unit: 'لتر', min_quantity: 5 }); setShowAdd(true) }}
          className="flex items-center gap-2 bg-primary-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-600 transition shadow-lg shadow-primary-500/25">
          <Plus size={16} /> صنف جديد
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="إجمالي الأصناف" value={items.length} icon={Package} color="blue" />
        <StatCard label="نفاد قريب" value={lowStock.length} icon={AlertTriangle} color="red" />
        <StatCard label="متوفر" value={items.length - lowStock.length} icon={Package} color="green" />
      </div>

      {loading ? <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
        : <DataTable columns={columns} data={items} emptyMessage="لا توجد أصناف في المخزون" />}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="صنف جديد">
        <form onSubmit={handleAdd} className="space-y-4">
          {formFields}
          <button type="submit" disabled={saving} className="w-full bg-primary-500 text-white p-3 rounded-xl font-semibold hover:bg-primary-600 disabled:opacity-50 transition">
            {saving ? 'جاري الحفظ...' : 'إضافة الصنف'}
          </button>
        </form>
      </Modal>

      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="تعديل الصنف">
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
