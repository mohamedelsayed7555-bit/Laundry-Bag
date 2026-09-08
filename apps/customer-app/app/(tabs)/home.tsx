import { useEffect, useState, useCallback, useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, RefreshControl, Modal, TextInput } from 'react-native'
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
  const [unreadCount, setUnreadCount] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [bagOffer, setBagOffer] = useState<any>(null)
  const [ratingOrder, setRatingOrder] = useState<any>(null)
  const [ratingService, setRatingService] = useState(0)
  const [ratingDriver, setRatingDriver] = useState(0)
  const [ratingNote, setRatingNote] = useState('')
  const [ratingSubmitting, setRatingSubmitting] = useState(false)
  const shownRatingIds = useRef(new Set<string>())

  const loadBagOffer = useCallback(async () => {
    const { data } = await supabase.from('settings').select('value').eq('key', 'bag_offer').single()
    if (data?.value && typeof data.value === 'object' && (data.value as any).enabled) setBagOffer(data.value)
    else setBagOffer(null)
  }, [])

  const onRefresh = useCallback(async () => {
    if (!profile) return
    setRefreshing(true)
    await Promise.all([
      supabase.from('orders').select('id, order_number, status, total, created_at')
        .eq('customer_id', profile.id).order('created_at', { ascending: false }).limit(3)
        .then(({ data }) => setRecentOrders(data ?? [])),
      supabase.from('subscriptions').select('*, plans(name, items_per_month)')
        .eq('user_id', profile.id).eq('status', 'active').single()
        .then(({ data }) => setActiveSub(data)),
      supabase.from('notifications').select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id).is('read_at', null)
        .then(({ count }) => setUnreadCount(count ?? 0)),
      loadBagOffer(),
    ])
    setRefreshing(false)
  }, [profile, loadBagOffer])

  const loadRecentOrders = useCallback(() => {
    if (!profile) return
    supabase.from('orders').select('id, order_number, status, total, created_at')
      .eq('customer_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(3)
      .then(({ data }) => { setRecentOrders(data ?? []); setLoading(false) })
  }, [profile])

  const checkUnratedOrder = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase.from('orders')
      .select('id, order_number, driver_id')
      .eq('customer_id', profile.id)
      .eq('status', 'delivered')
      .is('rated_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (data && !shownRatingIds.current.has(data.id)) {
      shownRatingIds.current.add(data.id)
      setRatingOrder(data)
    }
  }, [profile])

  async function handleSubmitRating() {
    if (!ratingOrder || ratingService === 0) return
    setRatingSubmitting(true)
    await supabase.from('orders').update({
      rating_service: ratingService,
      rating_driver: ratingDriver || null,
      rating_note: ratingNote || null,
      rated_at: new Date().toISOString(),
    }).eq('id', ratingOrder.id)
    setRatingSubmitting(false)
    setRatingOrder(null)
    setRatingService(0)
    setRatingDriver(0)
    setRatingNote('')
  }

  function dismissRating() {
    setRatingOrder(null)
    setRatingService(0)
    setRatingDriver(0)
    setRatingNote('')
  }

  useEffect(() => {
    if (!profile) { setLoading(false); return }
    loadRecentOrders()
    checkUnratedOrder()
    loadBagOffer()

    supabase.from('subscriptions').select('*, plans(name, items_per_month)')
      .eq('user_id', profile.id).eq('status', 'active').single()
      .then(({ data }) => setActiveSub(data))

    supabase.from('notifications').select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id).is('read_at', null)
      .then(({ count }) => setUnreadCount(count ?? 0))

    const channel = supabase
      .channel('home-orders')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'orders',
      }, (payload: any) => {
        const row = payload.new ?? payload.old
        if (row?.customer_id === profile.id) {
          loadRecentOrders()
          if (payload.new?.status === 'delivered' && !payload.new?.rated_at) {
            const o = payload.new
            if (!shownRatingIds.current.has(o.id)) {
              shownRatingIds.current.add(o.id)
              setRatingOrder({ id: o.id, order_number: o.order_number, driver_id: o.driver_id })
            }
          }
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'settings',
        filter: 'key=eq.bag_offer',
      }, () => loadBagOffer())
      .subscribe((status, err) => {
        if (err) console.warn('home-orders realtime error:', err.message)
      })

    return () => { supabase.removeChannel(channel) }
  }, [profile, loadRecentOrders, checkUnratedOrder, loadBagOffer])

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
    <>
    <ScrollView style={[s.container, { backgroundColor: colors.navy[900] }]} contentContainerStyle={s.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(500)} style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={[s.greetSmall, { color: colors.navy[200] }]}>{greeting()} 👋</Text>
          <Text style={[s.greetName, { color: colors.text }]}>{profile?.name ?? ''}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.push('/notifications')} style={s.bellBtn}>
            <Text style={{ fontSize: 22 }}>🔔</Text>
            {unreadCount > 0 && (
              <View style={[s.badge, { backgroundColor: colors.danger }]}>
                <Text style={s.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={[s.avatarImg, { borderColor: colors.accentLight }]} />
            ) : (
              <View style={[s.avatar, { backgroundColor: colors.accent, borderColor: colors.accentLight }]}>
                <Text style={s.avatarText}>{profile?.name?.[0] ?? '؟'}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Bag Offer Banner */}
      {bagOffer && (
        <Animated.View entering={FadeInDown.duration(600).delay(80)}>
          <TouchableOpacity activeOpacity={0.9} onPress={() => router.push('/bag-order')}
            style={[bo.card, { backgroundColor: colors.accent, borderColor: colors.accentLight }]}>
            <LinearGradient
              colors={['#059669', '#047857']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={bo.gradient}>
              <View style={bo.badgeWrap}>
                <View style={bo.badge}><Text style={bo.badgeText}>{bagOffer.badge_text}</Text></View>
                {bagOffer.original_price > bagOffer.daily_price && (
                  <View style={bo.discountBadge}>
                    <Text style={bo.discountText}>-{Math.round((1 - bagOffer.daily_price / bagOffer.original_price) * 100)}%</Text>
                  </View>
                )}
              </View>
              <View style={bo.row}>
                <View style={{ flex: 1 }}>
                  <Text style={bo.title}>{bagOffer.title}</Text>
                  <Text style={bo.subtitle}>{bagOffer.subtitle}</Text>
                  <View style={bo.priceRow}>
                    {bagOffer.original_price > bagOffer.daily_price && (
                      <Text style={bo.oldPrice}>{bagOffer.original_price} ج.م</Text>
                    )}
                    <Text style={bo.price}>{bagOffer.daily_price} ج.م</Text>
                    <Text style={bo.perDay}>/ يومياً</Text>
                  </View>
                </View>
                <Text style={bo.emoji}>👜</Text>
              </View>
              <View style={bo.cta}>
                <Text style={bo.ctaText}>اطلب الآن</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      )}

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

    <Modal visible={!!ratingOrder} transparent animationType="slide" onRequestClose={dismissRating}>
      <View style={rs.overlay}>
        <View style={[rs.card, { backgroundColor: colors.navy[800], borderColor: colors.navy[700] }]}>
          <Text style={[rs.title, { color: colors.text }]}>⭐ قيّم طلبك</Text>
          <Text style={[rs.subtitle, { color: colors.navy[300] }]}>طلب {ratingOrder?.order_number}</Text>

          <Text style={[rs.label, { color: colors.navy[100] }]}>تقييم الخدمة</Text>
          <View style={rs.starsRow}>
            {[1, 2, 3, 4, 5].map(n => (
              <TouchableOpacity key={n} onPress={() => setRatingService(n)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                <Text style={[rs.star, n <= ratingService && rs.starActive]}>{n <= ratingService ? '⭐' : '☆'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {ratingOrder?.driver_id && (
            <>
              <Text style={[rs.label, { color: colors.navy[100] }]}>تقييم السائق</Text>
              <View style={rs.starsRow}>
                {[1, 2, 3, 4, 5].map(n => (
                  <TouchableOpacity key={n} onPress={() => setRatingDriver(n)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                    <Text style={[rs.star, n <= ratingDriver && rs.starActive]}>{n <= ratingDriver ? '⭐' : '☆'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <TextInput
            style={[rs.input, { backgroundColor: colors.navy[700], color: colors.text, borderColor: colors.navy[600] }]}
            placeholder="ملاحظاتك (اختياري)..."
            placeholderTextColor={colors.navy[400]}
            value={ratingNote}
            onChangeText={setRatingNote}
            multiline
            textAlign="right"
          />

          <View style={rs.actions}>
            <TouchableOpacity style={[rs.cancelBtn, { borderColor: colors.navy[500] }]} onPress={dismissRating}>
              <Text style={[rs.cancelText, { color: colors.navy[200] }]}>لاحقاً</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[rs.submitBtn, { backgroundColor: colors.accent, opacity: ratingService === 0 || ratingSubmitting ? 0.5 : 1 }]}
              onPress={handleSubmitRating}
              disabled={ratingService === 0 || ratingSubmitting}
            >
              <Text style={[rs.submitText, { color: colors.text }]}>{ratingSubmitting ? 'جاري الإرسال...' : 'إرسال التقييم'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    </>
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
  bellBtn: { position: 'relative', padding: 4 },
  badge: { position: 'absolute', top: -2, right: -4, minWidth: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
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

const bo = StyleSheet.create({
  card: { borderRadius: 24, marginBottom: 16, overflow: 'hidden', shadowColor: '#059669', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 12 },
  gradient: { padding: 20, borderRadius: 24 },
  badgeWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  badge: { backgroundColor: '#fbbf24', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeText: { color: '#78350f', fontSize: 11, fontWeight: '800' },
  discountBadge: { backgroundColor: '#ef4444', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  discountText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 4 },
  subtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginBottom: 12, lineHeight: 18 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  oldPrice: { color: 'rgba(255,255,255,0.45)', fontSize: 14, textDecorationLine: 'line-through' },
  price: { color: '#fff', fontSize: 24, fontWeight: '900' },
  perDay: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  emoji: { fontSize: 52, marginLeft: 8 },
  cta: { backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'flex-start', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 14, marginTop: 14 },
  ctaText: { color: '#fff', fontSize: 14, fontWeight: '700' },
})

const rs = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  card: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, borderWidth: 1, borderBottomWidth: 0 },
  title: { fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 13, textAlign: 'center', marginBottom: 20 },
  label: { fontSize: 14, marginBottom: 8, marginTop: 8 },
  starsRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  star: { fontSize: 30, color: '#555' },
  starActive: { color: '#f59e0b' },
  input: { borderRadius: 14, padding: 14, fontSize: 14, minHeight: 60, marginTop: 12, borderWidth: 1 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: { flex: 1, borderWidth: 1.5, borderRadius: 14, padding: 14, alignItems: 'center' },
  cancelText: { fontSize: 14, fontWeight: '600' },
  submitBtn: { flex: 2, borderRadius: 14, padding: 14, alignItems: 'center' },
  submitText: { fontSize: 14, fontWeight: '700' },
})
