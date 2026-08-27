import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native'
import { useAuth } from '../../src/contexts/AuthContext'
import { supabase } from '../../src/lib/supabase'
import { useRealtimeDriverOrders } from '../../src/hooks/useRealtimeOrders'
import { colors } from '../../src/theme'

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

export default function DriverOrdersScreen() {
  const { profile } = useAuth()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadOrders = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase
      .from('orders')
      .select('*, customer:users!orders_customer_id_fkey(name, phone, customer_code)')
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

  const activeOrders = orders.filter(o => !['delivered'].includes(o.status))
  const completedOrders = orders.filter(o => o.status === 'delivered')

  const renderOrder = ({ item }: { item: any }) => {
    const status = statusConfig[item.status] ?? { label: item.status, color: '#999', icon: '❓' }
    const action = nextAction[item.status]

    return (
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
          <Text style={s.customerPhone}>📞 {item.customer?.phone ?? '—'}</Text>
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
      </View>
    )
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>الطلبات</Text>
          <Text style={s.subtitle}>{activeOrders.length} نشط · {completedOrders.length} مكتمل</Text>
        </View>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{profile?.name?.[0] ?? '؟'}</Text>
        </View>
      </View>

      <View style={s.statsRow}>
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
      </View>

      {loading ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyText}>جاري التحميل...</Text>
        </View>
      ) : orders.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyIcon}>📋</Text>
          <Text style={s.emptyText}>لا توجد طلبات مسندة إليك حالياً</Text>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#fff' },
  subtitle: { fontSize: 13, color: colors.navy[300], marginTop: 2 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 18, color: '#fff', fontWeight: 'bold' },
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
  orderDetails: { gap: 6, marginBottom: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailLabel: { fontSize: 12, color: colors.navy[300] },
  detailValue: { fontSize: 12, color: '#fff', fontWeight: '500' },
  notes: { fontSize: 12, color: colors.navy[200], marginTop: 8, marginBottom: 4 },
  actionBtn: { borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 12 },
  actionText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  emptyCard: {
    backgroundColor: colors.navy[800], borderRadius: 20, padding: 40,
    alignItems: 'center', borderWidth: 1, borderColor: colors.navy[700],
  },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 14, color: colors.navy[300] },
})
