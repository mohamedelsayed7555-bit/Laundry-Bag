import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { sendLocalNotification, playNotificationSound } from './useNotifications'

export function useRealtimeDriverOrders(driverId: string | undefined, onUpdate: () => void) {
  useEffect(() => {
    if (!driverId) return

    const channel = supabase
      .channel('driver-orders')
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
          }
          onUpdate()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          if (payload.new.driver_id === driverId && payload.old.driver_id !== driverId) {
            sendLocalNotification('طلب جديد!', `تم تعيين طلب جديد رقم ${payload.new.order_number} لك`, 'new-order')
            onUpdate()
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [driverId, onUpdate])
}
