'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Settings, Save, Plus, Trash2, UserCircle, Mail, Lock, Camera, Eye, EyeOff, Check, Users, CreditCard, Clock, ShoppingBag, Palette } from 'lucide-react'
import { motion } from 'framer-motion'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import UsersTab from '@/components/settings/UsersTab'
import PermissionGate from '@/components/ui/PermissionGate'

const tabs = [
  { key: 'general', label: 'عام', icon: Settings },
  { key: 'bag_offer', label: 'عرض الشنطة', icon: ShoppingBag },
  { key: 'subscriptions', label: 'الاشتراكات', icon: CreditCard },
  { key: 'brand', label: 'الألوان', icon: Palette },
  { key: 'users', label: 'المستخدمين', icon: Users },
  { key: 'profile', label: 'الملف الشخصي', icon: UserCircle },
  { key: 'security', label: 'الأمان', icon: Lock },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general')
  const [settings, setSettings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [orgName, setOrgName] = useState('Laundry Bag')
  const [orgPhone, setOrgPhone] = useState('+201000000000')
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [showAdd, setShowAdd] = useState(false)
  const [newSetting, setNewSetting] = useState({ key: '', value: '', description: '' })
  const [discounts, setDiscounts] = useState({ quarterly: '10', biannual: '15', annual: '20' })
  const [savingDiscounts, setSavingDiscounts] = useState(false)
  const [workHours, setWorkHours] = useState({ open: '08:00', close: '22:00', enabled: true })
  const [savingHours, setSavingHours] = useState(false)
  const [bagOffer, setBagOffer] = useState({ enabled: true, daily_price: 500, original_price: 700, max_items: 15, title: 'شنطة Laundry Bag', subtitle: 'املأ الشنطة غسيل ومكوي بحد أقصى 15 قطعة', badge_text: 'الحق العرض' })
  const [savingBag, setSavingBag] = useState(false)
  const [brandColor, setBrandColor] = useState('#00c966')
  const [savingBrand, setSavingBrand] = useState(false)
  const { toast } = useToast()

  const brandColors = [
    { hex: '#00c966', name: 'أخضر (افتراضي)' },
    { hex: '#0ea5e9', name: 'أزرق سماوي' },
    { hex: '#6366f1', name: 'بنفسجي' },
    { hex: '#8b5cf6', name: 'أرجواني' },
    { hex: '#ec4899', name: 'وردي' },
    { hex: '#f43f5e', name: 'أحمر وردي' },
    { hex: '#f97316', name: 'برتقالي' },
    { hex: '#eab308', name: 'ذهبي' },
    { hex: '#14b8a6', name: 'تركوازي' },
    { hex: '#10b981', name: 'أخضر زمردي' },
    { hex: '#3b82f6', name: 'أزرق' },
    { hex: '#1e3a5f', name: 'كحلي' },
  ]

  // Profile states
  const [profile, setProfile] = useState<any>(null)
  const [userId, setUserId] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadSettings()
    loadProfile()
  }, [])

  async function loadSettings() {
    const { data } = await supabase.from('settings').select('id, key, value, description').order('key')
    setSettings(data ?? [])
    const vals: Record<string, string> = {}
    data?.forEach(s => { vals[s.id] = typeof s.value === 'object' ? JSON.stringify(s.value) : String(s.value) })
    setEditValues(vals)
    const nameS = data?.find(s => s.key === 'org_name')
    const phoneS = data?.find(s => s.key === 'org_phone')
    if (nameS) setOrgName(String(nameS.value))
    if (phoneS) setOrgPhone(String(phoneS.value))
    const dq = data?.find(s => s.key === 'discount_quarterly')
    const db = data?.find(s => s.key === 'discount_biannual')
    const da = data?.find(s => s.key === 'discount_annual')
    setDiscounts({
      quarterly: dq ? String(dq.value) : '10',
      biannual: db ? String(db.value) : '15',
      annual: da ? String(da.value) : '20',
    })
    const brandS = data?.find(s => s.key === 'brand_color')
    if (brandS && typeof brandS.value === 'object' && brandS.value?.selected) setBrandColor(brandS.value.selected)
    else if (brandS && typeof brandS.value === 'string' && brandS.value.startsWith('#')) setBrandColor(brandS.value)
    const bagS = data?.find(s => s.key === 'bag_offer')
    if (bagS && typeof bagS.value === 'object') setBagOffer({ ...bagOffer, ...bagS.value })
    const oh = data?.find(s => s.key === 'open_hour')
    const ch = data?.find(s => s.key === 'close_hour')
    const whe = data?.find(s => s.key === 'working_hours_enabled')
    setWorkHours({
      open: oh ? String(oh.value) : '08:00',
      close: ch ? String(ch.value) : '22:00',
      enabled: whe ? String(whe.value) !== 'false' : true,
    })
    setLoading(false)
  }

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    setUserEmail(user.email ?? '')
    setNewEmail(user.email ?? '')
    const { data } = await supabase.from('users').select('id, name, phone, email, role, avatar_url').eq('id', user.id).single()
    if (data) {
      setProfile(data)
      setName(data.name || '')
      setPhone(data.phone || '')
      setAvatarUrl(data.avatar_url || null)
    }
  }

  async function handleSaveAll() {
    setSaving(true)
    try {
      for (const s of settings) {
        let val: any = s.key === 'org_name' ? orgName : s.key === 'org_phone' ? orgPhone : (editValues[s.id] ?? s.value)
        if (typeof val === 'string' && !isNaN(Number(val)) && val.trim() !== '') val = Number(val)
        const { error } = await supabase.from('settings').update({ value: val }).eq('id', s.id)
        if (error) console.error('Save error for', s.key, ':', error.message, error.details, error.code)
      }
      const nameExists = settings.find(s => s.key === 'org_name')
      const phoneExists = settings.find(s => s.key === 'org_phone')
      if (!nameExists) await supabase.from('settings').insert({ key: 'org_name', value: orgName, description: 'اسم المؤسسة' })
      if (!phoneExists) await supabase.from('settings').insert({ key: 'org_phone', value: orgPhone, description: 'رقم هاتف المؤسسة' })
      toast('تم حفظ الإعدادات بنجاح')
    } catch {
      toast('حدث خطأ في الحفظ', 'error')
    }
    setSaving(false)
    loadSettings()
  }

  async function handleAddSetting(e: React.FormEvent) {
    e.preventDefault()
    await supabase.from('settings').insert({ key: newSetting.key, value: newSetting.value, description: newSetting.description || null })
    setShowAdd(false)
    setNewSetting({ key: '', value: '', description: '' })
    loadSettings()
    toast('تم إضافة الإعداد')
  }

  async function handleSaveDiscounts() {
    setSavingDiscounts(true)
    const entries = [
      { key: 'discount_quarterly', value: discounts.quarterly, description: 'نسبة خصم ربع سنوي %' },
      { key: 'discount_biannual', value: discounts.biannual, description: 'نسبة خصم نصف سنوي %' },
      { key: 'discount_annual', value: discounts.annual, description: 'نسبة خصم سنوي %' },
    ]
    for (const entry of entries) {
      const existing = settings.find(s => s.key === entry.key)
      if (existing) {
        await supabase.from('settings').update({ value: entry.value }).eq('id', existing.id)
      } else {
        await supabase.from('settings').upsert(entry)
      }
    }
    setSavingDiscounts(false)
    loadSettings()
    toast('تم حفظ نسب الخصم')
  }

  async function handleSaveWorkHours() {
    setSavingHours(true)
    const entries = [
      { key: 'open_hour', value: workHours.open, description: 'ساعة الفتح' },
      { key: 'close_hour', value: workHours.close, description: 'ساعة الإغلاق' },
      { key: 'working_hours_enabled', value: String(workHours.enabled), description: 'تفعيل ساعات العمل' },
    ]
    for (const entry of entries) {
      const existing = settings.find(s => s.key === entry.key)
      if (existing) {
        await supabase.from('settings').update({ value: entry.value }).eq('id', existing.id)
      } else {
        await supabase.from('settings').upsert(entry)
      }
    }
    setSavingHours(false)
    loadSettings()
    toast('تم حفظ ساعات العمل')
  }

  async function handleSaveBagOffer() {
    setSavingBag(true)
    const existing = settings.find(s => s.key === 'bag_offer')
    if (existing) {
      await supabase.from('settings').update({ value: bagOffer }).eq('id', existing.id)
    } else {
      await supabase.from('settings').insert({ key: 'bag_offer', value: bagOffer, description: 'إعدادات عرض شنطة Laundry Bag اليومي' })
    }
    setSavingBag(false)
    loadSettings()
    toast('تم حفظ إعدادات عرض الشنطة')
  }

  async function handleSaveBrandColor() {
    setSavingBrand(true)
    const value = { selected: brandColor }
    const existing = settings.find(s => s.key === 'brand_color')
    if (existing) {
      await supabase.from('settings').update({ value }).eq('id', existing.id)
    } else {
      await supabase.from('settings').insert({ key: 'brand_color', value, description: 'لون العلامة التجارية للتطبيق' })
    }
    setSavingBrand(false)
    loadSettings()
    toast('تم حفظ لون العلامة التجارية — سيتم تحديث التطبيق تلقائياً')
  }

  async function deleteSetting(id: string) {
    await supabase.from('settings').delete().eq('id', id)
    loadSettings()
    toast('تم حذف الإعداد')
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSavingProfile(true)
    const { error } = await supabase.from('users').update({ name, phone }).eq('id', userId)
    setSavingProfile(false)
    if (!error) { setProfile((p: any) => ({ ...p, name, phone })); toast('تم تحديث البيانات الشخصية') }
    else toast('حدث خطأ في التحديث', 'error')
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault()
    if (newEmail === userEmail) return toast('الإيميل هو نفسه الحالي', 'warning')
    setSavingEmail(true)
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    setSavingEmail(false)
    if (!error) toast('تم إرسال رابط التأكيد للإيميل الجديد')
    else toast(error.message || 'حدث خطأ', 'error')
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword.length < 6) return toast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'warning')
    if (newPassword !== confirmPassword) return toast('كلمة المرور غير متطابقة', 'warning')
    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)
    if (!error) { setNewPassword(''); setConfirmPassword(''); toast('تم تغيير كلمة المرور') }
    else toast(error.message || 'حدث خطأ', 'error')
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) return toast('الحد الأقصى 2 ميجا', 'warning')
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `avatars/${userId}.${ext}`
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (uploadError) { setUploading(false); toast('فشل رفع الصورة', 'error'); return }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    const url = `${publicUrl}?t=${Date.now()}`
    await supabase.from('users').update({ avatar_url: url }).eq('id', userId)
    setAvatarUrl(url)
    setProfile((p: any) => ({ ...p, avatar_url: url }))
    setUploading(false)
    toast('تم تحديث الصورة الشخصية')
  }

  const inputClass = 'w-full p-3 border border-surface-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-500/30 transition-all'
  const sectionClass = 'bg-white rounded-2xl shadow-premium border border-surface-border/60 overflow-hidden'

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <PermissionGate permission="settings.view">
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Settings className="w-5 h-5 text-gray-500" /> الإعدادات</h2>
          <p className="text-sm text-gray-400 mt-0.5">إعدادات المنصة والحساب الشخصي</p>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1.5 bg-surface-muted/60 p-1 rounded-xl w-fit overflow-x-auto max-w-full">
        {tabs.map(t => {
          const Icon = t.icon
          return (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap shrink-0 ${activeTab === t.key ? 'bg-white text-gray-800 shadow-premium-md' : 'text-gray-500 hover:text-gray-700'}`}>
              <Icon size={14} /> {t.label}
            </button>
          )
        })}
      </div>

      {/* General Tab */}
      {activeTab === 'general' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-white border border-surface-border/60 text-gray-600 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-surface-muted transition-colors">
              <Plus size={16} /> إعداد جديد
            </button>
            <button onClick={handleSaveAll} disabled={saving}
              className="flex items-center gap-2 bg-gradient-to-l from-primary-500 to-primary-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:shadow-glow-green disabled:opacity-50 transition-all duration-300">
              <Save size={16} /> {saving ? 'جاري الحفظ...' : 'حفظ الكل'}
            </button>
          </div>

          <div className={sectionClass + ' p-6'}>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-navy-50 rounded-xl"><Settings size={20} className="text-navy-600" /></div>
              <h3 className="font-semibold text-gray-800">معلومات المؤسسة</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">اسم المؤسسة</label>
                <input type="text" value={orgName} onChange={e => setOrgName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">رقم الهاتف</label>
                <input type="text" value={orgPhone} onChange={e => setOrgPhone(e.target.value)} dir="ltr" className={inputClass} />
              </div>
            </div>
          </div>

          <div className={sectionClass + ' p-6'}>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-amber-50 rounded-xl"><Clock size={20} className="text-amber-600" /></div>
              <div>
                <h3 className="font-semibold text-gray-800">ساعات العمل</h3>
                <p className="text-xs text-gray-400 mt-0.5">تحديد مواعيد استقبال الطلبات — خارج الساعات دي العميل مش هيقدر يطلب</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-surface-muted/50 rounded-xl">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">تفعيل ساعات العمل</p>
                  <p className="text-xs text-gray-400">لو مطفي، العميل يقدر يطلب في أي وقت</p>
                </div>
                <button onClick={() => setWorkHours({ ...workHours, enabled: !workHours.enabled })}
                  className={`relative w-12 h-7 rounded-full transition-colors ${workHours.enabled ? 'bg-primary-500' : 'bg-gray-300'}`}>
                  <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all ${workHours.enabled ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </div>
              {workHours.enabled && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">ساعة الفتح</label>
                    <input type="time" value={workHours.open} onChange={e => setWorkHours({ ...workHours, open: e.target.value })}
                      className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">ساعة الإغلاق</label>
                    <input type="time" value={workHours.close} onChange={e => setWorkHours({ ...workHours, close: e.target.value })}
                      className={inputClass} />
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end mt-6">
              <button onClick={handleSaveWorkHours} disabled={savingHours}
                className="flex items-center gap-2 bg-gradient-to-l from-primary-500 to-primary-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:shadow-glow-green disabled:opacity-50 transition-all">
                <Save size={14} /> {savingHours ? 'جاري الحفظ...' : 'حفظ ساعات العمل'}
              </button>
            </div>
          </div>

          <div className={sectionClass + ' p-6'}>
            <h3 className="font-semibold text-gray-800 mb-4">إعدادات النظام</h3>
            <div className="space-y-4">
              {settings.filter(s => s.key !== 'org_name' && s.key !== 'org_phone').map(s => (
                <div key={s.id} className="flex items-center gap-4 py-3 border-b border-gray-50 last:border-0">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700">{s.description ?? s.key}</p>
                    <p className="text-xs text-gray-400">{s.key}</p>
                  </div>
                  <input type="text" value={editValues[s.id] ?? ''} onChange={e => setEditValues({ ...editValues, [s.id]: e.target.value })}
                    className="w-48 p-2 border border-gray-200 rounded-lg text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary-500/20" dir="ltr" />
                  <button onClick={() => deleteSetting(s.id)} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} className="text-red-400" /></button>
                </div>
              ))}
              {settings.filter(s => s.key !== 'org_name' && s.key !== 'org_phone').length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">لا توجد إعدادات إضافية</p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Bag Offer Tab */}
      {activeTab === 'bag_offer' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-3xl">
          <div className={sectionClass + ' p-6'}>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-emerald-50 rounded-xl"><ShoppingBag size={20} className="text-emerald-600" /></div>
              <div>
                <h3 className="font-semibold text-gray-800">عرض شنطة Laundry Bag</h3>
                <p className="text-xs text-gray-400 mt-0.5">العرض اليومي اللي بيظهر للعملاء في الرئيسية</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-surface-muted/50 rounded-xl">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">تفعيل العرض</p>
                  <p className="text-xs text-gray-400">لو مطفي مش هيظهر للعملاء</p>
                </div>
                <button onClick={() => setBagOffer({ ...bagOffer, enabled: !bagOffer.enabled })}
                  className={`relative w-12 h-7 rounded-full transition-colors ${bagOffer.enabled ? 'bg-primary-500' : 'bg-gray-300'}`}>
                  <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all ${bagOffer.enabled ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">عنوان العرض</label>
                  <input type="text" value={bagOffer.title} onChange={e => setBagOffer({ ...bagOffer, title: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">نص الزر / البادج</label>
                  <input type="text" value={bagOffer.badge_text} onChange={e => setBagOffer({ ...bagOffer, badge_text: e.target.value })} className={inputClass} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">الوصف</label>
                <input type="text" value={bagOffer.subtitle} onChange={e => setBagOffer({ ...bagOffer, subtitle: e.target.value })} className={inputClass} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">السعر اليومي (ج.م)</label>
                  <input type="number" min={0} value={bagOffer.daily_price} onChange={e => setBagOffer({ ...bagOffer, daily_price: +e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">السعر قبل الخصم (ج.م)</label>
                  <input type="number" min={0} value={bagOffer.original_price} onChange={e => setBagOffer({ ...bagOffer, original_price: +e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">الحد الأقصى للقطع</label>
                  <input type="number" min={1} value={bagOffer.max_items} onChange={e => setBagOffer({ ...bagOffer, max_items: +e.target.value })} className={inputClass} />
                </div>
              </div>

              {/* Preview */}
              <div className="mt-6 p-4 bg-gray-900 rounded-2xl">
                <p className="text-[10px] text-gray-500 mb-3 uppercase tracking-wider">معاينة كما يظهر للعميل</p>
                <div className="bg-gradient-to-l from-emerald-600 to-emerald-700 rounded-2xl p-5 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-full">{bagOffer.badge_text}</span>
                    </div>
                    <p className="text-white font-bold text-lg">{bagOffer.title}</p>
                    <p className="text-emerald-100 text-xs mt-1">{bagOffer.subtitle}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-white/50 line-through text-sm">{bagOffer.original_price} ج.م</span>
                      <span className="text-white font-bold text-xl">{bagOffer.daily_price} ج.م</span>
                      <span className="text-emerald-200 text-xs">/ يومياً</span>
                    </div>
                  </div>
                  <span className="text-5xl">👜</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <button onClick={handleSaveBagOffer} disabled={savingBag}
                className="flex items-center gap-2 bg-gradient-to-l from-primary-500 to-primary-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:shadow-glow-green disabled:opacity-50 transition-all">
                <Save size={14} /> {savingBag ? 'جاري الحفظ...' : 'حفظ إعدادات العرض'}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Brand Color Tab */}
      {activeTab === 'brand' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-3xl">
          <div className={sectionClass + ' p-6'}>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-violet-50 rounded-xl"><Palette size={20} className="text-violet-600" /></div>
              <div>
                <h3 className="font-semibold text-gray-800">لون العلامة التجارية</h3>
                <p className="text-xs text-gray-400 mt-0.5">اللون الأساسي اللي هيظهر في تطبيق العميل — الأزرار والعناصر الرئيسية</p>
              </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {brandColors.map(c => (
                <button key={c.hex} onClick={() => setBrandColor(c.hex)}
                  className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${brandColor === c.hex ? 'border-gray-800 shadow-lg scale-105' : 'border-transparent hover:border-gray-200'}`}>
                  <div className="w-10 h-10 rounded-full shadow-md" style={{ backgroundColor: c.hex }} />
                  {brandColor === c.hex && (
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-gray-800 rounded-full flex items-center justify-center">
                      <Check size={12} className="text-white" />
                    </div>
                  )}
                  <span className="text-[11px] text-gray-600 font-medium text-center leading-tight">{c.name}</span>
                </button>
              ))}
            </div>

            {/* Preview */}
            <div className="mt-8 p-5 bg-gray-50 rounded-2xl">
              <p className="text-[10px] text-gray-400 mb-4 uppercase tracking-wider font-medium">معاينة اللون</p>
              <div className="flex flex-wrap items-center gap-3">
                <button className="px-6 py-2.5 rounded-xl text-white text-sm font-medium shadow-md" style={{ backgroundColor: brandColor }}>
                  زر رئيسي
                </button>
                <button className="px-6 py-2.5 rounded-xl text-sm font-medium border-2" style={{ borderColor: brandColor, color: brandColor }}>
                  زر ثانوي
                </button>
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ backgroundColor: brandColor + '15' }}>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: brandColor }} />
                  <span className="text-sm font-medium" style={{ color: brandColor }}>حالة نشطة</span>
                </div>
                <div className="h-8 w-32 rounded-lg" style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}cc)` }} />
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button onClick={handleSaveBrandColor} disabled={savingBrand}
                className="flex items-center gap-2 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:shadow-lg disabled:opacity-50 transition-all"
                style={{ background: `linear-gradient(to left, ${brandColor}, ${brandColor}dd)` }}>
                <Save size={14} /> {savingBrand ? 'جاري الحفظ...' : 'حفظ اللون'}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Subscriptions Tab */}
      {activeTab === 'subscriptions' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-3xl">
          <div className={sectionClass + ' p-6'}>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-purple-50 rounded-xl"><CreditCard size={20} className="text-purple-600" /></div>
              <div>
                <h3 className="font-semibold text-gray-800">نسب خصم فترات الاشتراك</h3>
                <p className="text-xs text-gray-400 mt-0.5">النسبة بتتطبق على السعر الشهري لحساب سعر الفترة</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-surface-muted/50 rounded-xl">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">شهري</p>
                  <p className="text-xs text-gray-400">السعر الأساسي بدون خصم</p>
                </div>
                <div className="w-24 text-center">
                  <span className="text-sm text-gray-500 font-medium">0%</span>
                </div>
              </div>
              {[
                { key: 'quarterly' as const, label: 'ربع سنوي', hint: '3 شهور', months: 3 },
                { key: 'biannual' as const, label: 'نصف سنوي', hint: '6 شهور', months: 6 },
                { key: 'annual' as const, label: 'سنوي', hint: '12 شهر', months: 12 },
              ].map(d => (
                <div key={d.key} className="flex items-center gap-4 p-4 bg-surface-muted/50 rounded-xl">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700">{d.label}</p>
                    <p className="text-xs text-gray-400">{d.hint} — مثال: باقة 200 ج.م/شهر = {Math.round(200 * d.months * (1 - Number(discounts[d.key]) / 100))} ج.م</p>
                  </div>
                  <div className="relative w-24">
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={discounts[d.key]}
                      onChange={e => setDiscounts({ ...discounts, [d.key]: e.target.value })}
                      className="w-full p-2 pr-8 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-6">
              <button onClick={handleSaveDiscounts} disabled={savingDiscounts}
                className="flex items-center gap-2 bg-gradient-to-l from-primary-500 to-primary-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:shadow-glow-green disabled:opacity-50 transition-all">
                <Save size={14} /> {savingDiscounts ? 'جاري الحفظ...' : 'حفظ نسب الخصم'}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && <UsersTab />}

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-3xl">
          {/* Avatar header */}
          <div className={sectionClass}>
            <div className="bg-gradient-to-l from-primary-500/10 via-accent-purple/5 to-transparent p-6">
              <div className="flex items-center gap-5">
                <div className="relative group">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-400 to-accent-purple/80 flex items-center justify-center text-white text-2xl font-bold shadow-premium-lg overflow-hidden">
                    {avatarUrl ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" /> : profile?.name?.[0] ?? '?'}
                  </div>
                  <button onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-all cursor-pointer">
                    <Camera size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                  {uploading && (
                    <div className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">{profile?.name}</h3>
                  <p className="text-sm text-gray-400">{userEmail}</p>
                  <p className="text-xs text-primary-500 mt-1 font-medium">{profile?.role === 'admin' ? 'مدير النظام' : profile?.role}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Personal info */}
          <div className={sectionClass}>
            <div className="px-6 py-4 border-b border-surface-border/60 flex items-center gap-2">
              <UserCircle size={16} className="text-primary-500" />
              <h3 className="font-semibold text-gray-800 text-sm">البيانات الشخصية</h3>
            </div>
            <form onSubmit={handleSaveProfile} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">الاسم</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} required className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">رقم الهاتف</label>
                  <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} placeholder="01xxxxxxxxx" />
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={savingProfile}
                  className="flex items-center gap-2 bg-gradient-to-l from-primary-500 to-primary-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:shadow-glow-green disabled:opacity-50 transition-all">
                  <Save size={14} /> {savingProfile ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
          </div>

          {/* Email change */}
          <div className={sectionClass}>
            <div className="px-6 py-4 border-b border-surface-border/60 flex items-center gap-2">
              <Mail size={16} className="text-blue-500" />
              <h3 className="font-semibold text-gray-800 text-sm">تغيير البريد الإلكتروني</h3>
            </div>
            <form onSubmit={handleChangeEmail} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">البريد الحالي</label>
                <input type="email" value={userEmail} disabled className={inputClass + ' bg-surface-muted/50 text-gray-400 cursor-not-allowed'} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">البريد الجديد</label>
                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required className={inputClass} />
              </div>
              <p className="text-[11px] text-gray-400">سيتم إرسال رابط تأكيد للإيميل الجديد لتفعيل التغيير</p>
              <div className="flex justify-end">
                <button type="submit" disabled={savingEmail || newEmail === userEmail}
                  className="flex items-center gap-2 bg-gradient-to-l from-blue-500 to-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:shadow-lg disabled:opacity-50 transition-all">
                  <Mail size={14} /> {savingEmail ? 'جاري الإرسال...' : 'تغيير الإيميل'}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-3xl">
          <div className={sectionClass}>
            <div className="px-6 py-4 border-b border-surface-border/60 flex items-center gap-2">
              <Lock size={16} className="text-amber-500" />
              <h3 className="font-semibold text-gray-800 text-sm">تغيير كلمة المرور</h3>
            </div>
            <form onSubmit={handleChangePassword} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">كلمة المرور الجديدة</label>
                <div className="relative">
                  <input type={showNew ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} className={inputClass + ' pl-10'} placeholder="6 أحرف على الأقل" />
                  <button type="button" onClick={() => setShowNew(!showNew)} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">تأكيد كلمة المرور</label>
                <div className="relative">
                  <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className={inputClass + ' pl-10'} />
                  {confirmPassword && confirmPassword === newPassword && <Check size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" />}
                </div>
                {confirmPassword && confirmPassword !== newPassword && <p className="text-[11px] text-red-400 mt-1">كلمة المرور غير متطابقة</p>}
              </div>
              {newPassword && (
                <div className="space-y-1.5">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map(i => {
                      const strength = newPassword.length >= 12 ? 4 : newPassword.length >= 8 ? 3 : newPassword.length >= 6 ? 2 : 1
                      return <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strength ? (strength >= 3 ? 'bg-emerald-400' : strength >= 2 ? 'bg-amber-400' : 'bg-red-400') : 'bg-gray-100'}`} />
                    })}
                  </div>
                  <p className="text-[10px] text-gray-400">{newPassword.length >= 12 ? 'قوية جداً' : newPassword.length >= 8 ? 'جيدة' : newPassword.length >= 6 ? 'مقبولة' : 'ضعيفة'}</p>
                </div>
              )}
              <div className="flex justify-end">
                <button type="submit" disabled={savingPassword || !newPassword || newPassword !== confirmPassword}
                  className="flex items-center gap-2 bg-gradient-to-l from-amber-500 to-amber-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:shadow-lg disabled:opacity-50 transition-all">
                  <Lock size={14} /> {savingPassword ? 'جاري التغيير...' : 'تغيير كلمة المرور'}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="إعداد جديد">
        <form onSubmit={handleAddSetting} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">المفتاح (Key)</label>
            <input type="text" value={newSetting.key} onChange={e => setNewSetting({ ...newSetting, key: e.target.value })} required dir="ltr"
              placeholder="e.g. delivery_fee" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">القيمة</label>
            <input type="text" value={newSetting.value} onChange={e => setNewSetting({ ...newSetting, value: e.target.value })} required dir="ltr" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">الوصف</label>
            <input type="text" value={newSetting.description} onChange={e => setNewSetting({ ...newSetting, description: e.target.value })}
              placeholder="وصف اختياري..." className={inputClass} />
          </div>
          <button type="submit" className="w-full bg-primary-500 text-white p-3 rounded-xl font-semibold hover:bg-primary-600 transition">إضافة الإعداد</button>
        </form>
      </Modal>
    </div>
    </PermissionGate>
  )
}
