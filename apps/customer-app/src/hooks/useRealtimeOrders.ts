import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { notifyOrderStatus } from './useNotifications'
import { getCurrentLocale } from '../i18n'

// Same texts the server sends (public._order_status_text).
const statusMessages: Record<'ar' | 'en', Record<string, string>> = {
  ar: {
    assigned: 'تم تعيين سائق لطلبك',
    arrived: 'السائق وصل موقعك',
    picked_up: 'تم استلام ملابسك',
    processing: 'ملابسك قيد المعالجة',
    ready: 'ملابسك جاهزة للتوصيل!',
    delivering: 'السائق في طريقه إليك',
    delivered: 'تم توصيل طلبك بنجاح!',
    cancelled: 'تم إلغاء طلبك',
  },
  en: {
    assigned: 'A driver has been assigned to your order',
    arrived: 'Your driver has arrived',
    picked_up: 'Your clothes have been picked up',
    processing: 'Your clothes are being processed',
    ready: 'Your clothes are ready for delivery!',
    delivering: 'Your driver is on the way',
    delivered: 'Your order has been delivered!',
    cancelled: 'Your order has been cancelled',
  },
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
          const en = getCurrentLocale() === 'en'
          const message = statusMessages[en ? 'en' : 'ar'][newStatus]
          if (message) {
            // Home and Orders both listen; notifyOrderStatus shows it once (sound + vibration come from the channel).
            notifyOrderStatus(payload.new.id as string, newStatus, `${en ? 'Order' : 'طلب'} #${String(orderNumber ?? '').replace(/^#+/, '')}`, message)
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
