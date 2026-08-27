'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Settings, Save, Plus, Trash2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

export default function SettingsPage() {
  const [settings, setSettings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [orgName, setOrgName] = useState('CLEANO')
  const [orgPhone, setOrgPhone] = useState('+201000000000')
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [showAdd, setShowAdd] = useState(false)
  const [newSetting, setNewSetting] = useState({ key: '', value: '', description: '' })
  const { toast } = useToast()

  useEffect(() => { loadSettings() }, [])

  async function loadSettings() {
    const { data } = await supabase.from('settings').select('*').order('key')
    setSettings(data ?? [])
    const vals: Record<string, string> = {}
    data?.forEach(s => { vals[s.id] = typeof s.value === 'object' ? JSON.stringify(s.value) : String(s.value) })
    setEditValues(vals)
    const nameS = data?.find(s => s.key === 'org_name')
    const phoneS = data?.find(s => s.key === 'org_phone')
    if (nameS) setOrgName(String(nameS.value))
    if (phoneS) setOrgPhone(String(phoneS.value))
    setLoading(false)
  }

  async function handleSaveAll() {
    setSaving(true)
    const updates = settings.map(s => supabase.from('settings').update({ value: editValues[s.id] ?? s.value }).eq('id', s.id))
    await Promise.all(updates)

    const nameExists = settings.find(s => s.key === 'org_name')
    const phoneExists = settings.find(s => s.key === 'org_phone')
    if (nameExists) await supabase.from('settings').update({ value: orgName }).eq('id', nameExists.id)
    else await supabase.from('settings').upsert({ key: 'org_name', value: orgName, description: 'اسم المؤسسة' })
    if (phoneExists) await supabase.from('settings').update({ value: orgPhone }).eq('id', phoneExists.id)
    else await supabase.from('settings').upsert({ key: 'org_phone', value: orgPhone, description: 'رقم هاتف المؤسسة' })

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    loadSettings()
    toast('تم حفظ الإعدادات بنجاح')
  }

  async function handleAddSetting(e: React.FormEvent) {
    e.preventDefault()
    await supabase.from('settings').insert({ key: newSetting.key, value: newSetting.value, description: newSetting.description || null })
    setShowAdd(false)
    setNewSetting({ key: '', value: '', description: '' })
    loadSettings()
    toast('تم إضافة الإعداد')
  }

  async function deleteSetting(id: string) {
    await supabase.from('settings').delete().eq('id', id)
    loadSettings()
    toast('تم حذف الإعداد')
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-gray-800">الإعدادات</h2><p className="text-sm text-gray-400">إعدادات المنصة العامة</p></div>
        <div className="flex gap-2">
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
            <Plus size={16} /> إعداد جديد
          </button>
          <button onClick={handleSaveAll} disabled={saving}
            className="flex items-center gap-2 bg-primary-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-600 disabled:opacity-50 transition shadow-lg shadow-primary-500/25">
            <Save size={16} /> {saving ? 'جاري الحفظ...' : saved ? 'تم الحفظ!' : 'حفظ الكل'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-navy-50 rounded-xl"><Settings size={20} className="text-navy-600" /></div>
          <h3 className="font-semibold text-gray-800">معلومات المؤسسة</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">اسم المؤسسة</label>
            <input type="text" value={orgName} onChange={e => setOrgName(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">رقم الهاتف</label>
            <input type="text" value={orgPhone} onChange={e => setOrgPhone(e.target.value)} dir="ltr"
              className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
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
              <button onClick={() => deleteSetting(s.id)} className="p-1.5 hover:bg-red-50 rounded-lg transition"><Trash2 size={14} className="text-red-400" /></button>
            </div>
          ))}
          {settings.filter(s => s.key !== 'org_name' && s.key !== 'org_phone').length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">لا توجد إعدادات إضافية</p>
          )}
        </div>
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="إعداد جديد">
        <form onSubmit={handleAddSetting} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">المفتاح (Key)</label>
            <input type="text" value={newSetting.key} onChange={e => setNewSetting({ ...newSetting, key: e.target.value })} required dir="ltr"
              placeholder="e.g. delivery_fee" className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">القيمة</label>
            <input type="text" value={newSetting.value} onChange={e => setNewSetting({ ...newSetting, value: e.target.value })} required dir="ltr"
              className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">الوصف</label>
            <input type="text" value={newSetting.description} onChange={e => setNewSetting({ ...newSetting, description: e.target.value })}
              placeholder="وصف اختياري..." className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
          </div>
          <button type="submit" className="w-full bg-primary-500 text-white p-3 rounded-xl font-semibold hover:bg-primary-600 transition">إضافة الإعداد</button>
        </form>
      </Modal>
    </div>
  )
}
