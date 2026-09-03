import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated'
import { useAuth } from '../../src/contexts/AuthContext'
import { useTheme } from '../../src/contexts/ThemeContext'
import { useLanguage } from '../../src/contexts/LanguageContext'
import { supabase } from '../../src/lib/supabase'
import { SkeletonOrderCard } from '../../src/components/Skeleton'

const statusIcons: Record<string, string> = {
  pending: '⏳', assigned: '🚗', picked_up: '📦', processing: '🔄',
  ready: '✅', delivering: '🛵', delivered: '🎉', cancelled: '❌',
}

const statusColors: Record<string, string> = {
  pending: '#f59e0b', assigned: '#3b82f6', picked_up: '#8b5cf6', processing: '#06b6d4',
  ready: '#10b981', delivering: '#8b5cf6', delivered: '#10b981', cancelled: '#ef4444',
}

export default function HomeScreen() {
  const { profile } = useAuth()
  const { colors } = useTheme()
  const { t } = useLanguage()
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

    supabase.from('subscriptions').select('*, plans(name, items_per_month)')
      .eq('user_id', profile.id).eq('status', 'active').single()
      .then(({ data }) => setActiveSub(data))
  }, [profile])

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return t('goodMorning')
    if (h < 17) return t('goodAfternoon')
    return t('goodEvening')
  }

  const services = [
    { icon: '👔', label: t('wash'), key: 'wash', desc: t('washDesc') },
    { icon: '🧹', label: t('dryClean'), key: 'dry_clean', desc: t('dryCleanDesc') },
    { icon: '👕', label: t('ironOnly'), key: 'iron', desc: t('ironDesc') },
    { icon: '✨', label: t('washIron'), key: 'wash_iron', desc: t('washIronDesc') },
  ]

  const getStatusLabel = (status: string) => {
    const key = `status${status.charAt(0).toUpperCase() + status.slice(1).replace(/_([a-z])/g, (_, c) => c.toUpperCase())}` as any
    return t(key) || status
  }

  return (
    <ScrollView style={[s.container, { backgroundColor: colors.navy[900] }]} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(500)} style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={[s.greetSmall, { color: colors.navy[200] }]}>{greeting()} 👋</Text>
          <Text style={[s.greetName, { color: colors.text }]}>{profile?.name ?? ''}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={[s.avatarImg, { borderColor: colors.accentLight }]} />
          ) : (
            <View style={[s.avatar, { backgroundColor: colors.accent, borderColor: colors.accentLight }]}>
              <Text style={s.avatarText}>{profile?.name?.[0] ?? '؟'}</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Hero CTA */}
      <Animated.View entering={FadeInDown.duration(500).delay(100)}>
        <TouchableOpacity activeOpacity={0.85} onPress={() => router.push('/(tabs)/new-order')}>
          <LinearGradient
            colors={colors.gradientAccent as unknown as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.heroCard}
          >
            <View style={s.heroContent}>
              <Text style={s.heroTitle}>{t('newOrder')}</Text>
              <Text style={s.heroSub}>{t('newOrderSub')}</Text>
              <View style={s.heroBtnWrap}>
                <Text style={s.heroBtnText}>{t('startNow')}</Text>
              </View>
            </View>
            <Text style={s.heroEmoji}>🧺</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* Active Subscription Banner */}
      {activeSub && (
        <Animated.View entering={FadeInDown.duration(500).delay(150)}>
          <TouchableOpacity style={[s.subBanner, { backgroundColor: colors.goldGlow, borderColor: '#fbbf2430' }]} activeOpacity={0.8} onPress={() => router.push('/plans')}>
            <View style={s.subBannerIcon}><Text style={{ fontSize: 20 }}>👑</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={[s.subBannerTitle, { color: colors.gold }]}>{t('packagePrefix')} {activeSub.plans?.name}</Text>
              <Text style={[s.subBannerSub, { color: colors.navy[200] }]}>
                {t('remaining')} {(activeSub.plans?.items_per_month ?? 0) - (activeSub.items_used ?? 0)} {t('pieces')}
              </Text>
            </View>
            <Text style={[s.subBannerArrow, { color: colors.gold }]}>←</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Plans Banner (if no subscription) */}
      {!activeSub && (
        <Animated.View entering={FadeInDown.duration(500).delay(150)}>
          <TouchableOpacity style={[s.plansBanner, { backgroundColor: colors.warningGlow, borderColor: '#f59e0b30' }]} activeOpacity={0.85} onPress={() => router.push('/plans')}>
            <View style={s.plansBannerIconWrap}><Text style={{ fontSize: 22 }}>👑</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.plansBannerTitle}>{t('subscriptionPlans')}</Text>
              <Text style={[s.plansBannerSub, { color: colors.navy[200] }]}>{t('saveMore')}</Text>
            </View>
            <Text style={s.plansBannerArrow}>←</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Services */}
      <Animated.View entering={FadeInDown.duration(500).delay(250)}>
        <Text style={[s.sectionTitle, { color: colors.text }]}>{t('services')}</Text>
      </Animated.View>
      <View style={s.servicesGrid}>
        {services.map((svc, i) => (
          <Animated.View key={svc.key} entering={FadeInDown.duration(400).delay(300 + i * 60)} style={{ width: '47%' }}>
            <TouchableOpacity style={[s.serviceCard, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }]} activeOpacity={0.7}
              onPress={() => router.push('/(tabs)/new-order')}>
              <View style={[s.serviceIconWrap, { backgroundColor: colors.navy[700] }]}>
                <Text style={s.serviceIcon}>{svc.icon}</Text>
              </View>
              <Text style={[s.serviceLabel, { color: colors.text }]}>{svc.label}</Text>
              <Text style={[s.serviceDesc, { color: colors.navy[300] }]}>{svc.desc}</Text>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>

      {/* Recent Orders */}
      <Animated.View entering={FadeInDown.duration(500).delay(550)}>
        <View style={s.sectionHeader}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>{t('recentOrders')}</Text>
          {recentOrders.length > 0 && (
            <TouchableOpacity onPress={() => router.push('/(tabs)/orders')}>
              <Text style={[s.seeAll, { color: colors.primary }]}>{t('viewAll')}</Text>
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
        <Animated.View entering={FadeInDown.duration(400).delay(600)} style={[s.emptyCard, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }]}>
          <Text style={s.emptyIcon}>📋</Text>
          <Text style={[s.emptyText, { color: colors.navy[200] }]}>{t('noOrders')}</Text>
          <Text style={[s.emptySubText, { color: colors.navy[400] }]}>{t('startFirstOrder')}</Text>
        </Animated.View>
      ) : (
        recentOrders.map((order, i) => {
          const sColor = statusColors[order.status] ?? '#f59e0b'
          const sIcon = statusIcons[order.status] ?? '⏳'
          return (
            <Animated.View key={order.id} entering={FadeInRight.duration(400).delay(600 + i * 80)}>
              <TouchableOpacity style={[s.orderCard, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }]} onPress={() => router.push(`/order/${order.id}`)}>
                <View style={s.orderRow}>
                  <Text style={[s.orderNumber, { color: colors.text }]}>{order.order_number}</Text>
                  <View style={[s.statusBadge, { backgroundColor: sColor + '18' }]}>
                    <Text style={{ fontSize: 10 }}>{sIcon}</Text>
                    <Text style={[s.statusText, { color: sColor }]}>{getStatusLabel(order.status)}</Text>
                  </View>
                </View>
                <View style={[s.orderDivider, { backgroundColor: colors.navy[700] }]} />
                <View style={s.orderRow}>
                  <Text style={[s.orderDate, { color: colors.navy[400] }]}>{new Date(order.created_at).toLocaleDateString('ar-EG')}</Text>
                  <Text style={[s.orderTotal, { color: colors.primary }]}>{order.total?.toFixed(2)} {t('currency')}</Text>
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
  container: { flex: 1 },
  content: { padding: 20, paddingTop: 56, paddingBottom: 100 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  greetSmall: { fontSize: 14 },
  greetName: { fontSize: 24, fontWeight: '800', marginTop: 2 },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2,
  },
  avatarText: { fontSize: 20, color: '#fff', fontWeight: 'bold' },
  avatarImg: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 2,
  },

  heroCard: {
    flexDirection: 'row', borderRadius: 24,
    padding: 24, marginBottom: 16, alignItems: 'center',
    shadowColor: '#00c966', shadowOffset: { width: 0, height: 8 },
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
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, padding: 16, marginBottom: 20,
    borderWidth: 1,
  },
  subBannerIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#fbbf2420',
    justifyContent: 'center', alignItems: 'center',
  },
  subBannerTitle: { fontSize: 15, fontWeight: '700' },
  subBannerSub: { fontSize: 12, marginTop: 2 },
  subBannerArrow: { fontSize: 20 },

  plansBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, padding: 16, marginBottom: 20,
    borderWidth: 1,
  },
  plansBannerIconWrap: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#f59e0b20',
    justifyContent: 'center', alignItems: 'center',
  },
  plansBannerTitle: { fontSize: 15, fontWeight: '700', color: '#f59e0b' },
  plansBannerSub: { fontSize: 12, marginTop: 2 },
  plansBannerArrow: { fontSize: 20, color: '#f59e0b' },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 2 },
  seeAll: { fontSize: 13, fontWeight: '600' },

  servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
  serviceCard: {
    borderRadius: 20,
    padding: 20, alignItems: 'center', gap: 6,
    borderWidth: 1,
  },
  serviceIconWrap: {
    width: 52, height: 52, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  serviceIcon: { fontSize: 26 },
  serviceLabel: { fontSize: 14, fontWeight: '700' },
  serviceDesc: { fontSize: 11 },

  emptyCard: {
    borderRadius: 20, padding: 32,
    alignItems: 'center', borderWidth: 1,
  },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 15, fontWeight: '600' },
  emptySubText: { fontSize: 12, marginTop: 4 },

  orderCard: {
    borderRadius: 18, padding: 16, marginBottom: 10,
    borderWidth: 1,
  },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderDivider: { height: 1, marginVertical: 10 },
  orderNumber: { fontSize: 14, fontWeight: '700' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 10, fontWeight: '700' },
  orderDate: { fontSize: 11 },
  orderTotal: { fontSize: 15, fontWeight: '800' },
})
