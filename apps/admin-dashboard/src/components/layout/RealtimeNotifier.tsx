'use client'

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast'

export default function RealtimeNotifier() {
  const { toast } = useToast()
  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true

    const channel = supabase.channel('dashboard-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        if (!mountedRef.current) return
        const order = payload.new as any
        const isWalkin = order.notes?.includes('[من المحل]')
        toast(
          isWalkin ? `طلب جديد من المحل #${order.order_number ?? ''}` : `طلب جديد #${order.order_number ?? ''}`,
          'success'
        )
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: 'status=eq.cancelled' }, (payload) => {
        if (!mountedRef.current) return
        toast(`تم إلغاء الطلب #${(payload.new as any).order_number ?? ''}`, 'warning')
      })
      .subscribe()

    return () => {
      mountedRef.current = false
      supabase.removeChannel(channel)
    }
  }, [])

  return null
}
