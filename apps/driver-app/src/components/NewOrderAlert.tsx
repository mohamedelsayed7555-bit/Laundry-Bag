import { useEffect, useCallback, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Vibration } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withRepeat, withSequence, withTiming } from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { playNotificationSound } from '../hooks/useNotifications'
import { colors } from '../theme'

type AlertData = {
  orderId: string
  orderNumber: string
  itemsCount: number
  total: number
  customerName: string
  isScheduled: boolean
  scheduledAt: string | null
}

export default function NewOrderAlert() {
  const { profile } = useAuth()
  const router = useRouter()
  const [alert, setAlert] = useState<AlertData | null>(null)
  const translateY = useSharedValue(-200)
  const pulse = useSharedValue(1)

  const showAlert = useCallback((data: AlertData) => {
    setAlert(data)
    translateY.value = withSpring(0, { damping: 12, stiffness: 100 })
    pulse.value = withRepeat(
      withSequence(withTiming(1.03, { duration: 600 }), withTiming(1, { duration: 600 })),
      5, true
    )
    Vibration.vibrate([0, 400, 200, 400, 200, 400])
    playNotificationSound('new-order')
  }, [])

  const dismissAlert = useCallback(() => {
    translateY.value = withTiming(-200, { duration: 300 })
    setTimeout(() => setAlert(null), 300)
  }, [])

  const goToOrders = useCallback(() => {
    dismissAlert()
    router.push('/(tabs)/orders')
  }, [dismissAlert, router])

  useEffect(() => {
    if (!profile?.id) return

    const channel = supabase
      .channel('new-order-alert')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          const isNewAssignment = payload.new.driver_id === profile.id && payload.old.driver_id !== profile.id
          const isDeliveryAssignment = payload.new.delivery_driver_id === profile.id && payload.old.delivery_driver_id !== profile.id
          if (isNewAssignment || isDeliveryAssignment) {
            supabase.from('orders')
              .select('id, order_number, items_count, total, is_scheduled, scheduled_at, customer:users!orders_customer_id_fkey(name)')
              .eq('id', payload.new.id)
              .single()
              .then(({ data }) => {
                if (data) {
                  showAlert({
                    orderId: data.id,
                    orderNumber: data.order_number,
                    itemsCount: data.items_count,
                    total: data.total,
                    customerName: (data.customer as any)?.name ?? 'عميل',
                    isScheduled: data.is_scheduled,
                    scheduledAt: data.scheduled_at,
                  })
                }
              })
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.id, showAlert])

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: pulse.value }],
  }))

  if (!alert) return null

  return (
    <Animated.View style={[s.container, animStyle]}>
      <View style={s.card}>
        <View style={s.header}>
          <Text style={s.bellIcon}>🔔</Text>
          <Text style={s.title}>طلب جديد!</Text>
          <TouchableOpacity onPress={dismissAlert} style={s.closeBtn}>
            <Text style={s.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={s.body}>
          <View style={s.row}>
            <Text style={s.label}>رقم الطلب</Text>
            <Text style={s.value}>{alert.orderNumber}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>العميل</Text>
            <Text style={s.value}>{alert.customerName}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>القطع</Text>
            <Text style={s.value}>{alert.itemsCount} قطعة</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>المبلغ</Text>
            <Text style={[s.value, { color: colors.primary }]}>{alert.total?.toFixed(2)} ج.م</Text>
          </View>
          {alert.isScheduled && alert.scheduledAt && (
            <View style={s.scheduleBadge}>
              <Text style={s.scheduleText}>
                🕐 موعد: {new Date(alert.scheduledAt).toLocaleDateString('ar-EG')} - {new Date(alert.scheduledAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity style={s.actionBtn} onPress={goToOrders} activeOpacity={0.8}>
          <Text style={s.actionText}>عرض الطلب</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  container: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9999,
    paddingTop: 50, paddingHorizontal: 16,
  },
  card: {
    backgroundColor: colors.navy[800], borderRadius: 20, padding: 20,
    borderWidth: 2, borderColor: colors.primary,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 20, elevation: 15,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 14,
  },
  bellIcon: { fontSize: 22, marginRight: 8 },
  title: { fontSize: 18, fontWeight: '800', color: '#fff', flex: 1 },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.navy[700],
    justifyContent: 'center', alignItems: 'center',
  },
  closeBtnText: { color: colors.navy[300], fontSize: 14, fontWeight: '700' },
  body: { gap: 8, marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 13, color: colors.navy[300] },
  value: { fontSize: 14, fontWeight: '700', color: '#fff' },
  scheduleBadge: {
    backgroundColor: '#f59e0b15', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, marginTop: 4,
    borderWidth: 1, borderColor: '#f59e0b30',
  },
  scheduleText: { fontSize: 12, color: '#f59e0b', fontWeight: '600', textAlign: 'center' },
  actionBtn: {
    backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center',
  },
  actionText: { fontSize: 16, fontWeight: '700', color: '#fff' },
})
