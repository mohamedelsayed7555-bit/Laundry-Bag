import { useEffect } from 'react'
import { Vibration } from 'react-native'
import { supabase } from '../lib/supabase'
import { sendLocalNotification, playNotificationSound } from './useNotifications'

const statusMessages: Record<string, string> = {
  assigned: 'تم تعيين سائق لطلبك',
  picked_up: 'تم استلام ملابسك من السائق',
  processing: 'ملابسك قيد المعالجة الآن',
  ready: 'ملابسك جاهزة للتوصيل!',
  delivering: 'السائق في طريقه إليك',
  delivered: 'تم توصيل طلبك بنجاح!',
  cancelled: 'تم إلغاء طلبك',
}

let channelCounter = 0

export function useRealtimeOrders(userId: string | undefined, onUpdate: () => void) {
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`customer-orders-${++channelCounter}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `customer_id=eq.${userId}`,
        },
        (payload) => {
          const newStatus = payload.new.status as string
          const orderNumber = payload.new.order_number as string
          const message = statusMessages[newStatus]
          if (message) {
            sendLocalNotification(`طلب ${orderNumber}`, message, 'order-updates')
            playNotificationSound('order-update')
            Vibration.vibrate(400)
          }
          onUpdate()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `customer_id=eq.${userId}`,
        },
        () => onUpdate()
      )
      .subscribe((status, err) => {
        if (err) console.warn('customer-orders realtime error:', err.message)
      })

    return () => { supabase.removeChannel(channel) }
  }, [userId, onUpdate])
}
