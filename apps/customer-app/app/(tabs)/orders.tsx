import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native'
import { useAuth } from '../../src/contexts/AuthContext'
import { supabase } from '../../src/lib/supabase'
import { useRealtimeOrders } from '../../src/hooks/useRealtimeOrders'
import { colors } from '../../src/theme'

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

export default function OrdersScreen() {
  const { profile } = useAuth()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadOrders = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase
      .from('orders')
      .select('*, driver:users!orders_driver_id_fkey(name)')
      .eq('customer_id', profile.id)
      .order('created_at', { ascending: false })
    setOrders(data ?? [])
    setLoading(false)
    setRefreshing(false)
  }, [profile])

  useEffect(() => { loadOrders() }, [loadOrders])
  useRealtimeOrders(profile?.id, loadOrders)

  const onRefresh = () => { setRefreshing(true); loadOrders() }

  const renderOrder = ({ item }: { item: any }) => {
    const status = statusConfig[item.status] ?? statusConfig.pending
    return (
      <View style={s.orderCard}>
        <View style={s.orderHeader}>
          <Text style={s.orderNumber}>{item.order_number}</Text>
          <View style={[s.statusBadge, { backgroundColor: status.color + '20' }]}>
            <Text style={{ fontSize: 12 }}>{status.icon}</Text>
            <Text style={[s.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

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
          {item.driver?.name && (
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>السائق</Text>
              <Text style={s.detailValue}>{item.driver.name}</Text>
            </View>
          )}
        </View>

        <Text style={s.date}>{new Date(item.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</Text>
      </View>
    )
  }

  return (
    <View style={s.container}>
      <Text style={s.title}>طلباتي</Text>

      {loading ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyText}>جاري التحميل...</Text>
        </View>
      ) : orders.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyIcon}>📦</Text>
          <Text style={s.emptyText}>لا توجد طلبات حالياً</Text>
          <Text style={s.emptySubText}>ابدأ بإنشاء طلب جديد من تبويب "طلب جديد"</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
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
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 20 },
  orderCard: {
    backgroundColor: colors.navy[800], borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: colors.navy[700],
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  orderNumber: { fontSize: 16, fontWeight: '700', color: '#fff' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: '600' },
  orderDetails: { gap: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailLabel: { fontSize: 13, color: colors.navy[300] },
  detailValue: { fontSize: 13, color: '#fff', fontWeight: '500' },
  date: { fontSize: 11, color: colors.navy[400], marginTop: 12, textAlign: 'left' },
  emptyCard: {
    backgroundColor: colors.navy[800], borderRadius: 20, padding: 40,
    alignItems: 'center', borderWidth: 1, borderColor: colors.navy[700],
  },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, color: colors.navy[300] },
  emptySubText: { fontSize: 12, color: colors.navy[400], marginTop: 8 },
})
