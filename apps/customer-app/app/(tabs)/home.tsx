import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../src/contexts/AuthContext'
import { supabase } from '../../src/lib/supabase'
import { colors } from '../../src/theme'

const services = [
  { icon: '👔', label: 'غسيل', key: 'wash' },
  { icon: '🧹', label: 'تنظيف جاف', key: 'dry_clean' },
  { icon: '👕', label: 'كي فقط', key: 'iron' },
  { icon: '✨', label: 'غسيل وكي', key: 'wash_iron' },
]

const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'في الانتظار', color: '#f59e0b', icon: '⏳' },
  assigned: { label: 'تم تعيين سائق', color: '#3b82f6', icon: '🚗' },
  picked_up: { label: 'تم الاستلام', color: '#8b5cf6', icon: '📦' },
  processing: { label: 'جاري المعالجة', color: '#06b6d4', icon: '🔄' },
  ready: { label: 'جاهز', color: '#10b981', icon: '✅' },
  delivering: { label: 'جاري التوصيل', color: '#8b5cf6', icon: '🛵' },
  delivered: { label: 'تم التوصيل', color: '#10b981', icon: '🎉' },
  cancelled: { label: 'ملغي', color: '#ef4444', icon: '❌' },
}

export default function HomeScreen() {
  const { profile } = useAuth()
  const router = useRouter()
  const [recentOrders, setRecentOrders] = useState<any[]>([])

  useEffect(() => {
    if (profile) {
      supabase.from('orders').select('id, order_number, status, total, created_at')
        .eq('customer_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(3)
        .then(({ data }) => setRecentOrders(data ?? []))
    }
  }, [profile])

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>مرحباً، {profile?.name ?? ''} 👋</Text>
          <Text style={s.subGreeting}>ماذا تريد أن تفعل اليوم؟</Text>
        </View>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{profile?.name?.[0] ?? '؟'}</Text>
        </View>
      </View>

      <TouchableOpacity style={s.newOrderCard} activeOpacity={0.85} onPress={() => router.push('/(tabs)/new-order')}>
        <View style={s.newOrderContent}>
          <Text style={s.newOrderTitle}>طلب جديد</Text>
          <Text style={s.newOrderSub}>اطلب غسيل أو كي ملابسك الآن</Text>
        </View>
        <Text style={{ fontSize: 40 }}>🧺</Text>
      </TouchableOpacity>

      <Text style={s.sectionTitle}>الخدمات</Text>
      <View style={s.servicesGrid}>
        {services.map(svc => (
          <TouchableOpacity key={svc.key} style={s.serviceCard} activeOpacity={0.7}
            onPress={() => router.push('/(tabs)/new-order')}>
            <Text style={s.serviceIcon}>{svc.icon}</Text>
            <Text style={s.serviceLabel}>{svc.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.sectionTitle}>آخر الطلبات</Text>
      {recentOrders.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyIcon}>📋</Text>
          <Text style={s.emptyText}>لا توجد طلبات حالياً</Text>
        </View>
      ) : (
        recentOrders.map(order => {
          const status = statusConfig[order.status] ?? statusConfig.pending
          return (
            <TouchableOpacity key={order.id} style={s.orderCard} onPress={() => router.push(`/order/${order.id}`)}>
              <View style={s.orderRow}>
                <Text style={s.orderNumber}>{order.order_number}</Text>
                <View style={[s.statusBadge, { backgroundColor: status.color + '20' }]}>
                  <Text style={{ fontSize: 10 }}>{status.icon}</Text>
                  <Text style={[s.statusText, { color: status.color }]}>{status.label}</Text>
                </View>
              </View>
              <View style={s.orderRow}>
                <Text style={s.orderDate}>{new Date(order.created_at).toLocaleDateString('ar-EG')}</Text>
                <Text style={s.orderTotal}>{order.total?.toFixed(2)} ج.م</Text>
              </View>
            </TouchableOpacity>
          )
        })
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900] },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  greeting: { fontSize: 22, fontWeight: '700', color: '#fff' },
  subGreeting: { fontSize: 14, color: colors.navy[200], marginTop: 2 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 18, color: '#fff', fontWeight: 'bold' },

  newOrderCard: {
    flexDirection: 'row', backgroundColor: colors.primary, borderRadius: 20,
    padding: 24, marginBottom: 28, alignItems: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 12,
  },
  newOrderContent: { flex: 1 },
  newOrderTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  newOrderSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 16 },

  servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
  serviceCard: {
    width: '47%', backgroundColor: colors.navy[800], borderRadius: 16,
    padding: 20, alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.navy[700],
  },
  serviceIcon: { fontSize: 28 },
  serviceLabel: { fontSize: 13, fontWeight: '600', color: colors.navy[100] },

  emptyCard: {
    backgroundColor: colors.navy[800], borderRadius: 20, padding: 32,
    alignItems: 'center', borderWidth: 1, borderColor: colors.navy[700],
  },
  emptyIcon: { fontSize: 36, marginBottom: 12 },
  emptyText: { fontSize: 14, color: colors.navy[300] },

  orderCard: {
    backgroundColor: colors.navy[800], borderRadius: 16, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: colors.navy[700],
  },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  orderNumber: { fontSize: 14, fontWeight: '700', color: '#fff' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  statusText: { fontSize: 10, fontWeight: '600' },
  orderDate: { fontSize: 11, color: colors.navy[400] },
  orderTotal: { fontSize: 14, fontWeight: '700', color: colors.primary },
})
