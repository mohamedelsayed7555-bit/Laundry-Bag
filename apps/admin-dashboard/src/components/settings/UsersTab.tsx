'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { motion } from 'framer-motion'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import {
  Users, Plus, Edit2, Power, Shield, ShieldCheck, ShieldAlert,
  Truck, UserCircle, Save, Search, Eye, EyeOff, Camera, Key, Mail,
} from 'lucide-react'
import Tooltip from '@/components/ui/Tooltip'

interface SystemUser {
  id: string
  name: string
  email: string
  phone: string | null
  role: string
  is_active: boolean
  created_at: string
  permissions: string[] | null
  avatar_url: string | null
}

const roleConfig: Record<string, { label: string; icon: typeof Shield; variant: 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral'; color: string }> = {
  super_admin: { label: 'مدير عام', icon: ShieldAlert, variant: 'danger', color: 'text-red-500' },
  admin: { label: 'مدير', icon: ShieldCheck, variant: 'purple', color: 'text-purple-500' },
  manager: { label: 'مشرف', icon: Shield, variant: 'info', color: 'text-blue-500' },
  accountant: { label: 'محاسب', icon: UserCircle, variant: 'warning', color: 'text-amber-500' },
  driver: { label: 'سائق', icon: Truck, variant: 'success', color: 'text-emerald-500' },
  customer: { label: 'عميل', icon: UserCircle, variant: 'neutral', color: 'text-gray-500' },
}

const availablePermissions = [
  { key: 'orders.view', label: 'عرض الطلبات' },
  { key: 'orders.create', label: 'إنشاء طلبات' },
  { key: 'orders.edit', label: 'تعديل الطلبات' },
  { key: 'orders.delete', label: 'حذف الطلبات' },
  { key: 'orders.assign', label: 'تعيين سائقين' },
  { key: 'customers.view', label: 'عرض العملاء' },
  { key: 'customers.create', label: 'إضافة عملاء' },
  { key: 'customers.edit', label: 'تعديل العملاء' },
  { key: 'customers.delete', label: 'حذف العملاء' },
  { key: 'drivers.view', label: 'عرض السائقين' },
  { key: 'drivers.create', label: 'إضافة سائقين' },
  { key: 'drivers.edit', label: 'تعديل السائقين' },
  { key: 'drivers.delete', label: 'حذف السائقين' },
  { key: 'prices.view', label: 'عرض الأسعار' },
  { key: 'prices.create', label: 'إضافة أسعار' },
  { key: 'prices.edit', label: 'تعديل الأسعار' },
  { key: 'prices.delete', label: 'حذف الأسعار' },
  { key: 'plans.view', label: 'عرض الباقات' },
  { key: 'plans.create', label: 'إنشاء باقات' },
  { key: 'plans.edit', label: 'تعديل الباقات' },
  { key: 'plans.delete', label: 'حذف الباقات' },
  { key: 'subscriptions.view', label: 'عرض الاشتراكات' },
  { key: 'subscriptions.create', label: 'إنشاء اشتراكات' },
  { key: 'subscriptions.edit', label: 'تعديل الاشتراكات' },
  { key: 'subscriptions.delete', label: 'حذف الاشتراكات' },
  { key: 'branches.view', label: 'عرض الفروع' },
  { key: 'branches.create', label: 'إضافة فروع' },
  { key: 'branches.edit', label: 'تعديل الفروع' },
  { key: 'branches.delete', label: 'حذف الفروع' },
  { key: 'inventory.view', label: 'عرض المخزون' },
  { key: 'inventory.create', label: 'إضافة للمخزون' },
  { key: 'inventory.edit', label: 'تعديل المخزون' },
  { key: 'inventory.delete', label: 'حذف من المخزون' },
  { key: 'finance.view', label: 'عرض المالية' },
  { key: 'finance.edit', label: 'تعديل المالية' },
  { key: 'finance.export', label: 'تصدير المالية' },
  { key: 'reports.view', label: 'عرض التقارير' },
  { key: 'reports.export', label: 'تصدير التقارير' },
  { key: 'settings.view', label: 'عرض الإعدادات' },
  { key: 'settings.edit', label: 'تعديل الإعدادات' },
  { key: 'users.view', label: 'عرض المستخدمين' },
  { key: 'users.create', label: 'إضافة مستخدمين' },
  { key: 'users.edit', label: 'تعديل المستخدمين' },
  { key: 'users.delete', label: 'حذف المستخدمين' },
  { key: 'notifications.view', label: 'عرض الإشعارات' },
  { key: 'notifications.create', label: 'إرسال إشعارات' },
  { key: 'notifications.delete', label: 'حذف الإشعارات' },
  { key: 'ratings.view', label: 'عرض التقييمات' },
  { key: 'ratings.delete', label: 'حذف التقييمات' },
  { key: 'audit.view', label: 'عرض سجل النشاطات' },
]

const roleDefaults: Record<string, string[]> = {
  super_admin: availablePermissions.map(p => p.key),
  admin: availablePermissions.map(p => p.key),
  manager: [
    'orders.view', 'orders.create', 'orders.edit', 'orders.assign',
    'customers.view', 'customers.create', 'customers.edit',
    'drivers.view', 'drivers.create', 'drivers.edit',
    'prices.view',
    'branches.view',
    'inventory.view',
    'subscriptions.view',
    'notifications.view', 'notifications.create',
    'ratings.view',
    'reports.view',
    'finance.view',
  ],
  accountant: [
    'orders.view',
    'customers.view',
    'finance.view', 'finance.edit', 'finance.export',
    'prices.view', 'prices.edit',
    'reports.view', 'reports.export',
    'subscriptions.view',
  ],
  driver: ['orders.view'],
  customer: [],
}

const emptyForm = { name: '', email: '', password: '', phone: '', role: 'manager', permissions: [] as string[] }

export default function UsersTab() {
  const [users, setUsers] = useState<SystemUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [editUser, setEditUser] = useState<SystemUser | null>(null)
  const [showPermissions, setShowPermissions] = useState<SystemUser | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    const { data } = await supabase
      .from('users')
      .select('*')
      .in('role', ['admin', 'super_admin', 'manager', 'accountant'])
      .order('created_at')
    setUsers(data ?? [])
    setLoading(false)
  }

  function openAdd() {
    setForm(emptyForm)
    setAvatarFile(null)
    setAvatarPreview(null)
    setShowAdd(true)
  }

  function openEdit(user: SystemUser) {
    setForm({
      name: user.name, email: user.email, password: '', phone: user.phone || '',
      role: user.role, permissions: user.permissions || roleDefaults[user.role] || [],
    })
    setAvatarFile(null)
    setAvatarPreview(user.avatar_url || null)
    setEditUser(user)
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast('حجم الصورة يجب أن يكون أقل من 2MB', 'warning'); return }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  async function uploadAvatar(userId: string): Promise<string | null> {
    if (!avatarFile) return null
    const ext = avatarFile.name.split('.').pop()
    const path = `${userId}.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true })
    if (error) { console.error('Avatar upload error:', error); return null }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    return data.publicUrl + '?t=' + Date.now()
  }

  function openPermissions(user: SystemUser) {
    setForm(f => ({ ...f, permissions: user.permissions || roleDefaults[user.role] || [], role: user.role }))
    setShowPermissions(user)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    if (editUser) {
      const update: any = { name: form.name, phone: form.phone || null, role: form.role, permissions: form.permissions }

      const avatarUrl = await uploadAvatar(editUser.id)
      if (avatarUrl) update.avatar_url = avatarUrl

      const emailChanged = form.email !== editUser.email
      const passwordChanged = form.password.length > 0

      if (emailChanged || passwordChanged) {
        const authUpdate: any = { userId: editUser.id }
        if (emailChanged) authUpdate.email = form.email
        if (passwordChanged) authUpdate.password = form.password
        const res = await fetch('/api/update-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(authUpdate),
        })
        const result = await res.json()
        if (result.error) { setSaving(false); toast(result.error, 'error'); return }
        if (result.emailPending) toast('تم إرسال رابط تأكيد للبريد الجديد — الإيميل مش هيتغير غير لما المستخدم يأكد', 'warning')
      }

      const { error } = await supabase.from('users').update(update).eq('id', editUser.id)
      setSaving(false)
      if (!error) { setEditUser(null); loadUsers(); toast('تم تعديل المستخدم') }
      else { toast('حدث خطأ', 'error'); console.error(error) }
    } else {
      if (!form.password || form.password.length < 6) { setSaving(false); return toast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'warning') }

      const res = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, password: form.password, name: form.name, phone: form.phone, role: form.role, permissions: form.permissions }),
      })
      const result = await res.json()

      if (result.error) {
        setSaving(false)
        toast(result.error, 'error')
      } else {
        if (avatarFile && result.id) {
          const avatarUrl = await uploadAvatar(result.id)
          if (avatarUrl) await supabase.from('users').update({ avatar_url: avatarUrl }).eq('id', result.id)
        }
        setSaving(false)
        setShowAdd(false)
        setForm(emptyForm)
        loadUsers()
        toast('تم إنشاء المستخدم بنجاح')
      }
    }
  }

  async function handleSavePermissions() {
    if (!showPermissions) return
    setSaving(true)
    const { error } = await supabase.from('users').update({ permissions: form.permissions }).eq('id', showPermissions.id)
    setSaving(false)
    if (!error) { setShowPermissions(null); loadUsers(); toast('تم تحديث الصلاحيات') }
    else toast('حدث خطأ', 'error')
  }

  async function toggleActive(user: SystemUser) {
    const { error } = await supabase.from('users').update({ is_active: !user.is_active }).eq('id', user.id)
    if (error) { console.error('toggleActive error:', error); toast('حدث خطأ: ' + error.message); return }
    loadUsers()
    toast(user.is_active ? 'تم تعطيل المستخدم' : 'تم تفعيل المستخدم')
  }

  function togglePermission(key: string) {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(key)
        ? f.permissions.filter(p => p !== key)
        : [...f.permissions, key],
    }))
  }

  function applyRoleDefaults(role: string) {
    setForm(f => ({ ...f, role, permissions: roleDefaults[role] || [] }))
  }

  const filtered = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false
    if (search) {
      const s = search.toLowerCase()
      if (!u.name?.toLowerCase().includes(s) && !u.email?.toLowerCase().includes(s)) return false
    }
    return true
  })

  const inputClass = 'w-full p-3 border border-surface-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-500/30 transition-all'
  const sectionClass = 'bg-white rounded-2xl shadow-premium border border-surface-border/60 overflow-hidden'

  const permissionGroups = [
    { label: 'الطلبات', keys: availablePermissions.filter(p => p.key.startsWith('orders.')) },
    { label: 'العملاء', keys: availablePermissions.filter(p => p.key.startsWith('customers.')) },
    { label: 'السائقين', keys: availablePermissions.filter(p => p.key.startsWith('drivers.')) },
    { label: 'الأسعار', keys: availablePermissions.filter(p => p.key.startsWith('prices.')) },
    { label: 'الباقات', keys: availablePermissions.filter(p => p.key.startsWith('plans.')) },
    { label: 'الاشتراكات', keys: availablePermissions.filter(p => p.key.startsWith('subscriptions.')) },
    { label: 'الفروع', keys: availablePermissions.filter(p => p.key.startsWith('branches.')) },
    { label: 'المخزون', keys: availablePermissions.filter(p => p.key.startsWith('inventory.')) },
    { label: 'المالية', keys: availablePermissions.filter(p => p.key.startsWith('finance.')) },
    { label: 'التقارير', keys: availablePermissions.filter(p => p.key.startsWith('reports.')) },
    { label: 'الإشعارات', keys: availablePermissions.filter(p => p.key.startsWith('notifications.')) },
    { label: 'التقييمات', keys: availablePermissions.filter(p => p.key.startsWith('ratings.')) },
    { label: 'النظام', keys: availablePermissions.filter(p => p.key.startsWith('settings.') || p.key.startsWith('users.') || p.key === 'audit.view') },
  ]

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-7 h-7 border-[3px] border-primary-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{users.length} مستخدم نظام</p>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-gradient-to-l from-primary-500 to-primary-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:shadow-glow-green transition-all">
          <Plus size={16} /> مستخدم جديد
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="بحث بالاسم أو الإيميل..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pr-10 pl-4 py-2.5 bg-white border border-surface-border/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/15 transition-all" />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className="px-3 py-2.5 bg-white border border-surface-border/60 rounded-xl text-sm focus:outline-none transition-all">
          <option value="all">كل الأدوار</option>
          <option value="super_admin">مدير عام</option>
          <option value="admin">مدير</option>
          <option value="manager">مشرف</option>
          <option value="accountant">محاسب</option>
        </select>
      </div>

      {/* Users list */}
      <div className={sectionClass}>
        <div className="divide-y divide-surface-border/40">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Users size={32} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm">لا يوجد مستخدمين</p>
            </div>
          ) : filtered.map((user, i) => {
            const rc = roleConfig[user.role] || roleConfig.admin
            const RoleIcon = rc.icon
            return (
              <motion.div key={user.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                className={`flex items-center gap-4 px-5 py-4 hover:bg-surface-muted/30 transition-colors ${!user.is_active ? 'opacity-50' : ''}`}>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-accent-purple/80 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    user.name?.[0] ?? '?'
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-sm text-gray-800">{user.name}</span>
                    <Badge variant={rc.variant}><RoleIcon size={10} className="ml-1" />{rc.label}</Badge>
                    {!user.is_active && <Badge variant="danger">معطّل</Badge>}
                  </div>
                  <p className="text-xs text-gray-400">{user.email} {user.phone ? `• ${user.phone}` : ''}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Tooltip content="الصلاحيات">
                    <button onClick={() => openPermissions(user)} className="p-1.5 rounded-lg hover:bg-surface-muted transition-colors">
                      <Shield size={14} className="text-gray-400 hover:text-purple-500" />
                    </button>
                  </Tooltip>
                  <Tooltip content="تعديل">
                    <button onClick={() => openEdit(user)} className="p-1.5 rounded-lg hover:bg-surface-muted transition-colors">
                      <Edit2 size={14} className="text-gray-400 hover:text-blue-500" />
                    </button>
                  </Tooltip>
                  <Tooltip content={user.is_active ? 'تعطيل الحساب' : 'تفعيل الحساب'}>
                    <button onClick={() => toggleActive(user)} className="p-1.5 rounded-lg hover:bg-surface-muted transition-colors">
                      <Power size={14} className={user.is_active ? 'text-emerald-400 hover:text-red-400' : 'text-gray-300 hover:text-emerald-400'} />
                    </button>
                  </Tooltip>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal open={showAdd || !!editUser} onClose={() => { setShowAdd(false); setEditUser(null) }} title={editUser ? 'تعديل مستخدم' : 'مستخدم جديد'}>
        <form onSubmit={handleSave} className="space-y-4" autoComplete="off">
          <div className="flex justify-center">
            <label className="relative cursor-pointer group">
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-primary-400 to-accent-purple/80 flex items-center justify-center text-white font-bold text-2xl">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  form.name?.[0] ?? '?'
                )}
              </div>
              <div className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera size={20} className="text-white" />
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </label>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">الاسم <span className="text-red-400">*</span></label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">البريد الإلكتروني <span className="text-red-400">*</span></label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required className={inputClass} autoComplete="new-email" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">{editUser ? 'كلمة المرور الجديدة' : 'كلمة المرور'} {!editUser && <span className="text-red-400">*</span>}</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} {...(!editUser ? { required: true } : {})} minLength={6}
                className={inputClass + ' pl-10'} placeholder={editUser ? 'اتركها فارغة إن لم ترد التغيير' : '6 أحرف على الأقل'} autoComplete="new-password" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">رقم الهاتف</label>
            <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className={inputClass} placeholder="اختياري" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">الدور <span className="text-red-400">*</span></label>
            <select value={form.role} onChange={e => applyRoleDefaults(e.target.value)} className={inputClass}>
              <option value="super_admin">مدير عام — كل الصلاحيات</option>
              <option value="admin">مدير — كل الصلاحيات</option>
              <option value="manager">مشرف — صلاحيات تشغيلية</option>
              <option value="accountant">محاسب — صلاحيات مالية</option>
            </select>
          </div>

          {/* Quick permissions preview */}
          <div className="border-t border-surface-border/60 pt-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase mb-2">الصلاحيات ({form.permissions.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {form.permissions.slice(0, 8).map(p => {
                const perm = availablePermissions.find(ap => ap.key === p)
                return <span key={p} className="text-[10px] bg-primary-500/10 text-primary-600 px-2 py-0.5 rounded-full">{perm?.label || p}</span>
              })}
              {form.permissions.length > 8 && <span className="text-[10px] text-gray-400">+{form.permissions.length - 8} أخرى</span>}
            </div>
          </div>

          <button type="submit" disabled={saving}
            className="w-full bg-gradient-to-l from-primary-500 to-primary-600 text-white p-3 rounded-xl font-semibold hover:shadow-glow-green disabled:opacity-50 transition-all">
            {saving ? 'جاري الحفظ...' : editUser ? 'حفظ التعديلات' : 'إنشاء المستخدم'}
          </button>
        </form>
      </Modal>

      {/* Permissions Modal */}
      <Modal open={!!showPermissions} onClose={() => setShowPermissions(null)} title={`صلاحيات: ${showPermissions?.name || ''}`}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">اختر الصلاحيات المطلوبة</p>
            <div className="flex gap-1.5">
              <button onClick={() => setForm(f => ({ ...f, permissions: availablePermissions.map(p => p.key) }))}
                className="text-[10px] text-primary-500 font-medium hover:underline">تحديد الكل</button>
              <span className="text-gray-300">|</span>
              <button onClick={() => setForm(f => ({ ...f, permissions: [] }))}
                className="text-[10px] text-red-400 font-medium hover:underline">إلغاء الكل</button>
            </div>
          </div>

          <div className="space-y-4 max-h-80 overflow-y-auto">
            {permissionGroups.map(group => (
              <div key={group.label}>
                <p className="text-xs font-semibold text-gray-600 mb-2">{group.label}</p>
                <div className="grid grid-cols-2 gap-2">
                  {group.keys.map(p => (
                    <label key={p.key} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-surface-muted/50 transition-colors">
                      <input type="checkbox" checked={form.permissions.includes(p.key)} onChange={() => togglePermission(p.key)}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-primary-500 focus:ring-primary-500" />
                      <span className="text-xs text-gray-700">{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button onClick={handleSavePermissions} disabled={saving}
            className="w-full bg-gradient-to-l from-purple-500 to-purple-600 text-white p-3 rounded-xl font-semibold hover:shadow-lg disabled:opacity-50 transition-all">
            {saving ? 'جاري الحفظ...' : 'حفظ الصلاحيات'}
          </button>
        </div>
      </Modal>
    </motion.div>
  )
}
