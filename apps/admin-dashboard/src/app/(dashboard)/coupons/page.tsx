'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import DataTable from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { SERVICE_TYPE_LABELS } from '@cleano/shared-types'
import type { ServiceType } from '@cleano/shared-types'
import { Plus, Edit2, Power, Trash2, Copy } from 'lucide-react'
import { motion } from 'framer-motion'
import { useToast } from '@/components/ui/Toast'
import PermissionGate from '@/components/ui/PermissionGate'
import { useAuth } from '@/lib/auth-context'

const allServices = Object.keys(SERVICE_TYPE_LABELS) as ServiceType[]

interface CouponForm {
  code: string
  type: 'percentage' | 'fixed'
  value: number
  max_discount: number | null
  min_order_amount: number
  max_uses: number | null
  per_user_limit: number
  services: string[] | null
  expires_at: string
}

const emptyForm: CouponForm = {
  code: '', type: 'percentage', value: 10, max_discount: null,
  min_order_amount: 0, max_uses: null, per_user_limit: 1,
  services: null, expires_at: '',
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<CouponForm>({ ...emptyForm })
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null)
  const { toast } = useToast()
  const { hasPermission } = useAuth()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false })
    setCoupons(data ?? [])
    setLoading(false)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.code.trim()) { toast('أدخل كود الكوبون', 'error'); return }
    setSaving(true)
    const payload: any = {
      code: form.code.trim().toUpperCase(),
      type: form.type,
      value: form.value,
      max_discount: form.type === 'percentage' && form.max_discount ? form.max_discount : null,
      min_order_amount: form.min_order_amount || 0,
      max_uses: form.max_uses || null,
      per_user_limit: form.per_user_limit || 1,
      services: form.services && form.services.length > 0 ? form.services : null,
      expires_at: form.expires_at || null,
      is_active: true,
    }
    const { error } = await supabase.from('coupons').insert(payload)
    setSaving(false)
    if (!error) { setShowAdd(false); setForm({ ...emptyForm }); loadData(); toast('تم إنشاء الكوبون بنجاح') }
    else { toast(error.message?.includes('duplicate') ? 'الكود موجود بالفعل' : 'حدث خطأ', 'error') }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editItem) return
    setSaving(true)
    const payload: any = {
      code: form.code.trim().toUpperCase(),
      type: form.type,
      value: form.value,
      max_discount: form.type === 'percentage' && form.max_discount ? form.max_discount : null,
      min_order_amount: form.min_order_amount || 0,
      max_uses: form.max_uses || null,
      per_user_limit: form.per_user_limit || 1,
      services: form.services && form.services.length > 0 ? form.services : null,
      expires_at: form.expires_at || null,
    }
    const { error } = await supabase.from('coupons').update(payload).eq('id', editItem.id)
    setSaving(false)
    if (!error) { setEditItem(null); loadData(); toast('تم تعديل الكوبون') }
    else { toast('حدث خطأ أثناء التعديل', 'error') }
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('coupons').update({ is_active: !current }).eq('id', id)
    loadData()
    toast(current ? 'تم تعطيل الكوبون' : 'تم تفعيل الكوبون')
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('coupons').delete().eq('id', id)
    if (!error) { setDeleteConfirm(null); loadData(); toast('تم حذف الكوبون') }
    else { toast('حدث خطأ أثناء الحذف', 'error') }
  }

  function openEdit(item: any) {
    setForm({
      code: item.code,
      type: item.type,
      value: item.value,
      max_discount: item.max_discount,
      min_order_amount: item.min_order_amount || 0,
      max_uses: item.max_uses,
      per_user_limit: item.per_user_limit || 1,
      services: item.services,
      expires_at: item.expires_at ? item.expires_at.split('T')[0] : '',
    })
    setEditItem(item)
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    toast('تم نسخ الكود')
  }

  const isExpired = (c: any) => c.expires_at && new Date(c.expires_at) < new Date()
  const isMaxedOut = (c: any) => c.max_uses && c.used_count >= c.max_uses

  const columns = [
    { key: 'code', label: 'الكود', render: (item: any) => (
      <div className="flex items-center gap-2">
        <span className="font-mono font-bold text-navy-800 bg-navy-50 px-2 py-0.5 rounded text-sm">{item.code}</span>
        <button onClick={() => copyCode(item.code)} className="text-gray-400 hover:text-gray-600"><Copy size={14} /></button>
      </div>
    )},
    { key: 'type', label: 'الخصم', render: (item: any) => (
      <span className="font-semibold text-primary-600">
        {item.type === 'percentage' ? `${item.value}%` : `${item.value} ج.م`}
        {item.type === 'percentage' && item.max_discount && <span className="text-[10px] text-gray-400 block">حد أقصى {item.max_discount} ج.م</span>}
      </span>
    )},
    { key: 'usage', label: 'الاستخدام', render: (item: any) => (
      <span className="text-gray-600 text-xs">
        {item.used_count}{item.max_uses ? ` / ${item.max_uses}` : ' (لا محدود)'}
      </span>
    )},
    { key: 'min_order', label: 'الحد الأدنى', render: (item: any) => (
      <span className="text-gray-500 text-xs">{item.min_order_amount > 0 ? `${item.min_order_amount} ج.م` : '—'}</span>
    )},
    { key: 'expires', label: 'ينتهي', render: (item: any) => {
      if (!item.expires_at) return <span className="text-gray-400 text-xs">مفتوح</span>
      const d = new Date(item.expires_at)
      const expired = d < new Date()
      return <span className={`text-xs ${expired ? 'text-red-500 font-medium' : 'text-gray-500'}`}>{d.toLocaleDateString('ar-EG')}</span>
    }},
    { key: 'status', label: 'الحالة', render: (item: any) => {
      if (!item.is_active) return <Badge variant="neutral">معطل</Badge>
      if (isExpired(item)) return <Badge variant="danger">منتهي</Badge>
      if (isMaxedOut(item)) return <Badge variant="warning">نفذ</Badge>
      return <Badge variant="success">فعال</Badge>
    }},
    { key: 'actions', label: '', render: (item: any) => (
      <div className="flex items-center gap-1">
        <PermissionGate permission="manage_prices">
          <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-navy-50 text-gray-400 hover:text-primary-500 transition-colors"><Edit2 size={15} /></button>
          <button onClick={() => toggleActive(item.id, item.is_active)} className="p-1.5 rounded-lg hover:bg-navy-50 text-gray-400 hover:text-amber-500 transition-colors"><Power size={15} /></button>
          <button onClick={() => setDeleteConfirm(item)} className="p-1.5 rounded-lg hover:bg-navy-50 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={15} /></button>
        </PermissionGate>
      </div>
    )},
  ]

  const formFields = (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-gray-500 mb-1">كود الكوبون</label>
        <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
          className="w-full border rounded-xl px-3 py-2 text-sm font-mono uppercase" placeholder="مثال: WELCOME20" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">نوع الخصم</label>
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}
            className="w-full border rounded-xl px-3 py-2 text-sm">
            <option value="percentage">نسبة %</option>
            <option value="fixed">مبلغ ثابت</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">{form.type === 'percentage' ? 'النسبة %' : 'المبلغ (ج.م)'}</label>
          <input type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: Number(e.target.value) }))}
            className="w-full border rounded-xl px-3 py-2 text-sm" min={1} required />
        </div>
      </div>
      {form.type === 'percentage' && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">الحد الأقصى للخصم (ج.م) — اختياري</label>
          <input type="number" value={form.max_discount ?? ''} onChange={e => setForm(f => ({ ...f, max_discount: e.target.value ? Number(e.target.value) : null }))}
            className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="بدون حد" />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">الحد الأدنى للطلب (ج.م)</label>
          <input type="number" value={form.min_order_amount} onChange={e => setForm(f => ({ ...f, min_order_amount: Number(e.target.value) }))}
            className="w-full border rounded-xl px-3 py-2 text-sm" min={0} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">عدد مرات الاستخدام الكلي</label>
          <input type="number" value={form.max_uses ?? ''} onChange={e => setForm(f => ({ ...f, max_uses: e.target.value ? Number(e.target.value) : null }))}
            className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="لا محدود" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">الحد لكل عميل</label>
          <input type="number" value={form.per_user_limit} onChange={e => setForm(f => ({ ...f, per_user_limit: Number(e.target.value) }))}
            className="w-full border rounded-xl px-3 py-2 text-sm" min={1} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">تاريخ الانتهاء</label>
          <input type="date" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
            className="w-full border rounded-xl px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">خدمات محددة (اتركها فاضية = كل الخدمات)</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {allServices.map(s => (
            <button key={s} type="button"
              onClick={() => setForm(f => {
                const current = f.services ?? []
                const next = current.includes(s) ? current.filter(x => x !== s) : [...current, s]
                return { ...f, services: next.length > 0 ? next : null }
              })}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${(form.services ?? []).includes(s) ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {SERVICE_TYPE_LABELS[s]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy-800">كوبونات الخصم</h1>
          <p className="text-sm text-gray-400 mt-1">إنشاء وإدارة أكواد الخصم</p>
        </div>
        <PermissionGate permission="manage_prices">
          <button onClick={() => { setForm({ ...emptyForm }); setShowAdd(true) }}
            className="flex items-center gap-2 bg-primary-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-600 transition-colors shadow-sm">
            <Plus size={16} /> كوبون جديد
          </button>
        </PermissionGate>
      </div>

      <DataTable
        columns={columns}
        data={coupons}
        loading={loading}
        emptyMessage="لا توجد كوبونات حتى الآن"
        searchPlaceholder="بحث بالكود..."
        searchKeys={['code']}
      />

      {/* Add Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="كوبون جديد">
        <form onSubmit={handleAdd} className="space-y-4">
          {formFields}
          <button type="submit" disabled={saving}
            className="w-full bg-primary-500 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors">
            {saving ? 'جاري الحفظ...' : 'إنشاء الكوبون'}
          </button>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="تعديل الكوبون">
        <form onSubmit={handleEdit} className="space-y-4">
          {formFields}
          <button type="submit" disabled={saving}
            className="w-full bg-primary-500 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors">
            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
        </form>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="حذف الكوبون">
        <p className="text-gray-600 text-sm mb-4">هل أنت متأكد من حذف الكوبون <strong>{deleteConfirm?.code}</strong>؟ لا يمكن التراجع.</p>
        <div className="flex gap-2">
          <button onClick={() => handleDelete(deleteConfirm.id)} className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-red-600 transition-colors">حذف</button>
          <button onClick={() => setDeleteConfirm(null)} className="flex-1 bg-gray-100 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors">إلغاء</button>
        </div>
      </Modal>
    </motion.div>
  )
}
