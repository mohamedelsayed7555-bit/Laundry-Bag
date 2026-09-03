import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Linking } from 'react-native'
import { useRouter } from 'expo-router'
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated'
import { useAuth } from '../../src/contexts/AuthContext'
import { supabase } from '../../src/lib/supabase'
import { useRealtimeOrders } from '../../src/hooks/useRealtimeOrders'
import { colors } from '../../src/theme'
import { SkeletonOrderCard } from '../../src/components/Skeleton'
import { Phone, MessageCircle } from 'lucide-react-native'

const statusFlow = ['pending', 'assigned', 'picked_up', 'processing', 'ready', 'delivering', 'delivered']

const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'في الانتظار', color: '#f59e0b', icon: '⏳' },
  assigned: { label: 'تم تعيين سائق', color: '#3b82f6', icon: '🚗' },
  picked_up: { label: 'تم الاستلام', color: '#8b5cf6', icon: '📦' },
  processing: { label: 'جاري المعالجة', color: '#06b6d4', icon: '🔄' },
  ready: { label: 'جاهز للتوصيل', color: '#10b981', icon: '✅' },
  delivering: { label: 'جاري التوصيل', color: '#8b5cf6', icon: '🛵' },
  delivered: { label: 'تم التوصيل', color: '#10b981', icon: '🎉' },
  cancelled: { label: 'ملغي', color: '#ef4444', icon: '❌' },
}

const serviceLabel: Record<string, string> = {
  wash: 'غسيل', iron: 'كي', wash_iron: 'غسيل وكي', dry_clean: 'تنظيف جاف',
}

function OrderProgress({ status }: { status: string }) {
  if (status === 'cancelled' || status === 'delivered') return null
  const idx = statusFlow.indexOf(status)
  if (idx < 0) return null
  const progress = ((idx + 1) / statusFlow.length) * 100

  return (
    <View style={prog.container}>
      <View style={prog.track}>
        <View style={[prog.fill, { width: `${progress}%`, backgroundColor: statusConfig[status]?.color ?? colors.primary }]} />
      </View>
      <Text style={[prog.label, { color: statusConfig[status]?.color }]}>
        {idx + 1}/{statusFlow.length}
      </Text>
    </View>
  )
}

const prog = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  track: { flex: 1, height: 4, backgroundColor: colors.navy[700], borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
  label: { fontSize: 10, fontWeight: '700' },
})

export default function OrdersScreen() {
  const { profile } = useAuth()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const router = useRouter()
  const loadOrders = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, status, service_type, items_count, total, delivery_fee, cancellation_fee, notes, payment_status, subscription_id, created_at, driver:users!orders_driver_id_fkey(name, phone)')
      .eq('customer_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setOrders(data ?? [])
    setLoading(false)
    setRefreshing(false)
  }, [profile])

  useEffect(() => { loadOrders() }, [loadOrders])
  useRealtimeOrders(profile?.id, loadOrders)

  const onRefresh = () => { setRefreshing(true); loadOrders() }

  const renderOrder = ({ item, index }: { item: any; index: number }) => {
    const status = statusConfig[item.status] ?? statusConfig.pending
    const isActive = !['delivered', 'cancelled'].includes(item.status)

    return (
      <Animated.View entering={FadeInRight.duration(400).delay(index * 60)}>
        <TouchableOpacity
          style={[s.orderCard, isActive && s.orderCardActive]}
          activeOpacity={0.7}
          onPress={() => router.push(`/order/${item.id}`)}
        >
          {/* Header */}
          <View style={s.orderHeader}>
            <View>
              <Text style={s.orderNumber}>{item.order_number}</Text>
              <Text style={s.orderDate}>
                {new Date(item.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
              </Text>
            </View>
            <View style={[s.statusBadge, { backgroundColor: status.color + '18' }]}>
              <Text style={{ fontSize: 12 }}>{status.icon}</Text>
              <Text style={[s.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>

          {/* Progress bar */}
          <OrderProgress status={item.status} />

          {/* Details */}
          <View style={s.detailsRow}>
            <View style={s.detailItem}>
              <Text style={s.detailLabel}>الخدمة</Text>
              <Text style={s.detailValue}>{serviceLabel[item.service_type] ?? item.service_type}</Text>
            </View>
            <View style={s.detailItem}>
              <Text style={s.detailLabel}>القطع</Text>
              <Text style={s.detailValue}>{item.items_count}</Text>
            </View>
            <View style={s.detailItem}>
              <Text style={s.detailLabel}>المبلغ</Text>
              <Text style={[s.detailValue, { color: colors.primary, fontWeight: '800' }]}>{item.total?.toFixed(2)} ج.م</Text>
            </View>
          </View>

          {/* Cancellation fee */}
          {item.status === 'cancelled' && item.cancellation_fee > 0 && (
            <View style={s.cancelFeeRow}>
              <Text style={s.cancelFeeText}>💰 رسوم إلغاء: {Number(item.cancellation_fee).toFixed(2)} ج.م</Text>
            </View>
          )}

          {/* Driver info & actions */}
          {item.driver?.name && (
            <View style={s.driverSection}>
              <View style={s.driverInfo}>
                <View style={s.driverAvatar}>
                  <Text style={s.driverAvatarText}>{item.driver.name[0]}</Text>
                </View>
                <View>
                  <Text style={s.driverName}>{item.driver.name}</Text>
                  {item.driver.phone && <Text style={s.driverPhone}>{item.driver.phone}</Text>}
                </View>
              </View>
              {isActive && (
                <View style={s.contactActions}>
                  <TouchableOpacity style={s.contactBtn} onPress={() => router.push(`/chat/${item.id}`)}>
                    <MessageCircle size={16} color={colors.primary} />
                  </TouchableOpacity>
                  {item.driver.phone && (
                    <TouchableOpacity style={s.contactBtn} onPress={() => Linking.openURL(`tel:${item.driver.phone}`)}>
                      <Phone size={16} color={colors.accent} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    )
  }

  return (
    <View style={s.container}>
      <Animated.Text entering={FadeInDown.duration(500)} style={s.title}>طلباتي</Animated.Text>

      {loading ? (
        <View style={{ gap: 12 }}>
          <SkeletonOrderCard />
          <SkeletonOrderCard />
          <SkeletonOrderCard />
        </View>
      ) : orders.length === 0 ? (
        <Animated.View entering={FadeInDown.duration(500).delay(200)} style={s.emptyCard}>
          <Text style={s.emptyIcon}>📦</Text>
          <Text style={s.emptyText}>لا توجد طلبات حالياً</Text>
          <Text style={s.emptySubText}>ابدأ بإنشاء طلب جديد من الزر في الأسفل</Text>
          <TouchableOpacity style={s.emptyBtn} onPress={() => router.push('/(tabs)/new-order')}>
            <Text style={s.emptyBtnText}>طلب جديد</Text>
          </TouchableOpacity>
        </Animated.View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrder}
          keyExtractor={item => item.id}
          contentContainerStyle={{ gap: 12, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900], padding: 20, paddingTop: 56 },
  title: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 20 },

  orderCard: {
    backgroundColor: colors.navy[800], borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: colors.navy[700],
  },
  orderCardActive: {
    borderColor: colors.navy[600],
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderNumber: { fontSize: 16, fontWeight: '800', color: '#fff' },
  orderDate: { fontSize: 11, color: colors.navy[400], marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '700' },

  detailsRow: {
    flexDirection: 'row', marginTop: 14, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: colors.navy[700],
  },
  detailItem: { flex: 1, alignItems: 'center' },
  detailLabel: { fontSize: 11, color: colors.navy[400], marginBottom: 4 },
  detailValue: { fontSize: 13, color: '#fff', fontWeight: '600' },

  driverSection: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.navy[700],
  },
  driverInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  driverAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent + '30',
    justifyContent: 'center', alignItems: 'center',
  },
  driverAvatarText: { fontSize: 14, color: colors.accent, fontWeight: '700' },
  driverName: { fontSize: 13, color: '#fff', fontWeight: '600' },
  driverPhone: { fontSize: 11, color: colors.navy[300] },
  contactActions: { flexDirection: 'row', gap: 8 },
  contactBtn: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: colors.navy[700],
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.navy[600],
  },

  cancelFeeRow: {
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.navy[700],
    backgroundColor: '#ef444415', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  cancelFeeText: { fontSize: 12, color: '#ef4444', fontWeight: '600', textAlign: 'center' },

  emptyCard: {
    backgroundColor: colors.navy[800], borderRadius: 24, padding: 40,
    alignItems: 'center', borderWidth: 1, borderColor: colors.navy[700],
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: colors.navy[200], fontWeight: '600' },
  emptySubText: { fontSize: 13, color: colors.navy[400], marginTop: 6, textAlign: 'center' },
  emptyBtn: {
    backgroundColor: colors.primary, paddingHorizontal: 28, paddingVertical: 12,
    borderRadius: 14, marginTop: 20,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
