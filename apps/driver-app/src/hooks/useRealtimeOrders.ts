import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { sendLocalNotification, playNotificationSound } from './useNotifications'

export function useRealtimeDriverOrders(driverId: string | undefined, onUpdate: () => void) {
  useEffect(() => {
    if (!driverId) return

    const channel = supabase
      .channel('driver-orders')
      // 1) Status changes on MY orders (e.g. ready → loud alert)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `driver_id=eq.${driverId}`,
        },
        (payload) => {
          const newStatus = payload.new.status as string
          const oldStatus = payload.old?.status as string
          if (newStatus === 'ready' && oldStatus !== 'ready') {
            sendLocalNotification('طلب جاهز للتوصيل! 🚗', `الطلب رقم ${payload.new.order_number} جاهز — ابدأ التوصيل`, 'new-order')
            playNotificationSound('new-order')
            playNotificationSound('new-order')
          }
          onUpdate()
        }
      )
      // 2) New assignment via UPDATE (admin assigns driver_id)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          if (payload.new.driver_id === driverId && payload.old.driver_id !== driverId) {
            sendLocalNotification('طلب جديد! 📦', `تم تعيين طلب جديد رقم ${payload.new.order_number} لك`, 'new-order')
            playNotificationSound('new-order')
            onUpdate()
          }
        }
      )
      // 3) New assignment via INSERT (order created with driver_id already set)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          if (payload.new.driver_id === driverId) {
            sendLocalNotification('طلب جديد! 📦', `طلب جديد رقم ${payload.new.order_number}`, 'new-order')
            playNotificationSound('new-order')
            onUpdate()
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [driverId, onUpdate])
}
