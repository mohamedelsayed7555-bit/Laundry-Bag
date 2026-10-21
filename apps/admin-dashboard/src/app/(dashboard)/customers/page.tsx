'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import DataTable from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { Search, Plus, Edit2, Power, Users, KeyRound, TrendingUp} from 'lucide-react'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import Tooltip from '@/components/ui/Tooltip'
import PermissionGate from '@/components/ui/PermissionGate'
import { useAuth } from '@/lib/auth-context'
import { isValidEgyptianPhone, isValidEmail } from '@/lib/utils'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  // Customers who moved up a tier in the last 30 days — the ones worth a thank-you.
  const [onlyUpgraded, setOnlyUpgraded] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '', tier: 'bronze' })
  const [issuedCode, setIssuedCode] = useState<{ name: string; phone: string; code: string; minutes: number; welcome?: boolean } | null>(null)
  const [resetItem, setResetItem] = useState<any>(null)
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const { toast } = useToast()
  const { hasPermission } = useAuth()
  const PAGE_SIZE = 20

  useEffect(() => { loadCustomers() }, [page])

  async function loadCustomers() {
    const { data, count } = await supabase.from('users')
      .select('id, name, phone, email, customer_code, tier, points, tier_changed_at, is_active, created_at, orders:orders!orders_customer_id_fkey(count)', { count: 'exact' })
      .eq('role', 'customer').order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    setCustomers((data ?? []).map((c: any) => ({ ...c, orders_count: c.orders?.[0]?.count ?? 0 })))
    setTotalCount(count ?? 0)
    setLoading(false)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (form.phone && !isValidEgyptianPhone(form.phone)) { toast('رقم الموبايل غير صحيح — يجب أن يبدأ بـ 01 ويكون 11 رقم', 'error'); return }
    if (form.email && !isValidEmail(form.email)) { toast('صيغة البريد الإلكتروني غير صحيحة', 'error'); return }
    setSaving(true)
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, role: 'customer' }),
    })
    const result = await res.json()
    setSaving(false)
    if (result.success) {
      setShowAdd(false); setForm({ name: '', phone: '', email: '', tier: 'bronze' }); loadCustomers(); toast('تم إضافة العميل بنجاح')
      // A code, not a password: the customer sets his own on first sign-in.
      if (result.code) {
        setIssuedCode({ name: result.name ?? form.name, phone: result.phone ?? form.phone, code: result.code, minutes: result.expiresInMinutes, welcome: true })
      }
    }
    else { toast(result.error ?? 'حدث خطأ أثناء الإضافة', 'error') }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (form.phone && !isValidEgyptianPhone(form.phone)) { toast('رقم الموبايل غير صحيح — يجب أن يبدأ بـ 01 ويكون 11 رقم', 'error'); return }
    if (form.email && !isValidEmail(form.email)) { toast('صيغة البريد الإلكتروني غير صحيحة', 'error'); return }
    setSaving(true)
    if (form.phone) {
      const { data: dup } = await supabase.from('users').select('id').eq('phone', form.phone).neq('id', editItem.id).maybeSingle()
      if (dup) { setSaving(false); toast('رقم الموبايل مستخدم بالفعل', 'error'); return }
    }
    if (form.email) {
      const { data: dup } = await supabase.from('users').select('id').eq('email', form.email).neq('id', editItem.id).maybeSingle()
      if (dup) { setSaving(false); toast('البريد الإلكتروني مستخدم بالفعل', 'error'); return }
    }
    const { error } = await supabase.from('users').update({ name: form.name, phone: form.phone, email: form.email, tier: form.tier }).eq('id', editItem.id)
    setSaving(false)
    if (!error) { setEditItem(null); loadCustomers(); toast('تم تعديل بيانات العميل') }
    else { toast('حدث خطأ أثناء التعديل', 'error') }
  }

  async function toggleActive(id: string, current: boolean) {
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, is_active: !current } : c))
    toast(current ? 'تم تعطيل العميل' : 'تم تفعيل العميل')
    const { error } = await supabase.from('users').update({ is_active: !current }).eq('id', id)
    if (error) { toast('حدث خطأ — جاري التحديث', 'error'); loadCustomers() }
  }

  function openEdit(item: any) {
    setForm({ name: item.name, phone: item.phone ?? '', email: item.email ?? '', tier: item.tier ?? 'bronze' })
    setEditItem(item)
  }

  // We issue a recovery code, never a password. The customer types the code in the app
  // and chooses his own password there, so no one here can sign in as him.
  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (!resetItem) return
    setSaving(true)
    const res = await fetch('/api/issue-reset-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: resetItem.id }),
    })
    const result = await res.json()
    setSaving(false)
    if (result.success) {
      setIssuedCode({ name: result.name ?? resetItem.name, phone: result.phone ?? resetItem.phone ?? '', code: result.code, minutes: result.expiresInMinutes })
      setResetItem(null)
      toast('تم إصدار كود الاسترجاع')
    } else { toast(result.error ?? 'حدث خطأ أثناء إصدار الكود', 'error') }
  }

  const filtered = useMemo(() => customers.filter(c => {
    if (onlyUpgraded) {
      if (!c.tier_changed_at) return false
      const days = (Date.now() - new Date(c.tier_changed_at).getTime()) / 86400000
      if (days > 30) return false
    }
    if (!search) return true
    const s = search.toLowerCase()
    return c.name?.toLowerCase().includes(s) || c.phone?.includes(s) || c.customer_code?.toLowerCase().includes(s)
  }), [customers, search, onlyUpgraded])

  const upgradedCount = useMemo(() => customers.filter((c: any) => {
    if (!c.tier_changed_at) return false
    return (Date.now() - new Date(c.tier_changed_at).getTime()) / 86400000 <= 30
  }).length, [customers])

  const tierVariant = (tier: string) => {
    const map: Record<string, 'success' | 'warning' | 'info' | 'purple'> = { bronze: 'warning', silver: 'info', gold: 'success', platinum: 'purple' }
    return map[tier] ?? 'info'
  }
  const tierLabel: Record<string, string> = { bronze: 'برونزي', silver: 'فضي', gold: 'ذهبي', platinum: 'بلاتيني' }

  const columns = [
    { key: 'customer_code', label: 'الكود', render: (item: any) => <span className="font-bold text-primary-600 text-xs">{item.customer_code}</span> },
    { key: 'name', label: 'الاسم', render: (item: any) => (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-navy-400 to-accent-purple/80 flex items-center justify-center text-white text-xs font-bold shadow-premium">{item.name?.[0]}</div>
        <span className="font-medium">{item.name}</span>
      </div>
    )},
    { key: 'phone', label: 'الهاتف' },
    { key: 'email', label: 'البريد', render: (item: any) => item.email ?? <span className="text-gray-300">—</span> },
    { key: 'tier', label: 'المستوى', render: (item: any) => <Badge variant={tierVariant(item.tier)}>{tierLabel[item.tier] ?? item.tier}</Badge> },
    { key: 'points', label: 'النقاط', render: (item: any) => <span className="font-semibold">{item.points}</span> },
    { key: 'orders_count', label: 'الطلبات', render: (item: any) => (
      <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-lg bg-primary-50 text-primary-600 text-xs font-bold">{item.orders_count ?? 0}</span>
    )},
    { key: 'is_active', label: 'الحالة', render: (item: any) => <Badge variant={item.is_active ? 'success' : 'danger'}>{item.is_active ? 'نشط' : 'معطل'}</Badge> },
    { key: 'actions', label: '', render: (item: any) => (
      <div className="flex flex-wrap gap-1">
        {hasPermission('customers.edit') && <Tooltip content="تعديل"><button onClick={() => openEdit(item)} className="p-1.5 hover:bg-surface-muted rounded-lg transition-colors"><Edit2 size={14} className="text-gray-400 hover:text-gray-600" /></button></Tooltip>}
        {hasPermission('customers.edit') && <Tooltip content="إصدار كود استرجاع"><button onClick={() => setResetItem(item)} className="p-1.5 hover:bg-surface-muted rounded-lg transition-colors"><KeyRound size={14} className="text-gray-400 hover:text-primary-600" /></button></Tooltip>}
        {hasPermission('customers.edit') && <Tooltip content={item.is_active ? 'تعطيل' : 'تفعيل'}><button onClick={() => toggleActive(item.id, item.is_active)} className="p-1.5 hover:bg-surface-muted rounded-lg transition-colors"><Power size={14} className={item.is_active ? 'text-red-400' : 'text-green-500'} /></button></Tooltip>}
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
        <label className="block text-xs font-medium text-gray-500 mb-1.5">المستوى</label>
        <select value={form.tier} onChange={e => setForm({ ...form, tier: e.target.value })} className={inputClass}>
          <option value="bronze">برونزي</option><option value="silver">فضي</option>
          <option value="gold">ذهبي</option><option value="platinum">بلاتيني</option>
        </select>
      </div>
    </>
  )

  return (
    <PermissionGate permission="customers.view">
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Users className="w-5 h-5 text-accent-purple" /> إدارة العملاء</h2>
          <p className="text-sm text-gray-400 mt-0.5">{totalCount} عميل</p>
        </div>
        {hasPermission('customers.create') && (
          <button onClick={() => { setForm({ name: '', phone: '', email: '', tier: 'bronze' }); setShowAdd(true) }}
            className="flex items-center gap-2 bg-gradient-to-l from-primary-500 to-primary-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:shadow-glow-green transition-all duration-300">
            <Plus size={16} /> عميل جديد
          </button>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1 min-w-[220px]">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="بحث بالاسم أو الكود أو الهاتف..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pr-10 pl-4 py-2.5 bg-white border border-surface-border/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-500/30 transition-all" />
        </div>

        {/* Nothing is sent automatically — this just rounds up who moved up, so they can
            be thanked by hand. */}
        <button
          type="button"
          onClick={() => setOnlyUpgraded(v => !v)}
          className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
            onlyUpgraded
              ? 'border-primary-500/40 bg-primary-50 text-primary-700'
              : 'border-surface-border/60 bg-white text-gray-500 hover:text-gray-700'
          }`}
        >
          <TrendingUp size={15} />
          ترقّوا مؤخراً
          {upgradedCount > 0 && (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
              onlyUpgraded ? 'bg-primary-500 text-white' : 'bg-amber-100 text-amber-700'
            }`}>{upgradedCount}</span>
          )}
        </button>
      </motion.div>

      {loading ? <TableSkeleton rows={5} cols={5} />
        : <>
          <DataTable columns={columns} data={filtered} emptyMessage="لا يوجد عملاء مسجلين" pageSize={PAGE_SIZE} />
          {(() => { const tp = Math.ceil(totalCount / PAGE_SIZE); return tp > 1 ? (
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-gray-400">صفحة {page + 1} من {tp}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => p - 1)} disabled={page === 0}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-muted disabled:opacity-30 disabled:cursor-not-allowed">
                  <span className="text-gray-600 text-sm">›</span>
                </button>
                {Array.from({ length: Math.min(tp, 5) }, (_, i) => {
                  const pn = tp <= 5 ? i : page < 3 ? i : page > tp - 4 ? tp - 5 + i : page - 2 + i
                  return <button key={pn} onClick={() => setPage(pn)} className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${page === pn ? 'bg-navy-900 text-white shadow-premium-md' : 'text-gray-500 hover:bg-surface-muted'}`}>{pn + 1}</button>
                })}
                <button onClick={() => setPage(p => p + 1)} disabled={page >= tp - 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-muted disabled:opacity-30 disabled:cursor-not-allowed">
                  <span className="text-gray-600 text-sm">‹</span>
                </button>
              </div>
            </div>
          ) : null })()}
        </>}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="عميل جديد">
        <form onSubmit={handleAdd} className="space-y-4">
          {formFields}
          <div className="bg-surface-muted rounded-xl p-3 text-[11px] text-gray-500 leading-6">
            بعد الحفظ هيطلعلك <b className="text-gray-700">كود استلام</b> تبعته للعميل، وهو اللي يحدد كلمة سره من التطبيق. إحنا مش بنشوف كلمة سر أي عميل.
          </div>
          <button type="submit" disabled={saving}
            className="w-full bg-gradient-to-l from-primary-500 to-primary-600 text-white p-3 rounded-xl font-semibold hover:shadow-glow-green disabled:opacity-50 transition-all">
            {saving ? 'جاري الحفظ...' : 'إضافة العميل'}
          </button>
        </form>
      </Modal>

      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="تعديل العميل">
        <form onSubmit={handleEdit} className="space-y-4">
          {formFields}
          <button type="submit" disabled={saving}
            className="w-full bg-gradient-to-l from-primary-500 to-primary-600 text-white p-3 rounded-xl font-semibold hover:shadow-glow-green disabled:opacity-50 transition-all">
            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
        </form>
      </Modal>

      <Modal open={!!resetItem} onClose={() => setResetItem(null)} title="كود استرجاع الحساب">
        <form onSubmit={handleReset} className="space-y-4">
          <p className="text-sm text-gray-500 leading-6">عميل: <b className="text-gray-800">{resetItem?.name}</b>. هيتعمل كود من 6 أرقام تبعته له، وهو اللي يحدد كلمة المرور بنفسه من التطبيق.</p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 leading-6">
            اتأكد إنك بتكلم صاحب الحساب فعلاً قبل ما تبعت الكود. إحنا مش بنشوف كلمة سر العميل ولا بنقدر نحددها له.
          </div>
          <button type="submit" disabled={saving}
            className="w-full bg-gradient-to-l from-primary-500 to-primary-600 text-white p-3 rounded-xl font-semibold hover:shadow-glow-green disabled:opacity-50 transition-all">
            {saving ? 'جاري الإصدار...' : 'إصدار الكود'}
          </button>
        </form>
      </Modal>

      <Modal open={!!issuedCode} onClose={() => setIssuedCode(null)} title={issuedCode?.welcome ? 'كود استلام الحساب' : 'كود الاسترجاع'}>
        {issuedCode && (() => {
          const text = `${issuedCode.welcome ? 'كود استلام حسابك' : 'كود استرجاع حسابك'} في Laundry Bag: ${issuedCode.code}
صالح لمدة ${issuedCode.minutes} دقيقة. افتح التطبيق > نسيت كلمة السر > عندي كود، واختر كلمة سر جديدة بنفسك.`
          const waPhone = issuedCode.phone.replace(/\s|-/g, '').replace(/^0/, '20')
          const waText = encodeURIComponent(`أهلاً ${issuedCode.name} 👋
${text}`)
          return (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 leading-6">ابعت الكود ده للعميل — <b className="text-gray-700">مش هيظهر تاني</b>. {issuedCode.welcome ? 'الحساب مش هيشتغل غير لما يستخدم الكود ويحدد كلمة سره.' : 'العميل هو اللي هيحدد كلمة المرور في التطبيق.'}</p>
              <div className="bg-surface-muted rounded-xl p-4 text-center">
                <div className="text-3xl font-bold tracking-[0.4em] text-gray-800" dir="ltr">{issuedCode.code}</div>
                <div className="text-xs text-gray-400 mt-2">صالح {issuedCode.minutes} دقيقة · لمرة واحدة</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => navigator.clipboard?.writeText(issuedCode.code).then(() => toast('تم نسخ الكود')).catch(() => toast('تعذّر النسخ', 'error'))}
                  className="flex-1 bg-surface-muted hover:bg-surface-border/60 text-gray-700 p-3 rounded-xl text-sm font-semibold transition-all">
                  نسخ الكود
                </button>
                <a href={`https://wa.me/${waPhone}?text=${waText}`} target="_blank" rel="noreferrer"
                  className="flex-1 text-center bg-gradient-to-l from-primary-500 to-primary-600 text-white p-3 rounded-xl text-sm font-semibold hover:shadow-glow-green transition-all">
                  إرسال واتساب
                </a>
              </div>
            </div>
          )
        })()}
      </Modal>
    </div>
    </PermissionGate>
  )
}
