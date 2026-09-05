import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { sendLocalNotification, playNotificationSound } from './useNotifications'

export function useRealtimeDriverOrders(driverId: string | undefined, onUpdate: () => void) {
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  const stableOnUpdate = useCallback(() => onUpdateRef.current(), [])

  useEffect(() => {
    if (!driverId) return

    const channel = supabase
      .channel('driver-orders')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          const isMyOrder = payload.new.driver_id === driverId
          const wasAssignedToMe = payload.new.driver_id === driverId && payload.old?.driver_id !== driverId

          if (wasAssignedToMe) {
            sendLocalNotification('طلب جديد! 📦', `تم تعيين طلب جديد رقم ${payload.new.order_number} لك`, 'new-order')
            playNotificationSound('new-order')
            stableOnUpdate()
            return
          }

          if (isMyOrder) {
            const newStatus = payload.new.status as string
            const oldStatus = payload.old?.status as string
            if (newStatus === 'ready' && oldStatus !== 'ready') {
              sendLocalNotification('طلب جاهز للتوصيل! 🚗', `الطلب رقم ${payload.new.order_number} جاهز — ابدأ التوصيل`, 'new-order')
              playNotificationSound('new-order')
            }
            stableOnUpdate()
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          if (payload.new.driver_id === driverId) {
            sendLocalNotification('طلب جديد! 📦', `طلب جديد رقم ${payload.new.order_number}`, 'new-order')
            playNotificationSound('new-order')
            stableOnUpdate()
          }
        }
      )
      .subscribe((status, err) => {
        if (err) console.warn('driver-orders realtime error:', err.message)
      })

    return () => { supabase.removeChannel(channel) }
  }, [driverId, stableOnUpdate])
}
