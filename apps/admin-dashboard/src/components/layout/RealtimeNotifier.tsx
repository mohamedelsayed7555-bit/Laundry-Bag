'use client'

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast'

type SoundKey = 'new_order' | 'new_subscription' | 'order_cancelled'

export default function RealtimeNotifier() {
  const { toast } = useToast()
  const mountedRef = useRef(false)
  const sounds = useRef<Partial<Record<SoundKey, HTMLAudioElement>>>({})
  const seen = useRef(new Set<string>())

  // Browsers block audio until the page has had a user interaction; the first click/key "unlocks" it
  // so sounds keep working afterwards, even while the tab is in the background.
  useEffect(() => {
    const keys: SoundKey[] = ['new_order', 'new_subscription', 'order_cancelled']
    for (const k of keys) {
      const a = new Audio(`/sounds/${k}.wav`)
      a.preload = 'auto'
      sounds.current[k] = a
    }
    const unlock = () => {
      for (const a of Object.values(sounds.current)) {
        if (!a) continue
        a.muted = true
        a.play().then(() => { a.pause(); a.currentTime = 0; a.muted = false }).catch(() => { a.muted = false })
      }
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  // Each event plays/toasts once, even if realtime delivers it again (e.g. later edits of a cancelled order).
  function once(key: string) {
    if (seen.current.has(key)) return false
    seen.current.add(key)
    return true
  }

  function play(k: SoundKey) {
    const a = sounds.current[k]
    if (!a) return
    try {
      a.currentTime = 0
      a.play().catch(() => {})
    } catch {}
  }

  useEffect(() => {
    mountedRef.current = true

    const channel = supabase.channel('dashboard-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        if (!mountedRef.current) return
        const order = payload.new as any
        if (!once(`order:${order.id}`)) return
        const isWalkin = order.notes?.includes('[من المحل]')
        play('new_order')
        toast(
          isWalkin ? `طلب جديد من المحل #${order.order_number ?? ''}` : `طلب جديد #${order.order_number ?? ''}`,
          'success'
        )
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: 'status=eq.cancelled' }, (payload) => {
        if (!mountedRef.current) return
        const order = payload.new as any
        if (!once(`cancel:${order.id}`)) return
        play('order_cancelled')
        toast(`تم إلغاء الطلب #${order.order_number ?? ''}`, 'warning')
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'subscriptions' }, (payload) => {
        if (!mountedRef.current) return
        const sub = payload.new as any
        if (!once(`sub:${sub.id}`)) return
        play('new_subscription')
        toast('طلب اشتراك جديد', 'success')
      })
      .subscribe((status, err) => {
        if (err) console.warn('dashboard-notifications realtime error:', err.message)
      })

    return () => {
      mountedRef.current = false
      supabase.removeChannel(channel)
    }
  }, [])

  return null
}
