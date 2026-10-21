'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Banknote, CreditCard, Landmark, Wallet, Loader2, Save } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

/**
 * Turning a payment method on or off.
 *
 * It exists so a provider that is not approved yet, is down, or has to be pulled is a
 * switch here rather than an app release waiting days on store review. The customer app
 * reads this list when the checkout screen opens, and the database refuses an order
 * carrying a method that is off — so an older build cannot get around it either.
 */

type Method = {
  code: string
  label_ar: string
  label_en: string
  /** Shown to the customer under the payment chips, so he knows what the method means. */
  note_ar?: string
  note_en?: string
  enabled: boolean
  sort: number
}

const ICONS: Record<string, typeof Banknote> = {
  cash: Banknote,
  visa: CreditCard,
  instapay: Landmark,
  e_wallet: Wallet,
}


export default function PaymentMethodsTab() {
  const { toast } = useToast()
  const [methods, setMethods] = useState<Method[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('settings').select('value').eq('key', 'payment_methods').maybeSingle()
    const list = Array.isArray(data?.value) ? (data!.value as Method[]) : []
    setMethods([...list].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)))
    setLoading(false)
  }

  const enabledCount = methods.filter(m => m.enabled).length

  function toggle(code: string) {
    const target = methods.find(m => m.code === code)
    // Closing the last one would leave customers unable to order at all.
    if (target?.enabled && enabledCount === 1) {
      toast('لازم تسيب وسيلة دفع واحدة شغالة على الأقل', 'warning')
      return
    }
    setMethods(prev => prev.map(m => m.code === code ? { ...m, enabled: !m.enabled } : m))
  }

  async function save() {
    setSaving(true)
    const { error } = await supabase.from('settings').update({ value: methods }).eq('key', 'payment_methods')
    setSaving(false)
    if (error) { toast('تعذّر الحفظ', 'error'); return }
    toast('اتحفظت — التغيير هيوصل العميل أول ما يفتح شاشة الدفع')
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-[13px] leading-relaxed text-sky-900">
        قفل أي وسيلة بيشتغل فوراً من غير إصدار جديد من التطبيق. العميل اللي فاتح التطبيق دلوقتي
        هيشوف التغيير أول ما يفتح شاشة الدفع، والطلبات والاشتراكات القديمة بتفضل زي ما هي.
        والسطر اللي تحت كل وسيلة هو نفسه اللي بيشوفه العميل في التطبيق.
      </div>

      <div className="space-y-2.5">
        {methods.map(m => {
          const Icon = ICONS[m.code] ?? Wallet
          return (
            <div
              key={m.code}
              className={`flex items-center gap-3.5 rounded-xl border p-4 transition-colors ${
                m.enabled ? 'border-surface-border bg-white' : 'border-surface-border/60 bg-surface-muted/40'
              }`}
            >
              <div className={`grid h-10 w-10 flex-none place-items-center rounded-xl ${
                m.enabled ? 'bg-primary-50 text-primary-600' : 'bg-surface-muted text-gray-400'
              }`}>
                <Icon size={18} />
              </div>

              <div className="min-w-0 flex-1">
                <div className={`text-sm font-semibold ${m.enabled ? 'text-gray-800' : 'text-gray-400'}`}>
                  {m.label_ar}
                </div>
                <div className="mt-0.5 text-[11.5px] leading-relaxed text-gray-400">
                  {m.note_ar || m.label_en}
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={m.enabled}
                aria-label={m.label_ar}
                onClick={() => toggle(m.code)}
                className={`relative h-6 w-11 flex-none rounded-full transition-colors ${
                  m.enabled ? 'bg-primary-500' : 'bg-gray-300'
                }`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  m.enabled ? 'start-[22px]' : 'start-0.5'
                }`} />
              </button>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-gray-400">
          {enabledCount} من {methods.length} وسائل مفعّلة
        </span>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-l from-primary-500 to-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-glow-green disabled:opacity-50"
        >
          <Save size={15} />
          {saving ? 'جاري الحفظ...' : 'حفظ'}
        </button>
      </div>
    </div>
  )
}
