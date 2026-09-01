import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated'
import { useAuth } from '../../src/contexts/AuthContext'
import { supabase } from '../../src/lib/supabase'
import { colors } from '../../src/theme'
import { SkeletonOrderCard } from '../../src/components/Skeleton'

const services = [
  { icon: '👔', label: 'غسيل', key: 'wash', desc: 'غسيل كامل' },
  { icon: '🧹', label: 'تنظيف جاف', key: 'dry_clean', desc: 'درايكلين' },
  { icon: '👕', label: 'كي فقط', key: 'iron', desc: 'كي مكوجي' },
  { icon: '✨', label: 'غسيل وكي', key: 'wash_iron', desc: 'باكدج كامل' },
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
  const [loading, setLoading] = useState(true)
  const [activeSub, setActiveSub] = useState<any>(null)

  useEffect(() => {
    if (!profile) { setLoading(false); return }
    supabase.from('orders').select('id, order_number, status, total, created_at')
      .eq('customer_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(3)
      .then(({ data }) => { setRecentOrders(data ?? []); setLoading(false) })

    supabase.from('subscriptions').select('*, plans(name, items_limit)')
      .eq('user_id', profile.id).eq('status', 'active').single()
      .then(({ data }) => setActiveSub(data))
  }, [profile])

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'صباح الخير'
    if (h < 17) return 'مساء الخير'
    return 'مساء النور'
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(500)} style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.greetSmall}>{greeting()} 👋</Text>
          <Text style={s.greetName}>{profile?.name ?? ''}</Text>
        </View>
        <TouchableOpacity style={s.avatar} onPress={() => router.push('/(tabs)/profile')}>
          <Text style={s.avatarText}>{profile?.name?.[0] ?? '؟'}</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Hero CTA */}
      <Animated.View entering={FadeInDown.duration(500).delay(100)}>
        <TouchableOpacity activeOpacity={0.85} onPress={() => router.push('/(tabs)/new-order')}>
          <LinearGradient
            colors={[colors.primary, '#00875a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.heroCard}
          >
            <View style={s.heroContent}>
              <Text style={s.heroTitle}>طلب جديد</Text>
              <Text style={s.heroSub}>اطلب غسيل أو كي ملابسك الآن</Text>
              <View style={s.heroBtnWrap}>
                <Text style={s.heroBtnText}>ابدأ الآن ←</Text>
              </View>
            </View>
            <Text style={s.heroEmoji}>🧺</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* Active Subscription Banner */}
      {activeSub && (
        <Animated.View entering={FadeInDown.duration(500).delay(150)}>
          <TouchableOpacity style={s.subBanner} activeOpacity={0.8} onPress={() => router.push('/plans')}>
            <View style={s.subBannerIcon}><Text style={{ fontSize: 20 }}>👑</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.subBannerTitle}>باقة {activeSub.plans?.name}</Text>
              <Text style={s.subBannerSub}>
                متبقي {(activeSub.plans?.items_limit ?? 0) - (activeSub.items_used ?? 0)} قطعة
              </Text>
            </View>
            <Text style={s.subBannerArrow}>←</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Plans Banner (if no subscription) */}
      {!activeSub && (
        <Animated.View entering={FadeInDown.duration(500).delay(150)}>
          <TouchableOpacity style={s.plansBanner} activeOpacity={0.85} onPress={() => router.push('/plans')}>
            <View style={s.plansBannerIconWrap}><Text style={{ fontSize: 22 }}>👑</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.plansBannerTitle}>باقات الاشتراك</Text>
              <Text style={s.plansBannerSub}>وفّر أكتر مع الباقات الشهرية</Text>
            </View>
            <Text style={s.plansBannerArrow}>←</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Services */}
      <Animated.View entering={FadeInDown.duration(500).delay(250)}>
        <Text style={s.sectionTitle}>الخدمات</Text>
      </Animated.View>
      <View style={s.servicesGrid}>
        {services.map((svc, i) => (
          <Animated.View key={svc.key} entering={FadeInDown.duration(400).delay(300 + i * 60)} style={{ width: '47%' }}>
            <TouchableOpacity style={s.serviceCard} activeOpacity={0.7}
              onPress={() => router.push('/(tabs)/new-order')}>
              <View style={s.serviceIconWrap}>
                <Text style={s.serviceIcon}>{svc.icon}</Text>
              </View>
              <Text style={s.serviceLabel}>{svc.label}</Text>
              <Text style={s.serviceDesc}>{svc.desc}</Text>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>

      {/* Recent Orders */}
      <Animated.View entering={FadeInDown.duration(500).delay(550)}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>آخر الطلبات</Text>
          {recentOrders.length > 0 && (
            <TouchableOpacity onPress={() => router.push('/(tabs)/orders')}>
              <Text style={s.seeAll}>عرض الكل ←</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {loading ? (
        <>
          <SkeletonOrderCard />
          <SkeletonOrderCard />
        </>
      ) : recentOrders.length === 0 ? (
        <Animated.View entering={FadeInDown.duration(400).delay(600)} style={s.emptyCard}>
          <Text style={s.emptyIcon}>📋</Text>
          <Text style={s.emptyText}>لا توجد طلبات حالياً</Text>
          <Text style={s.emptySubText}>ابدأ بإنشاء أول طلب</Text>
        </Animated.View>
      ) : (
        recentOrders.map((order, i) => {
          const status = statusConfig[order.status] ?? statusConfig.pending
          return (
            <Animated.View key={order.id} entering={FadeInRight.duration(400).delay(600 + i * 80)}>
              <TouchableOpacity style={s.orderCard} onPress={() => router.push(`/order/${order.id}`)}>
                <View style={s.orderRow}>
                  <Text style={s.orderNumber}>{order.order_number}</Text>
                  <View style={[s.statusBadge, { backgroundColor: status.color + '18' }]}>
                    <Text style={{ fontSize: 10 }}>{status.icon}</Text>
                    <Text style={[s.statusText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </View>
                <View style={s.orderDivider} />
                <View style={s.orderRow}>
                  <Text style={s.orderDate}>{new Date(order.created_at).toLocaleDateString('ar-EG')}</Text>
                  <Text style={s.orderTotal}>{order.total?.toFixed(2)} ج.م</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          )
        })
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900] },
  content: { padding: 20, paddingTop: 56 },

  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  greetSmall: { fontSize: 14, color: colors.navy[200] },
  greetName: { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 2 },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: colors.accentLight,
  },
  avatarText: { fontSize: 20, color: '#fff', fontWeight: 'bold' },

  heroCard: {
    flexDirection: 'row', borderRadius: 24,
    padding: 24, marginBottom: 16, alignItems: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 20, elevation: 14,
  },
  heroContent: { flex: 1 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  heroBtnWrap: {
    backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'flex-start',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, marginTop: 12,
  },
  heroBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  heroEmoji: { fontSize: 48 },

  subBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.goldGlow,
    borderRadius: 16, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: '#fbbf2430',
  },
  subBannerIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#fbbf2420',
    justifyContent: 'center', alignItems: 'center', marginLeft: 12,
  },
  subBannerTitle: { fontSize: 15, fontWeight: '700', color: colors.gold },
  subBannerSub: { fontSize: 12, color: colors.navy[200], marginTop: 2 },
  subBannerArrow: { fontSize: 20, color: colors.gold },

  plansBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.warningGlow,
    borderRadius: 16, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: '#f59e0b30',
  },
  plansBannerIconWrap: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#f59e0b20',
    justifyContent: 'center', alignItems: 'center', marginLeft: 12,
  },
  plansBannerTitle: { fontSize: 15, fontWeight: '700', color: '#f59e0b' },
  plansBannerSub: { fontSize: 12, color: colors.navy[200], marginTop: 2 },
  plansBannerArrow: { fontSize: 20, color: '#f59e0b' },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 2 },
  seeAll: { fontSize: 13, color: colors.primary, fontWeight: '600' },

  servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
  serviceCard: {
    backgroundColor: colors.navy[800], borderRadius: 20,
    padding: 20, alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.navy[700],
  },
  serviceIconWrap: {
    width: 52, height: 52, borderRadius: 16, backgroundColor: colors.navy[700],
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  serviceIcon: { fontSize: 26 },
  serviceLabel: { fontSize: 14, fontWeight: '700', color: '#fff' },
  serviceDesc: { fontSize: 11, color: colors.navy[300] },

  emptyCard: {
    backgroundColor: colors.navy[800], borderRadius: 20, padding: 32,
    alignItems: 'center', borderWidth: 1, borderColor: colors.navy[700],
  },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 15, color: colors.navy[200], fontWeight: '600' },
  emptySubText: { fontSize: 12, color: colors.navy[400], marginTop: 4 },

  orderCard: {
    backgroundColor: colors.navy[800], borderRadius: 18, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: colors.navy[700],
  },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderDivider: { height: 1, backgroundColor: colors.navy[700], marginVertical: 10 },
  orderNumber: { fontSize: 14, fontWeight: '700', color: '#fff' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 10, fontWeight: '700' },
  orderDate: { fontSize: 11, color: colors.navy[400] },
  orderTotal: { fontSize: 15, fontWeight: '800', color: colors.primary },
})
