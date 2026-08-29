import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, Linking } from 'react-native'
import { useRouter } from 'expo-router'
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated'
import { useAuth } from '../../src/contexts/AuthContext'
import { supabase } from '../../src/lib/supabase'
import { useRealtimeDriverOrders } from '../../src/hooks/useRealtimeOrders'
import { colors } from '../../src/theme'
import { SkeletonOrderCard } from '../../src/components/Skeleton'

const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
  assigned: { label: 'بانتظار الاستلام', color: '#3b82f6', icon: '📋' },
  picked_up: { label: 'تم الاستلام', color: '#8b5cf6', icon: '📦' },
  processing: { label: 'جاري المعالجة', color: '#06b6d4', icon: '🔄' },
  ready: { label: 'جاهز للتوصيل', color: '#10b981', icon: '✅' },
  delivering: { label: 'جاري التوصيل', color: '#f59e0b', icon: '🛵' },
  delivered: { label: 'تم التوصيل', color: '#10b981', icon: '🎉' },
}

const nextAction: Record<string, { status: string; label: string }> = {
  assigned: { status: 'picked_up', label: 'تأكيد الاستلام من العميل' },
  picked_up: { status: 'processing', label: 'وصلت للمغسلة' },
  processing: { status: 'ready', label: 'الطلب جاهز' },
  ready: { status: 'delivering', label: 'بدأت التوصيل' },
  delivering: { status: 'delivered', label: 'تم التسليم للعميل' },
}

const serviceLabel: Record<string, string> = {
  wash: 'غسيل', iron: 'كي', wash_iron: 'غسيل وكي', dry_clean: 'تنظيف جاف',
}

type Filter = 'active' | 'completed' | 'all'

export default function DriverOrdersScreen() {
  const { profile } = useAuth()
  const router = useRouter()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<Filter>('active')

  const loadOrders = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase
      .from('orders')
      .select('*, customer:users!orders_customer_id_fkey(name, phone, customer_code), address:addresses(label, building, floor, apartment, landmark, lat, lng)')
      .eq('driver_id', profile.id)
      .not('status', 'in', '("cancelled","refunded")')
      .order('created_at', { ascending: false })
    setOrders(data ?? [])
    setLoading(false)
    setRefreshing(false)
  }, [profile])

  useEffect(() => { loadOrders() }, [loadOrders])
  useRealtimeDriverOrders(profile?.id, loadOrders)

  const onRefresh = () => { setRefreshing(true); loadOrders() }

  async function updateStatus(orderId: string, newStatus: string) {
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId)
    if (error) {
      Alert.alert('خطأ', 'حدث خطأ أثناء تحديث الحالة')
    } else {
      await supabase.from('order_status_history').insert({
        order_id: orderId, status: newStatus, changed_by: profile?.id,
      })
      loadOrders()
    }
  }

  function openNavigation(addr: any) {
    if (!addr?.lat || !addr?.lng) {
      Alert.alert('خطأ', 'لا يوجد موقع محدد لهذا العنوان')
      return
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${addr.lat},${addr.lng}`
    Linking.openURL(url)
  }

  const activeOrders = orders.filter(o => !['delivered'].includes(o.status))
  const completedOrders = orders.filter(o => o.status === 'delivered')

  const filteredOrders = filter === 'active' ? activeOrders : filter === 'completed' ? completedOrders : orders

  const renderOrder = ({ item, index }: { item: any; index: number }) => {
    const status = statusConfig[item.status] ?? { label: item.status, color: '#999', icon: '❓' }
    const action = nextAction[item.status]
    const addr = item.address

    return (
      <Animated.View entering={FadeInRight.duration(400).delay(index * 80)}>
        <View style={s.orderCard}>
          <View style={s.orderHeader}>
            <Text style={s.orderNumber}>{item.order_number}</Text>
            <View style={[s.statusBadge, { backgroundColor: status.color + '20' }]}>
              <Text style={{ fontSize: 12 }}>{status.icon}</Text>
              <Text style={[s.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>

          <View style={s.customerInfo}>
            <Text style={s.customerName}>👤 {item.customer?.name}</Text>
            {item.customer?.phone ? (
              <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.customer.phone}`)}>
                <Text style={s.customerPhoneLink}>📞 {item.customer.phone}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={s.customerPhone}>📞 —</Text>
            )}
          </View>

          {(addr || item.delivery_location?.lat) && (
            <View style={s.addressBox}>
              <View style={s.addressHeader}>
                <Text style={s.addressLabel}>📍 {addr?.label || item.delivery_location?.label || 'موقع العميل'}</Text>
                <TouchableOpacity style={s.navBtn} onPress={() => openNavigation(addr || item.delivery_location)}>
                  <Text style={s.navBtnText}>🧭 اتجاهات</Text>
                </TouchableOpacity>
              </View>
              {addr && (
                <>
                  <Text style={s.addressDetail}>
                    {[addr.building && `مبنى ${addr.building}`, addr.floor && `ط${addr.floor}`, addr.apartment && `ش${addr.apartment}`].filter(Boolean).join(' - ')}
                  </Text>
                  {addr.landmark && <Text style={s.addressDetail}>📌 {addr.landmark}</Text>}
                </>
              )}
            </View>
          )}

          <View style={s.orderDetails}>
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>الخدمة</Text>
              <Text style={s.detailValue}>{serviceLabel[item.service_type] ?? item.service_type}</Text>
            </View>
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>القطع</Text>
              <Text style={s.detailValue}>{item.items_count}</Text>
            </View>
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>المبلغ</Text>
              <Text style={[s.detailValue, { color: colors.primary, fontWeight: '700' }]}>{item.total?.toFixed(2)} ج.م</Text>
            </View>
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>الدفع</Text>
              <Text style={s.detailValue}>{item.payment_method === 'cash' ? 'كاش' : item.payment_method === 'instapay' ? 'إنستاباي' : 'محفظة'}</Text>
            </View>
          </View>

          {item.notes && <Text style={s.notes}>📝 {item.notes}</Text>}

          {action && (
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: status.color }]}
              onPress={() => Alert.alert('تأكيد', `${action.label}؟`, [
                { text: 'إلغاء', style: 'cancel' },
                { text: 'تأكيد', onPress: () => updateStatus(item.id, action.status) },
              ])}>
              <Text style={s.actionText}>{action.label}</Text>
            </TouchableOpacity>
          )}

          <View style={s.contactRow}>
            <TouchableOpacity style={s.msgBtn} onPress={() => router.push(`/chat/${item.id}`)}>
              <Text style={s.msgBtnText}>💬 رسالة</Text>
            </TouchableOpacity>
            {item.customer?.phone && (
              <TouchableOpacity style={s.callBtn} onPress={() => Linking.openURL(`tel:${item.customer.phone}`)}>
                <Text style={s.callBtnText}>📞 اتصال</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Animated.View>
    )
  }

  return (
    <View style={s.container}>
      <Animated.View entering={FadeInDown.duration(500)} style={s.header}>
        <View>
          <Text style={s.title}>الطلبات</Text>
          <Text style={s.subtitle}>{activeOrders.length} نشط · {completedOrders.length} مكتمل</Text>
        </View>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{profile?.name?.[0] ?? '؟'}</Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(500).delay(100)} style={s.filterRow}>
        {([['active', 'النشطة'], ['completed', 'المكتملة'], ['all', 'الكل']] as [Filter, string][]).map(([key, label]) => (
          <TouchableOpacity key={key} style={[s.filterBtn, filter === key && s.filterActive]} onPress={() => setFilter(key)}>
            <Text style={[s.filterText, filter === key && s.filterTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(500).delay(200)} style={s.statsRow}>
        <View style={s.statCard}>
          <Text style={s.statValue}>{activeOrders.length}</Text>
          <Text style={s.statLabel}>نشط</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statValue}>{orders.filter(o => o.status === 'delivering').length}</Text>
          <Text style={s.statLabel}>قيد التوصيل</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statValue}>{completedOrders.length}</Text>
          <Text style={s.statLabel}>مكتمل</Text>
        </View>
      </Animated.View>

      {loading ? (
        <Animated.View entering={FadeInDown.duration(400).delay(300)} style={{ gap: 12 }}>
          <SkeletonOrderCard />
          <SkeletonOrderCard />
          <SkeletonOrderCard />
        </Animated.View>
      ) : filteredOrders.length === 0 ? (
        <Animated.View entering={FadeInDown.duration(500).delay(300)} style={s.emptyCard}>
          <Text style={s.emptyIcon}>📋</Text>
          <Text style={s.emptyText}>{filter === 'completed' ? 'لا توجد طلبات مكتملة' : 'لا توجد طلبات نشطة'}</Text>
        </Animated.View>
      ) : (
        <FlatList
          data={filteredOrders}
          renderItem={renderOrder}
          keyExtractor={item => item.id}
          contentContainerStyle={{ gap: 12, paddingBottom: 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900], padding: 20, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#fff' },
  subtitle: { fontSize: 13, color: colors.navy[300], marginTop: 2 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 18, color: '#fff', fontWeight: 'bold' },

  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  filterBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: colors.navy[800], borderWidth: 1, borderColor: colors.navy[700] },
  filterActive: { backgroundColor: colors.primary + '20', borderColor: colors.primary },
  filterText: { fontSize: 13, color: colors.navy[300], fontWeight: '600' },
  filterTextActive: { color: colors.primary },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: colors.navy[800], borderRadius: 16, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: colors.navy[700],
  },
  statValue: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  statLabel: { fontSize: 11, color: colors.navy[300], marginTop: 4 },
  orderCard: {
    backgroundColor: colors.navy[800], borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: colors.navy[700],
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  orderNumber: { fontSize: 16, fontWeight: '700', color: '#fff' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '600' },
  customerInfo: {
    backgroundColor: colors.navy[700] + '60', borderRadius: 12, padding: 12, marginBottom: 12,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  customerName: { fontSize: 13, color: '#fff', fontWeight: '600' },
  customerPhone: { fontSize: 13, color: colors.navy[200] },

  addressBox: {
    backgroundColor: colors.navy[700] + '40', borderRadius: 12, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: colors.navy[600],
  },
  addressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  addressLabel: { fontSize: 13, color: '#fff', fontWeight: '600' },
  navBtn: { backgroundColor: colors.primary + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  navBtnText: { fontSize: 11, color: colors.primary, fontWeight: '700' },
  addressDetail: { fontSize: 11, color: colors.navy[200], marginTop: 2 },

  orderDetails: { gap: 6, marginBottom: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailLabel: { fontSize: 12, color: colors.navy[300] },
  detailValue: { fontSize: 12, color: '#fff', fontWeight: '500' },
  notes: { fontSize: 12, color: colors.navy[200], marginTop: 8, marginBottom: 4 },
  actionBtn: { borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 12 },
  actionText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  contactRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  msgBtn: { flex: 1, borderWidth: 1, borderColor: colors.primary, borderRadius: 12, padding: 10, alignItems: 'center' },
  msgBtnText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  callBtn: { flex: 1, borderWidth: 1, borderColor: colors.accent, borderRadius: 12, padding: 10, alignItems: 'center' },
  callBtnText: { fontSize: 13, color: colors.accent, fontWeight: '600' },
  customerPhoneLink: { fontSize: 13, color: colors.primary, fontWeight: '600', textDecorationLine: 'underline' },
  emptyCard: {
    backgroundColor: colors.navy[800], borderRadius: 20, padding: 40,
    alignItems: 'center', borderWidth: 1, borderColor: colors.navy[700],
  },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 14, color: colors.navy[300] },
})
