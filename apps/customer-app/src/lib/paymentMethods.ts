import { useEffect, useState } from 'react'
import { supabase } from './supabase'

/**
 * Which payment methods the customer may use, read from the dashboard rather than
 * hard-coded in the app.
 *
 * It exists for one reason: when a card provider is not approved yet, goes down, or has
 * to be pulled, that has to be a switch — not an app release waiting on store review.
 * The list is read when the checkout screen opens; a change reaches a customer the next
 * time he opens it, which is soon enough and avoids a realtime subscription per screen.
 */

export type PaymentMethod = {
  code: string
  label_ar: string
  label_en: string
  /** One line under the chips telling the customer what paying this way actually means. */
  note_ar?: string
  note_en?: string
  enabled: boolean
  sort: number
}

const SETTINGS_KEY = 'payment_methods'

/**
 * Used when the settings row is missing or unreadable. Cash always works — it needs no
 * provider — so a network problem can never leave a customer unable to order.
 */
const FALLBACK: PaymentMethod[] = [
  { code: 'cash', label_ar: 'كاش', label_en: 'Cash', note_ar: 'بتدفع للمندوب وقت الاستلام.', note_en: 'Pay the driver on pickup.', enabled: true, sort: 1 },
]

export async function fetchPaymentMethods(): Promise<PaymentMethod[]> {
  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle()

    const list = Array.isArray(data?.value) ? (data!.value as PaymentMethod[]) : []
    const enabled = list
      .filter(m => m && m.enabled && typeof m.code === 'string')
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))

    return enabled.length > 0 ? enabled : FALLBACK
  } catch {
    return FALLBACK
  }
}

/**
 * Returns the enabled methods and keeps the current selection valid: if the selected
 * method was switched off while the customer was elsewhere in the app, the selection
 * moves to the first one that still works instead of failing at checkout.
 */
export function usePaymentMethods(selected: string, onSelect: (code: string) => void) {
  const [methods, setMethods] = useState<PaymentMethod[]>(FALLBACK)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetchPaymentMethods().then(list => {
      if (!alive) return
      setMethods(list)
      setLoading(false)
      if (!list.some(m => m.code === selected)) {
        onSelect(list[0].code)
      }
    })
    return () => { alive = false }
  }, [])

  return { methods, loading }
}

/**
 * The subscription screen's view of the same list.
 *
 * Two differences, both deliberate: a plan is paid up front so cash is not offered, and
 * that screen has always called the wallet 'wallet' where orders call it 'e_wallet'.
 * Renaming the code would orphan existing subscription rows, so it is translated here
 * and the database check treats the two as one method.
 */
export function useSubscriptionPaymentMethods(selected: string, onSelect: (code: string) => void) {
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetchPaymentMethods().then(list => {
      if (!alive) return
      const forPlans = list
        .filter(m => m.code !== 'cash')
        .map(m => (m.code === 'e_wallet' ? { ...m, code: 'wallet' } : m))
      setMethods(forPlans)
      setLoading(false)
      if (forPlans.length > 0 && !forPlans.some(m => m.code === selected)) {
        onSelect(forPlans[0].code)
      }
    })
    return () => { alive = false }
  }, [])

  return { methods, loading }
}

/** The explanatory line for whichever method is selected, in the current language. */
export function noteFor(methods: PaymentMethod[], code: string, isEn: boolean): string | null {
  const m = methods.find(x => x.code === code)
  const note = isEn ? m?.note_en : m?.note_ar
  return note && note.trim() ? note : null
}
