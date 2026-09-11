'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import DataTable from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { SERVICE_TYPE_LABELS } from '@cleano/shared-types'
import type { ServiceType } from '@cleano/shared-types'
import { Plus, Edit2, Power, Tag, Layers, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { useToast } from '@/components/ui/Toast'
import Tooltip from '@/components/ui/Tooltip'
import PermissionGate from '@/components/ui/PermissionGate'
import { useAuth } from '@/lib/auth-context'

const serviceVariant: Record<string, 'success' | 'info' | 'purple' | 'warning'> = {
  wash: 'info', iron: 'warning', wash_iron: 'purple', dry_clean: 'success', tailor: 'purple',
}

export default function PricesPage() {
  const [tab, setTab] = useState<'prices' | 'categories'>('prices')
  const [prices, setPrices] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ item_type: '', service_type: 'wash', price: 0, category_id: '' })
  const [catForm, setCatForm] = useState({ name: '', icon: '👕', sort_order: 0 })
  const [showAddCat, setShowAddCat] = useState(false)
  const [editCat, setEditCat] = useState<any>(null)
  const { toast } = useToast()
  const { hasPermission } = useAuth()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from('prices').select('id, item_type, service_type, price, is_active, category_id, categories(name)').order('item_type'),
      supabase.from('categories').select('*').order('sort_order'),
    ])
    setPrices(p ?? [])
    setCategories(c ?? [])
    setLoading(false)
  }

  // --- Prices CRUD ---
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('prices').insert({ item_type: form.item_type, service_type: form.service_type, price: form.price, category_id: form.category_id || null, is_active: true })
    setSaving(false)
    if (!error) { setShowAdd(false); setForm({ item_type: '', service_type: 'wash', price: 0, category_id: '' }); loadData(); toast('تم إضافة السعر بنجاح') }
    else { toast('حدث خطأ أثناء الإضافة', 'error') }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('prices').update({ item_type: form.item_type, service_type: form.service_type, price: form.price, category_id: form.category_id || null }).eq('id', editItem.id)
    setSaving(false)
    if (!error) { setEditItem(null); loadData(); toast('تم تعديل السعر') }
    else { toast('حدث خطأ أثناء التعديل', 'error') }
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('prices').update({ is_active: !current }).eq('id', id)
    loadData()
    toast(current ? 'تم تعطيل السعر' : 'تم تفعيل السعر')
  }

  function openEdit(item: any) {
    setForm({ item_type: item.item_type, service_type: item.service_type, price: item.price, category_id: item.category_id || '' })
    setEditItem(item)
  }

  // --- Categories CRUD ---
  async function handleAddCat(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('categories').insert({ ...catForm, is_active: true })
    setSaving(false)
    if (!error) { setShowAddCat(false); setCatForm({ name: '', icon: '👕', sort_order: 0 }); loadData(); toast('تم إضافة التصنيف') }
    else { toast(error.message, 'error') }
  }

  async function handleEditCat(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('categories').update(catForm).eq('id', editCat.id)
    setSaving(false)
    if (!error) { setEditCat(null); loadData(); toast('تم تعديل التصنيف') }
    else { toast(error.message, 'error') }
  }

  async function toggleCatActive(id: string, current: boolean) {
    await supabase.from('categories').update({ is_active: !current }).eq('id', id)
    loadData()
    toast(current ? 'تم تعطيل التصنيف' : 'تم تفعيل التصنيف')
  }

  // --- Columns ---
  const priceColumns = [
    { key: 'item_type', label: 'نوع القطعة', render: (item: any) => <span className="font-semibold">{item.item_type}</span> },
    { key: 'category', label: 'التصنيف', render: (item: any) => (
      <span className="text-xs text-gray-400">{item.categories?.name ?? '—'}</span>
    )},
    { key: 'service_type', label: 'الخدمة', render: (item: any) => (
      <Badge variant={serviceVariant[item.service_type] ?? 'info'}>{SERVICE_TYPE_LABELS[item.service_type as ServiceType] ?? item.service_type}</Badge>
    )},
    { key: 'price', label: 'السعر', render: (item: any) => <span className="font-bold text-primary-600">{item.price} ج.م</span> },
    { key: 'is_active', label: 'الحالة', render: (item: any) => <Badge variant={item.is_active ? 'success' : 'danger'}>{item.is_active ? 'نشط' : 'معطل'}</Badge> },
    { key: 'actions', label: '', render: (item: any) => (
      <div className="flex gap-1">
        {hasPermission('prices.edit') && <Tooltip content="تعديل"><button onClick={() => openEdit(item)} className="p-1.5 hover:bg-surface-muted rounded-lg transition-colors"><Edit2 size={14} className="text-gray-400" /></button></Tooltip>}
        {hasPermission('prices.edit') && <Tooltip content={item.is_active ? 'تعطيل' : 'تفعيل'}><button onClick={() => toggleActive(item.id, item.is_active)} className="p-1.5 hover:bg-surface-muted rounded-lg transition-colors"><Power size={14} className={item.is_active ? 'text-red-400' : 'text-green-500'} /></button></Tooltip>}
      </div>
    )},
  ]

  const catColumns = [
    { key: 'icon', label: '', render: (item: any) => <span className="text-xl">{item.icon}</span> },
    { key: 'name', label: 'الاسم', render: (item: any) => <span className="font-semibold">{item.name}</span> },
    { key: 'sort_order', label: 'الترتيب', render: (item: any) => <span className="text-gray-400">{item.sort_order}</span> },
    { key: 'count', label: 'عدد القطع', render: (item: any) => <span className="text-gray-400">{prices.filter(p => p.category_id === item.id).length}</span> },
    { key: 'is_active', label: 'الحالة', render: (item: any) => <Badge variant={item.is_active ? 'success' : 'danger'}>{item.is_active ? 'نشط' : 'معطل'}</Badge> },
    { key: 'actions', label: '', render: (item: any) => (
      <div className="flex gap-1">
        {hasPermission('prices.edit') && <Tooltip content="تعديل"><button onClick={() => { setCatForm({ name: item.name, icon: item.icon, sort_order: item.sort_order }); setEditCat(item) }} className="p-1.5 hover:bg-surface-muted rounded-lg transition-colors"><Edit2 size={14} className="text-gray-400" /></button></Tooltip>}
        {hasPermission('prices.edit') && <Tooltip content={item.is_active ? 'تعطيل' : 'تفعيل'}><button onClick={() => toggleCatActive(item.id, item.is_active)} className="p-1.5 hover:bg-surface-muted rounded-lg transition-colors"><Power size={14} className={item.is_active ? 'text-red-400' : 'text-green-500'} /></button></Tooltip>}
      </div>
    )},
  ]

  const priceFormFields = (
    <>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">نوع القطعة <span className="text-red-400">*</span></label>
        <input type="text" value={form.item_type} onChange={e => setForm({ ...form, item_type: e.target.value })} required
          placeholder="مثال: قميص، بنطلون، بدلة..." className="w-full p-3 border border-surface-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-500/30 transition-all" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">التصنيف <span className="text-red-400">*</span></label>
        <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })} required
          className="w-full p-3 border border-surface-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-500/30 transition-all">
          <option value="">اختر التصنيف</option>
          {categories.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">نوع الخدمة <span className="text-red-400">*</span></label>
        <select value={form.service_type} onChange={e => setForm({ ...form, service_type: e.target.value })} required
          className="w-full p-3 border border-surface-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-500/30 transition-all">
          <option value="wash">غسيل</option><option value="iron">كوي</option>
          <option value="wash_iron">غسيل وكوي</option><option value="dry_clean">تنظيف جاف</option>
          <option value="tailor">تفصيل وتعديلات</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">السعر (ج.م) <span className="text-red-400">*</span></label>
        <input type="number" min={0} step={0.5} value={form.price} onChange={e => setForm({ ...form, price: +e.target.value })} required
          className="w-full p-3 border border-surface-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-500/30 transition-all" dir="ltr" />
      </div>
    </>
  )

  const catFormFields = (
    <>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">اسم التصنيف <span className="text-red-400">*</span></label>
        <input type="text" value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} required
          placeholder="مثال: ملابس عادية" className="w-full p-3 border border-surface-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-500/30 transition-all" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">الأيقونة</label>
        <input type="text" value={catForm.icon} onChange={e => setCatForm({ ...catForm, icon: e.target.value })}
          className="w-full p-3 border border-surface-border rounded-xl text-sm text-center text-2xl focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-500/30 transition-all" dir="ltr" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">الترتيب</label>
        <input type="number" min={0} value={catForm.sort_order} onChange={e => setCatForm({ ...catForm, sort_order: +e.target.value })}
          className="w-full p-3 border border-surface-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-500/30 transition-all" dir="ltr" />
      </div>
    </>
  )

  return (
    <PermissionGate permission="prices.view">
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Tag className="w-5 h-5 text-accent-purple" /> الأسعار والتصنيفات</h2>
          <p className="text-sm text-gray-400 mt-0.5">{prices.length} سعر · {categories.length} تصنيف</p>
        </div>
        {hasPermission('prices.create') && (
          <button onClick={() => tab === 'prices' ? (setForm({ item_type: '', service_type: 'wash', price: 0, category_id: '' }), setShowAdd(true)) : (setCatForm({ name: '', icon: '👕', sort_order: 0 }), setShowAddCat(true))}
            className="flex items-center gap-2 bg-gradient-to-l from-primary-500 to-primary-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:shadow-glow-green transition-all duration-300">
            <Plus size={16} /> {tab === 'prices' ? 'سعر جديد' : 'تصنيف جديد'}
          </button>
        )}
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-surface-border pb-0">
        <button onClick={() => setTab('prices')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${tab === 'prices' ? 'bg-primary-50 text-primary-600 border-b-2 border-primary-500' : 'text-gray-400 hover:text-gray-600'}`}>
          <Tag size={14} className="inline mr-1" /> الأسعار
        </button>
        <button onClick={() => setTab('categories')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${tab === 'categories' ? 'bg-primary-50 text-primary-600 border-b-2 border-primary-500' : 'text-gray-400 hover:text-gray-600'}`}>
          <Layers size={14} className="inline mr-1" /> التصنيفات
        </button>
      </div>

      {loading ? <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
        : tab === 'prices'
          ? <DataTable columns={priceColumns} data={prices} emptyMessage="لا توجد أسعار" />
          : <DataTable columns={catColumns} data={categories} emptyMessage="لا توجد تصنيفات" />
      }

      {/* Price Modals */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="سعر جديد">
        <form onSubmit={handleAdd} className="space-y-4">
          {priceFormFields}
          <button type="submit" disabled={saving} className="w-full bg-gradient-to-l from-primary-500 to-primary-600 text-white p-3 rounded-xl font-semibold hover:shadow-glow-green disabled:opacity-50 transition-all">
            {saving ? 'جاري الحفظ...' : 'إضافة السعر'}
          </button>
        </form>
      </Modal>

      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="تعديل السعر">
        <form onSubmit={handleEdit} className="space-y-4">
          {priceFormFields}
          <button type="submit" disabled={saving} className="w-full bg-gradient-to-l from-primary-500 to-primary-600 text-white p-3 rounded-xl font-semibold hover:shadow-glow-green disabled:opacity-50 transition-all">
            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
        </form>
      </Modal>

      {/* Category Modals */}
      <Modal open={showAddCat} onClose={() => setShowAddCat(false)} title="تصنيف جديد">
        <form onSubmit={handleAddCat} className="space-y-4">
          {catFormFields}
          <button type="submit" disabled={saving} className="w-full bg-gradient-to-l from-primary-500 to-primary-600 text-white p-3 rounded-xl font-semibold hover:shadow-glow-green disabled:opacity-50 transition-all">
            {saving ? 'جاري الحفظ...' : 'إضافة التصنيف'}
          </button>
        </form>
      </Modal>

      <Modal open={!!editCat} onClose={() => setEditCat(null)} title="تعديل التصنيف">
        <form onSubmit={handleEditCat} className="space-y-4">
          {catFormFields}
          <button type="submit" disabled={saving} className="w-full bg-gradient-to-l from-primary-500 to-primary-600 text-white p-3 rounded-xl font-semibold hover:shadow-glow-green disabled:opacity-50 transition-all">
            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
        </form>
      </Modal>
    </div>
    </PermissionGate>
  )
}
