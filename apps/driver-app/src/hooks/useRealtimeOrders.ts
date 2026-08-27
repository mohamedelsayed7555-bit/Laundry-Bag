import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { sendLocalNotification } from './useNotifications'

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
        () => onUpdate()
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
            sendLocalNotification('طلب جديد!', `تم تعيين طلب جديد رقم ${payload.new.order_number} لك`)
            onUpdate()
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [driverId, onUpdate])
}
