'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { Crown, Plus, Edit2, Power, Users, Zap, Star, Gem } from 'lucide-react'
import { motion } from 'framer-motion'
import { useToast } from '@/components/ui/Toast'
import Tooltip from '@/components/ui/Tooltip'
import PermissionGate from '@/components/ui/PermissionGate'

const tierConfig: Record<string, { icon: typeof Crown; color: string; gradient: string }> = {
  individual: { icon: Users, color: 'text-blue-500', gradient: 'from-blue-500 to-blue-600' },
  couple: { icon: Zap, color: 'text-purple-500', gradient: 'from-purple-500 to-purple-600' },
  family: { icon: Star, color: 'text-amber-500', gradient: 'from-amber-500 to-amber-600' },
  premium: { icon: Gem, color: 'text-emerald-500', gradient: 'from-emerald-500 to-emerald-600' },
}
const tierLabels: Record<string, string> = {
  individual: 'فردي', couple: 'زوجي', family: 'عائلي', premium: 'بريميوم',
}
const durationLabels: Record<string, string> = {
  monthly: 'شهري', quarterly: 'ربع سنوي', biannual: 'نصف سنوي', annual: 'سنوي',
}

interface Plan {
  id: string
  name: string
  description: string | null
  tier: string
  items_per_month: number
  includes_all_services: boolean
  monthly_price: number
  quarterly_price: number | null
  biannual_price: number | null
  annual_price: number | null
  is_active: boolean
  created_at: string
}

const emptyForm = {
  name: '', description: '', tier: 'individual', items_per_month: 20,
  includes_all_services: true, monthly_price: 0, quarterly_price: 0,
  biannual_price: 0, annual_price: 0,
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [subs, setSubs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editPlan, setEditPlan] = useState<Plan | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const { toast } = useToast()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [p, s] = await Promise.all([
      supabase.from('plans').select('*').order('monthly_price'),
      supabase.from('subscriptions').select('*, user:users!subscriptions_user_id_fkey(name), plan:plans!subscriptions_plan_id_fkey(name)').eq('status', 'active'),
    ])
    setPlans(p.data ?? [])
    setSubs(s.data ?? [])
    setLoading(false)
  }

  function openEdit(plan: Plan) {
    setForm({
      name: plan.name, description: plan.description || '', tier: plan.tier,
      items_per_month: plan.items_per_month, includes_all_services: plan.includes_all_services,
      monthly_price: +plan.monthly_price, quarterly_price: +(plan.quarterly_price || 0),
      biannual_price: +(plan.biannual_price || 0), annual_price: +(plan.annual_price || 0),
    })
    setEditPlan(plan)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      ...form,
      quarterly_price: form.quarterly_price || null,
      biannual_price: form.biannual_price || null,
      annual_price: form.annual_price || null,
    }

    if (editPlan) {
      const { error } = await supabase.from('plans').update(payload).eq('id', editPlan.id)
      if (!error) { setEditPlan(null); loadData(); toast('تم تعديل الباقة') }
      else { console.error(error); toast('حدث خطأ', 'error') }
    } else {
      const { error } = await supabase.from('plans').insert(payload)
      if (!error) { setShowAdd(false); setForm(emptyForm); loadData(); toast('تم إضافة الباقة') }
      else { console.error(error); toast('حدث خطأ', 'error') }
    }
    setSaving(false)
  }

  async function toggleActive(plan: Plan) {
    await supabase.from('plans').update({ is_active: !plan.is_active }).eq('id', plan.id)
    loadData()
    toast(plan.is_active ? 'تم إلغاء تفعيل الباقة' : 'تم تفعيل الباقة')
  }

  function subsCount(planId: string) {
    return subs.filter(s => s.plan_id === planId).length
  }

  function calcDiscount(monthly: number, total: number, months: number): string {
    if (!total || !monthly) return ''
    const full = monthly * months
    const pct = Math.round(((full - total) / full) * 100)
    return pct > 0 ? `${pct}%` : ''
  }

  const inputClass = 'w-full p-3 border border-surface-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-500/30 transition-all'

  const formContent = (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">اسم الباقة <span className="text-red-400">*</span></label>
          <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className={inputClass} placeholder="مثلاً: شنطة 100 قطعة" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">الفئة <span className="text-red-400">*</span></label>
          <select value={form.tier} onChange={e => setForm({ ...form, tier: e.target.value })} className={inputClass}>
            <option value="individual">فردي</option>
            <option value="couple">زوجي</option>
            <option value="family">عائلي</option>
            <option value="premium">بريميوم</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">الوصف</label>
        <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={inputClass} placeholder="وصف مختصر للباقة" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">عدد القطع / شهر <span className="text-red-400">*</span></label>
          <input type="number" min={1} value={form.items_per_month} onChange={e => setForm({ ...form, items_per_month: +e.target.value })} required className={inputClass} />
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.includes_all_services} onChange={e => setForm({ ...form, includes_all_services: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500" />
            <span className="text-sm text-gray-600">تشمل كل الخدمات</span>
          </label>
        </div>
      </div>

      <div className="border-t border-surface-border/60 pt-4">
        <p className="text-xs font-semibold text-gray-500 mb-3">التسعير</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">شهري (ج.م) *</label>
            <input type="number" min={0} step="0.01" value={form.monthly_price} onChange={e => setForm({ ...form, monthly_price: +e.target.value })} required className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">ربع سنوي (ج.م)</label>
            <input type="number" min={0} step="0.01" value={form.quarterly_price} onChange={e => setForm({ ...form, quarterly_price: +e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">نصف سنوي (ج.م)</label>
            <input type="number" min={0} step="0.01" value={form.biannual_price} onChange={e => setForm({ ...form, biannual_price: +e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">سنوي (ج.م)</label>
            <input type="number" min={0} step="0.01" value={form.annual_price} onChange={e => setForm({ ...form, annual_price: +e.target.value })} className={inputClass} />
          </div>
        </div>
      </div>

      <button type="submit" disabled={saving}
        className="w-full bg-gradient-to-l from-primary-500 to-primary-600 text-white p-3 rounded-xl font-semibold hover:shadow-glow-green disabled:opacity-50 transition-all">
        {saving ? 'جاري الحفظ...' : editPlan ? 'حفظ التعديلات' : 'إضافة الباقة'}
      </button>
    </form>
  )

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <PermissionGate permission="plans.manage">
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Crown className="w-5 h-5 text-amber-500" /> الباقات والعروض</h2>
          <p className="text-sm text-gray-400 mt-0.5">إدارة باقات الاشتراك والعروض</p>
        </div>
        <button onClick={() => { setForm(emptyForm); setShowAdd(true) }}
          className="flex items-center gap-2 bg-gradient-to-l from-primary-500 to-primary-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:shadow-glow-green transition-all duration-300">
          <Plus size={16} /> باقة جديدة
        </button>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-premium border border-surface-border/60 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">إجمالي الباقات</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center"><Crown size={18} className="text-amber-500" /></div>
          </div>
          <p className="text-2xl font-bold text-gray-800">{plans.length}</p>
          <p className="text-xs text-gray-400 mt-1">{plans.filter(p => p.is_active).length} مفعّلة</p>
        </div>
        <div className="bg-white rounded-2xl shadow-premium border border-surface-border/60 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">المشتركين النشطين</span>
            <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center"><Users size={18} className="text-primary-500" /></div>
          </div>
          <p className="text-2xl font-bold text-gray-800">{subs.length}</p>
          <p className="text-xs text-gray-400 mt-1">اشتراك نشط</p>
        </div>
        <div className="bg-white rounded-2xl shadow-premium border border-surface-border/60 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">أعلى باقة سعراً</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center"><Gem size={18} className="text-emerald-500" /></div>
          </div>
          <p className="text-2xl font-bold text-gray-800">{plans.length > 0 ? Math.max(...plans.map(p => +p.monthly_price)).toLocaleString() : 0} ج.م</p>
          <p className="text-xs text-gray-400 mt-1">شهرياً</p>
        </div>
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plans.map((plan, i) => {
          const cfg = tierConfig[plan.tier] || tierConfig.individual
          const Icon = cfg.icon
          const activeSubs = subsCount(plan.id)

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`bg-white rounded-2xl shadow-premium border border-surface-border/60 overflow-hidden ${!plan.is_active ? 'opacity-60' : ''}`}
            >
              {/* Header */}
              <div className={`bg-gradient-to-l ${cfg.gradient} p-4 flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <Icon size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                    <p className="text-white/70 text-xs">{plan.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Tooltip content="تعديل الباقة">
                    <button onClick={() => openEdit(plan)} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
                      <Edit2 size={14} className="text-white/80" />
                    </button>
                  </Tooltip>
                  <Tooltip content={plan.is_active ? 'تعطيل الباقة' : 'تفعيل الباقة'}>
                    <button onClick={() => toggleActive(plan)} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
                      <Power size={14} className={plan.is_active ? 'text-white' : 'text-white/40'} />
                    </button>
                  </Tooltip>
                </div>
              </div>

              {/* Body */}
              <div className="p-5">
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-3xl font-bold text-gray-800">{(+plan.monthly_price).toLocaleString()}</span>
                  <span className="text-sm text-gray-400">ج.م / شهر</span>
                </div>

                <div className="space-y-2.5 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">عدد القطع</span>
                    <span className="font-semibold text-gray-800">{plan.items_per_month} قطعة / شهر</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">الخدمات</span>
                    <Badge variant={plan.includes_all_services ? 'success' : 'info'}>
                      {plan.includes_all_services ? 'كل الخدمات' : 'محدود'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">المشتركين</span>
                    <span className="font-semibold text-gray-800">{activeSubs}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">الحالة</span>
                    <Badge variant={plan.is_active ? 'success' : 'danger'}>
                      {plan.is_active ? 'مفعّلة' : 'معطّلة'}
                    </Badge>
                  </div>
                </div>

                {/* Pricing tiers */}
                {(plan.quarterly_price || plan.biannual_price || plan.annual_price) && (
                  <div className="border-t border-surface-border/60 pt-3 mt-3">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase mb-2">خصومات الاشتراك الطويل</p>
                    <div className="grid grid-cols-3 gap-2">
                      {plan.quarterly_price && (
                        <div className="bg-surface-muted/50 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-gray-400">3 شهور</p>
                          <p className="text-sm font-bold text-gray-700">{(+plan.quarterly_price).toLocaleString()}</p>
                          {calcDiscount(+plan.monthly_price, +plan.quarterly_price, 3) && (
                            <span className="text-[10px] text-primary-500 font-semibold">وفّر {calcDiscount(+plan.monthly_price, +plan.quarterly_price, 3)}</span>
                          )}
                        </div>
                      )}
                      {plan.biannual_price && (
                        <div className="bg-surface-muted/50 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-gray-400">6 شهور</p>
                          <p className="text-sm font-bold text-gray-700">{(+plan.biannual_price).toLocaleString()}</p>
                          {calcDiscount(+plan.monthly_price, +plan.biannual_price, 6) && (
                            <span className="text-[10px] text-primary-500 font-semibold">وفّر {calcDiscount(+plan.monthly_price, +plan.biannual_price, 6)}</span>
                          )}
                        </div>
                      )}
                      {plan.annual_price && (
                        <div className="bg-surface-muted/50 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-gray-400">سنوي</p>
                          <p className="text-sm font-bold text-gray-700">{(+plan.annual_price).toLocaleString()}</p>
                          {calcDiscount(+plan.monthly_price, +plan.annual_price, 12) && (
                            <span className="text-[10px] text-primary-500 font-semibold">وفّر {calcDiscount(+plan.monthly_price, +plan.annual_price, 12)}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>

      {plans.length === 0 && (
        <div className="bg-white rounded-2xl shadow-premium border border-surface-border/60 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <Crown size={28} className="text-amber-400" />
          </div>
          <h3 className="font-semibold text-gray-800 mb-1">لا توجد باقات</h3>
          <p className="text-sm text-gray-400">أضف باقة جديدة لتظهر هنا وفي تطبيق العميل</p>
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="باقة جديدة">{formContent}</Modal>
      <Modal open={!!editPlan} onClose={() => setEditPlan(null)} title="تعديل الباقة">{formContent}</Modal>
    </div>
    </PermissionGate>
  )
}
