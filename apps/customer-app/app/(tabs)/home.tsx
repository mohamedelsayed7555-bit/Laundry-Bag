import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, RefreshControl, Modal, TextInput, Dimensions, NativeScrollEvent, NativeSyntheticEvent, I18nManager, AppState, Linking, Animated as RNAnimated } from 'react-native'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, { FadeInLeft, FadeInRight } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  ShoppingBag, Bell, MapPin, ChevronDown, Phone, Truck, Clock3, CircleCheck, CircleX, Package, WashingMachine,
  Sparkles, ArrowUpLeft, ArrowUpRight, ClipboardList,
} from 'lucide-react-native'
import { useAuth } from '../../src/contexts/AuthContext'
import { useLanguage } from '../../src/contexts/LanguageContext'
import { supabase } from '../../src/lib/supabase'
import { SkeletonOrderCard } from '../../src/components/Skeleton'
import { useRealtimeOrders } from '../../src/hooks/useRealtimeOrders'
import { useCart } from '../../src/contexts/CartContext'
import WelcomeGiftPopup from '../../src/components/WelcomeGiftPopup'
import RatingSheet from '../../src/components/RatingSheet'
import {
  useBrand, SIZE, F, HIT, DotsBackdrop, SectionTitle, Segments, Pill, IconButton, ForwardChevron, ForwardIcon,
  cardShadow, money, shortDate, StickyBar, useStickyHeader,
} from '../../src/components/brand'

const SCREEN_WIDTH = Dimensions.get('window').width
const BANNER_WIDTH = SCREEN_WIDTH - 32
const BANNER_HEIGHT = 140
const TILE_WIDTH = (SCREEN_WIDTH - 32 - 10) / 2

const STATUS_FLOW = ['pending', 'assigned', 'arrived', 'picked_up', 'processing', 'ready', 'delivering', 'delivered']
const ACTIVE_STATUSES = ['scheduled', 'pending', 'assigned', 'arrived', 'picked_up', 'processing', 'ready', 'delivering']

// Cropped to the tile's own shape, each one centred on the thing the service does —
// the new-order screen keeps the uncropped originals for its square cards.
const SERVICE_IMAGES: Record<string, any> = {
  wash: require('../../assets/services/cards/wash.webp'),
  dry_clean: require('../../assets/services/cards/dry.webp'),
  iron: require('../../assets/services/cards/iron.webp'),
  wash_iron: require('../../assets/services/cards/washiron.webp'),
  housekeeping: require('../../assets/services/cards/home.webp'),
  carpet: require('../../assets/services/cards/carpet.webp'),
  accessories: require('../../assets/services/cards/shop.webp'),
}
const BANNER_IMAGES = {
  bag: require('../../assets/banners/bag.webp'),
  newOrder: require('../../assets/banners/new-order.webp'),
  plans: require('../../assets/banners/plans.webp'),
}

// "ابدأ الآن ←" → "ابدأ الآن" (the arrow becomes an icon).
const stripArrow = (s: string) => (s ?? '').replace(/\s*[←→]\s*$/, '')
const cleanNumber = (n?: string | null) => (n ?? '').replace(/^#+/, '')

function statusLook(status: string) {
  if (status === 'delivered') return { tone: 'ok' as const, Icon: CircleCheck }
  if (status === 'cancelled' || status === 'refunded') return { tone: 'danger' as const, Icon: CircleX }
  if (status === 'pending' || status === 'scheduled') return { tone: 'warn' as const, Icon: Clock3 }
  if (status === 'processing' || status === 'ready') return { tone: 'info' as const, Icon: WashingMachine }
  if (status === 'picked_up') return { tone: 'info' as const, Icon: Package }
  return { tone: 'info' as const, Icon: Truck }
}

function BannerShell({ image, onPress, children }: { image: any; onPress: () => void; children: React.ReactNode }) {
  const rtl = I18nManager.isRTL
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={cr.banner} accessibilityRole="button">
      <Image source={image} style={StyleSheet.absoluteFill} resizeMode="cover" />
      {/* Dark on the text (start) side, clear on the photo side. */}
      <LinearGradient
        colors={['rgba(7,22,46,0.94)', 'rgba(7,22,46,0.72)', 'rgba(7,22,46,0.05)']}
        locations={[0, 0.5, 1]}
        start={{ x: rtl ? 1 : 0, y: 0 }}
        end={{ x: rtl ? 0 : 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={cr.bannerText}>{children}</View>
    </TouchableOpacity>
  )
}

function BannerCta({ label }: { label: string }) {
  return (
    <View style={cr.cta}>
      <Text style={cr.ctaText}>{label}</Text>
      <ForwardIcon color="#0284C7" size={14} />
    </View>
  )
}

function BannersCarousel({ bagOffer, activeSub, t, locale, onBagPress, onNewOrderPress, onPlansPress }: any) {
  const brand = useBrand()
  const SlideIn = I18nManager.isRTL ? FadeInRight : FadeInLeft
  const [activeIndex, setActiveIndex] = useState(0)
  const scrollRef = useRef<ScrollView>(null)
  const autoScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const banners: { key: string; node: React.ReactNode }[] = []
  const en = locale === 'en'

  if (bagOffer) {
    const hasDiscount = bagOffer.original_price > bagOffer.daily_price
    // Texts are edited in the dashboard (Arabic); English keeps the translation.
    const bagBadge = (!en && bagOffer.badge_text) || t('bagBadge')
    const bagSub = (!en && bagOffer.subtitle) || t('bagSubtitle')
    banners.push({
      key: 'bag',
      node: (
        <BannerShell image={BANNER_IMAGES.bag} onPress={onBagPress}>
          <View style={cr.badges}>
            <View style={cr.badgeHot}><Text style={cr.badgeHotText}>{bagBadge}</Text></View>
            {hasDiscount && (
              <View style={cr.badgeOff}><Text style={cr.badgeOffText}>-{Math.round((1 - bagOffer.daily_price / bagOffer.original_price) * 100)}%</Text></View>
            )}
          </View>
          <View style={cr.brandRow}>
            {!en && <View style={cr.prePill}><Text style={cr.prePillText}>شنطة</Text></View>}
            <Text style={cr.brand}>Laundry <Text style={cr.brandAccent}>Bag</Text></Text>
          </View>
          <Text style={cr.sub} numberOfLines={1}>{bagSub}</Text>
          <View style={cr.priceRow}>
            <Text style={cr.price}>{bagOffer.daily_price} <Text style={cr.priceCur}>{t('currency')}</Text></Text>
            {hasDiscount && <Text style={cr.oldPrice}>{bagOffer.original_price}</Text>}
            <Text style={cr.perDay}>/ {t('bagPerDay')}</Text>
          </View>
        </BannerShell>
      ),
    })
  }

  banners.push({
    key: 'newOrder',
    node: (
      <BannerShell image={BANNER_IMAGES.newOrder} onPress={onNewOrderPress}>
        <Text style={cr.title} numberOfLines={1}>{t('newOrder')}</Text>
        <Text style={cr.sub} numberOfLines={2}>{t('newOrderSub')}</Text>
        <BannerCta label={stripArrow(t('startNow'))} />
      </BannerShell>
    ),
  })

  banners.push({
    key: 'plans',
    node: activeSub ? (
      <BannerShell image={BANNER_IMAGES.plans} onPress={onPlansPress}>
        <Text style={cr.title} numberOfLines={1}>{t('packagePrefix')} {locale === 'en' && activeSub.plans?.name ? (t(`plan:${activeSub.plans.name}` as any) !== `plan:${activeSub.plans.name}` ? t(`plan:${activeSub.plans.name}` as any) : activeSub.plans.name) : activeSub.plans?.name}</Text>
        <Text style={cr.sub} numberOfLines={1}>{t('remaining')} {(activeSub.plans?.items_per_month ?? 0) - (activeSub.items_used ?? 0)} {t('pieces')}</Text>
        <View style={cr.meter}>
          <View style={[cr.meterFill, { width: `${Math.max(0, Math.min(100, (((activeSub.plans?.items_per_month ?? 0) - (activeSub.items_used ?? 0)) / Math.max(1, activeSub.plans?.items_per_month ?? 1)) * 100))}%` }]} />
        </View>
        <BannerCta label={stripArrow(t('viewPlan'))} />
      </BannerShell>
    ) : (
      <BannerShell image={BANNER_IMAGES.plans} onPress={onPlansPress}>
        <Text style={cr.title} numberOfLines={1}>{t('subscriptionPlans')}</Text>
        <Text style={cr.sub} numberOfLines={2}>{t('saveMore')}</Text>
        <BannerCta label={stripArrow(t('viewPlans'))} />
      </BannerShell>
    ),
  })

  const bannerCount = banners.length
  const bannerCountRef = useRef(bannerCount)
  bannerCountRef.current = bannerCount
  const SNAP = BANNER_WIDTH + 12
  const isRTL = I18nManager.isRTL
  const initRef = useRef(false)

  const startAutoScroll = useCallback(() => {
    if (autoScrollTimer.current) clearInterval(autoScrollTimer.current)
    if (bannerCountRef.current <= 1) return
    autoScrollTimer.current = setInterval(() => {
      setActiveIndex(prev => {
        const count = bannerCountRef.current
        const next = isRTL ? (prev - 1 + count) % count : (prev + 1) % count
        scrollRef.current?.scrollTo({ x: next * SNAP, animated: true })
        return next
      })
    }, 4000)
  }, [isRTL])

  useEffect(() => {
    if (isRTL && bannerCount > 1 && !initRef.current) {
      initRef.current = true
      const lastIdx = bannerCount - 1
      setActiveIndex(lastIdx)
      setTimeout(() => scrollRef.current?.scrollTo({ x: lastIdx * SNAP, animated: false }), 50)
    }
    startAutoScroll()
    return () => { if (autoScrollTimer.current) clearInterval(autoScrollTimer.current) }
  }, [startAutoScroll, bannerCount, isRTL])

  const handleScrollBegin = () => {
    if (autoScrollTimer.current) clearInterval(autoScrollTimer.current)
    autoScrollTimer.current = null
  }

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x
    const idx = Math.round(x / SNAP)
    if (idx >= 0 && idx < bannerCount) setActiveIndex(idx)
    startAutoScroll()
  }

  return (
    <Animated.View entering={SlideIn.duration(250)} style={{ marginTop: 16 }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        nestedScrollEnabled={true}
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={handleScrollBegin}
        onMomentumScrollEnd={handleScrollEnd}
        snapToInterval={SNAP}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: 0 }}
      >
        {banners.map((b, i) => <View key={b.key} style={{ width: BANNER_WIDTH, marginRight: i < bannerCount - 1 ? 12 : 0 }}>{b.node}</View>)}
      </ScrollView>
      {banners.length > 1 && (
        <View style={[cr.dots, { flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row' }]}>
          {banners.map((b, i) => (
            <View key={b.key} style={[cr.dot, i === activeIndex ? { width: 18, backgroundColor: brand.primary } : { backgroundColor: brand.isDark ? '#2A3852' : '#D5DEEA' }]} />
          ))}
        </View>
      )}
    </Animated.View>
  )
}

export default function HomeScreen() {
  const { profile } = useAuth()
  const b = useBrand()
  const insets = useSafeAreaInsets()
  const { t, locale } = useLanguage()
  const en = locale === 'en'
  const { totalItems: cartCount } = useCart()
  const router = useRouter()
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSub, setActiveSub] = useState<any>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const SlideIn = I18nManager.isRTL ? FadeInRight : FadeInLeft
  const [bagOffer, setBagOffer] = useState<any>(null)
  const [ratingOrder, setRatingOrder] = useState<any>(null)
  const [ratingService, setRatingService] = useState(0)
  const [ratingDriver, setRatingDriver] = useState(0)
  const [ratingNote, setRatingNote] = useState('')
  const [ratingSubmitting, setRatingSubmitting] = useState(false)
  const [defaultAddress, setDefaultAddress] = useState<{ label: string } | null | undefined>(undefined)
  const [minPrices, setMinPrices] = useState<Record<string, number>>({})
  // Active service codes from the DB (dashboard → prices → services tab controls this).
  // Starts as null so we don't flash an "all hidden" state before the first fetch.
  const [activeServices, setActiveServices] = useState<Set<string> | null>(null)
  const shownRatingIds = useRef(new Set<string>())

  // Extra fields for the live order card and the order list (service, pieces, driver).
  const ORDER_FIELDS = 'id, order_number, status, total, created_at, service_type, items_count, driver_id, driver:users!orders_driver_id_fkey(name, phone)'

  const loadBagOffer = useCallback(async () => {
    const { data } = await supabase.from('settings').select('value').eq('key', 'bag_offer').single()
    let val = data?.value
    if (typeof val === 'string') try { val = JSON.parse(val) } catch {}
    if (val && typeof val === 'object' && val.enabled) setBagOffer(val)
    else setBagOffer(null)
  }, [])

  // Header address chip: the default address (else the first), same rule as the new-order screen.
  const loadDefaultAddress = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase.from('addresses').select('label, is_default')
      .eq('user_id', profile.id).order('is_default', { ascending: false }).limit(1)
    setDefaultAddress(data?.[0] ?? null)
  }, [profile])

  // "من X ج.م" on each service tile: the cheapest active price for that service.
  const loadMinPrices = useCallback(async () => {
    const { data } = await supabase.from('prices').select('service_type, price').eq('is_active', true)
    const mins: Record<string, number> = {}
    for (const p of data ?? []) {
      const v = Number(p.price)
      if (!Number.isFinite(v)) continue
      if (mins[p.service_type] == null || v < mins[p.service_type]) mins[p.service_type] = v
    }
    setMinPrices(mins)
  }, [])

  // Which service types are currently enabled by the dashboard. If the table or
  // network isn't reachable (old builds, offline), fall back to "show everything"
  // so the home never looks broken.
  const loadActiveServices = useCallback(async () => {
    const { data, error } = await supabase.from('services').select('code').eq('is_active', true)
    if (error || !data) { setActiveServices(null); return }
    setActiveServices(new Set(data.map(r => r.code)))
  }, [])

  const onRefresh = useCallback(async () => {
    if (!profile) return
    setRefreshing(true)
    setRefreshKey(k => k + 1)
    await Promise.all([
      supabase.from('orders').select(ORDER_FIELDS)
        .eq('customer_id', profile.id).order('created_at', { ascending: false }).limit(3)
        .then(({ data }) => setRecentOrders(data ?? [])),
      supabase.from('subscriptions').select('*, plans(name, items_per_month)')
        .eq('user_id', profile.id).eq('status', 'active').single()
        .then(({ data }) => setActiveSub(data)),
      supabase.from('notifications').select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id).is('read_at', null)
        .then(({ count }) => setUnreadCount(count ?? 0)),
      loadBagOffer(),
      loadDefaultAddress(),
      loadMinPrices(),
      loadActiveServices(),
    ])
    setRefreshing(false)
  }, [profile, loadBagOffer, loadDefaultAddress, loadMinPrices, loadActiveServices])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setRefreshKey(k => k + 1)
    })
    return () => sub.remove()
  }, [])

  const loadRecentOrders = useCallback(() => {
    if (!profile) return
    supabase.from('orders').select(ORDER_FIELDS)
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

  const handleOrderUpdate = useCallback(() => {
    loadRecentOrders()
    checkUnratedOrder()
  }, [loadRecentOrders, checkUnratedOrder])

  useRealtimeOrders(profile?.id, handleOrderUpdate)

  useEffect(() => {
    if (!profile) { setLoading(false); return }
    Promise.all([
      supabase.from('orders').select(ORDER_FIELDS)
        .eq('customer_id', profile.id).order('created_at', { ascending: false }).limit(3)
        .then(({ data }) => { setRecentOrders(data ?? []); setLoading(false) }),
      supabase.from('subscriptions').select('*, plans(name, items_per_month)')
        .eq('user_id', profile.id).eq('status', 'active').single()
        .then(({ data }) => setActiveSub(data)),
      supabase.from('notifications').select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id).is('read_at', null)
        .then(({ count }) => setUnreadCount(count ?? 0)),
      loadBagOffer(),
      checkUnratedOrder(),
      loadDefaultAddress(),
      loadMinPrices(),
      loadActiveServices(),
    ])

    const channel = supabase
      .channel('home-settings')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'settings',
        filter: 'key=eq.bag_offer',
      }, () => loadBagOffer())
      // Dashboard enables/disables a service → refresh the home tiles immediately.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'services' },
        () => { loadActiveServices(); loadMinPrices() })
      .subscribe((status, err) => {
        if (err) console.warn('home-settings realtime error:', err.message)
      })

    return () => { supabase.removeChannel(channel) }
  }, [profile, loadBagOffer])

  // The address may change on the addresses screen; refresh it whenever home comes back into view.
  useEffect(() => { loadDefaultAddress() }, [refreshKey, loadDefaultAddress])

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return t('goodMorning')
    if (h < 17) return t('goodAfternoon')
    return t('goodEvening')
  }

  const allServices = [
    { label: t('wash'), en: 'WASH', key: 'wash' },
    { label: t('dryClean'), en: 'DRY CLEAN', key: 'dry_clean' },
    { label: t('ironOnly'), en: 'IRON', key: 'iron' },
    { label: t('washIron'), en: 'WASH & IRON', key: 'wash_iron' },
    { label: t('housekeeping'), en: 'HOME', key: 'housekeeping' },
    { label: t('carpet') || 'سجاد وبطاطين', en: 'CARPETS', key: 'carpet' },
  ]
  // Null (not yet loaded, or offline fallback) = show everything so the home never
  // flashes empty on first render. Once the set loads, hide anything the dashboard disabled.
  const services = activeServices ? allServices.filter(s => activeServices.has(s.key)) : allServices
  const accessoriesEnabled = activeServices ? activeServices.has('accessories') : true
  const accessoriesLabel = en ? 'Accessories & Products' : 'منتجات وإكسسوارات'
  // The small kicker shows the other language: English words on the Arabic UI, Arabic on the English UI.
  const AR_NAMES: Record<string, string> = { wash: 'غسيل', dry_clean: 'تنظيف جاف', iron: 'كي فقط', wash_iron: 'غسيل وكي', housekeeping: 'تنظيف منازل', carpet: 'سجاد وبطاطين', accessories: 'منتجات' }

  const getStatusLabel = (status: string) => {
    const key = `status${status.charAt(0).toUpperCase() + status.slice(1).replace(/_([a-z])/g, (_, c) => c.toUpperCase())}` as any
    return t(key) || status
  }

  const serviceLabel = (key?: string | null) => {
    if (!key) return ''
    const first = key.split('+')[0]
    const svc = services.find(s => s.key === first)
    return svc?.label ?? (first === 'accessories' ? accessoriesLabel : '')
  }

  const liveOrder = useMemo(() => recentOrders.find(o => ACTIVE_STATUSES.includes(o.status)), [recentOrders])
  const liveStep = liveOrder ? Math.max(1, STATUS_FLOW.indexOf(liveOrder.status) + 1) : 0

  function callDriver(phone?: string | null) {
    if (phone) Linking.openURL(`tel:${phone}`).catch(() => {})
  }

  const priceFrom = (key: string) => minPrices[key] != null ? `${t('priceFrom')} ${money(minPrices[key])} ${t('currency')}` : ''

  const { scrollY, onScroll: onStickyScroll } = useStickyHeader(true)

  return (
    <>
    <StickyBar scrollY={scrollY} title={profile?.name ?? 'الرئيسية'} />
    <RNAnimated.ScrollView
      style={[s.container, { backgroundColor: b.page }]}
      contentContainerStyle={[s.content, { paddingTop: insets.top + 12 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={b.primary} colors={[b.primary]} />}
      onScroll={onStickyScroll}
      scrollEventThrottle={16}
    >
      <DotsBackdrop height={230 + insets.top} />

      {/* Header */}
      <Animated.View entering={SlideIn.duration(250)} style={s.header}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} accessibilityRole="button" accessibilityLabel={profile?.name ?? ''}>
          <LinearGradient colors={['#38BDF8', '#0EA5E9', '#0284C7']} style={s.avatarRing}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={[s.avatarImg, { borderColor: b.page }]} />
            ) : (
              <View style={[s.avatarImg, s.avatarFallback, { borderColor: b.page }]}>
                <Text style={s.avatarText}>{profile?.name?.[0] ?? '؟'}</Text>
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.greetSmall, { color: b.muted }]}>{greeting()} 👋</Text>
          <Text style={[s.greetName, { color: b.ink }]} numberOfLines={1}>{profile?.name ?? ''}</Text>
          {defaultAddress !== undefined && (
            <TouchableOpacity onPress={() => router.push('/addresses')} hitSlop={HIT} accessibilityRole="button" style={[s.addrChip, { backgroundColor: b.tint }]}>
              <MapPin size={12} color={b.tintText} />
              <Text style={[s.addrText, { color: b.tintText }]} numberOfLines={1}>{defaultAddress?.label ?? t('addNewAddress')}</Text>
              <ChevronDown size={12} color={b.tintText} />
            </TouchableOpacity>
          )}
        </View>
        <IconButton onPress={() => router.push('/cart')} label="Cart">
          <ShoppingBag size={19} color={cartCount > 0 ? b.ink : b.muted} />
          {cartCount > 0 && (
            <View style={[s.badge, { backgroundColor: b.primary, borderColor: b.raised }]}>
              <Text style={s.badgeText}>{cartCount > 9 ? '9+' : cartCount}</Text>
            </View>
          )}
        </IconButton>
        <IconButton onPress={() => router.push('/notifications')} label="Notifications">
          <Bell size={19} color={b.ink} />
          {unreadCount > 0 && (
            <View style={[s.badge, { backgroundColor: '#EF4444', borderColor: b.raised }]}>
              <Text style={s.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </IconButton>
      </Animated.View>

      {/* Live order: only while an order is in progress */}
      {liveOrder && (
        <Animated.View entering={SlideIn.duration(250).delay(60)}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => router.push(`/order/${liveOrder.id}`)}
            accessibilityRole="button"
            style={[s.live, { borderColor: b.tintBorder }, cardShadow(b)]}
          >
            <LinearGradient
              colors={b.isDark ? ['rgba(14,165,233,0.18)', 'rgba(14,165,233,0.04)'] : ['#E6F4FE', '#FFFFFF']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient colors={['#38BDF8', '#0284C7']} style={s.liveIcon}>
              {(() => { const L = statusLook(liveOrder.status).Icon; return <L size={21} color="#fff" /> })()}
            </LinearGradient>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.liveMeta, { color: b.tintText }]} numberOfLines={1}>
                {t('orderHash')}{cleanNumber(liveOrder.order_number)}{serviceLabel(liveOrder.service_type) ? ` · ${serviceLabel(liveOrder.service_type)}` : ''}
              </Text>
              <Text style={[s.liveTitle, { color: b.ink }]} numberOfLines={1}>{getStatusLabel(liveOrder.status)}</Text>
              <View style={{ flexDirection: 'row', marginTop: 7 }}>
                <Segments total={STATUS_FLOW.length} done={liveStep} />
              </View>
            </View>
            {liveOrder.driver?.phone ? (
              <IconButton onPress={() => callDriver(liveOrder.driver?.phone)} label="Call driver" tone="tint">
                <Phone size={17} color={b.accentIcon} />
              </IconButton>
            ) : null}
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Banners Carousel */}
      <BannersCarousel
        key={refreshKey}
        bagOffer={bagOffer}
        activeSub={activeSub}
        t={t}
        locale={locale}
        onBagPress={() => router.push('/bag-order')}
        onNewOrderPress={() => router.push('/(tabs)/new-order')}
        onPlansPress={() => router.push('/plans')}
      />

      {/* Services */}
      <SectionTitle eyebrow={t('homeEyebrowServices')} title={t('services')} />
      <View style={s.tiles}>
        {services.map((svc, i) => (
          <Animated.View key={svc.key} entering={SlideIn.duration(250).delay(50 + i * 20)} style={{ width: TILE_WIDTH }}>
            <TouchableOpacity
              activeOpacity={0.85}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/(tabs)/new-order', params: { service: svc.key } })}
              style={s.tile}
            >
              <Image source={SERVICE_IMAGES[svc.key]} style={StyleSheet.absoluteFill} resizeMode="cover" />
              <LinearGradient colors={['rgba(5,12,26,0)', 'rgba(5,12,26,0.82)']} locations={[0.38, 1]} style={StyleSheet.absoluteFill} />
              <View style={s.tileArrow}>{I18nManager.isRTL ? <ArrowUpLeft size={13} color="#fff" /> : <ArrowUpRight size={13} color="#fff" />}</View>
              <View style={s.tileText}>
                <Text style={s.kicker} numberOfLines={1}>{en ? AR_NAMES[svc.key] : svc.en}</Text>
                <Text style={s.tileName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{svc.label}</Text>
                {priceFrom(svc.key) ? <Text style={s.tilePrice}>{priceFrom(svc.key)}</Text> : null}
              </View>
            </TouchableOpacity>
          </Animated.View>
        ))}
        {accessoriesEnabled && (
        <TouchableOpacity
          activeOpacity={0.85}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/(tabs)/new-order', params: { service: 'accessories' } })}
          style={[s.tile, s.tileWide]}
        >
          <Image source={require('../../assets/services/shop-wide.webp')} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <LinearGradient colors={['rgba(5,12,26,0)', 'rgba(5,12,26,0.82)']} locations={[0.32, 1]} style={StyleSheet.absoluteFill} />
          <View style={s.tileArrow}>{I18nManager.isRTL ? <ArrowUpLeft size={13} color="#fff" /> : <ArrowUpRight size={13} color="#fff" />}</View>
          <View style={s.tileText}>
            <Text style={s.kicker}>{en ? AR_NAMES.accessories : 'SHOP'}</Text>
            <Text style={s.tileName}>{accessoriesLabel}</Text>
            {priceFrom('accessories') ? <Text style={s.tilePrice}>{priceFrom('accessories')}</Text> : null}
          </View>
        </TouchableOpacity>
        )}
      </View>

      {/* Recent Orders */}
      <SectionTitle
        eyebrow={t('homeEyebrowOrders')}
        title={t('recentOrders')}
        action={recentOrders.length > 0 ? stripArrow(t('viewAll')) : undefined}
        onAction={() => router.push('/(tabs)/orders')}
      />

      {loading ? (
        <>
          <SkeletonOrderCard />
          <SkeletonOrderCard />
        </>
      ) : recentOrders.length === 0 ? (
        <Animated.View entering={SlideIn.duration(250).delay(100)} style={[s.emptyCard, { backgroundColor: b.card, borderColor: b.cardBorder }]}>
          <View style={[s.emptyIcon, { backgroundColor: b.iconTile }]}><ClipboardList size={24} color={b.accentIcon} /></View>
          <Text style={[s.emptyText, { color: b.ink }]}>{t('noOrders')}</Text>
          <Text style={[s.emptySubText, { color: b.muted }]}>{t('startFirstOrder')}</Text>
        </Animated.View>
      ) : (
        <Animated.View entering={SlideIn.duration(250).delay(100)} style={[s.list, { backgroundColor: b.card, borderColor: b.cardBorder }, cardShadow(b)]}>
          {recentOrders.map((order, i) => {
            const look = statusLook(order.status)
            const svc = serviceLabel(order.service_type)
            const meta = [svc, order.items_count ? `${order.items_count} ${t('pieces')}` : '', shortDate(new Date(order.created_at), en)].filter(Boolean).join(' · ')
            return (
              <TouchableOpacity
                key={order.id}
                activeOpacity={0.8}
                accessibilityRole="button"
                onPress={() => router.push(`/order/${order.id}`)}
                style={[s.row, i > 0 && { borderTopWidth: 1, borderTopColor: b.divider }]}
              >
                <View style={[s.rowIcon, { backgroundColor: look.tone === 'ok' ? b.okTint : look.tone === 'danger' ? b.dangerTint : b.tint }]}>
                  <look.Icon size={19} color={look.tone === 'ok' ? b.okText : look.tone === 'danger' ? b.dangerText : b.tintText} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={s.rowTop}>
                    <Text style={[s.rowNum, { color: b.ink }]}>#{cleanNumber(order.order_number)}</Text>
                    <Pill label={getStatusLabel(order.status)} tone={look.tone} />
                  </View>
                  <Text style={[s.rowMeta, { color: b.muted }]} numberOfLines={1}>{meta}</Text>
                </View>
                <Text style={[s.rowPrice, { color: b.ink }]}>
                  {order.total > 0 ? <>{money(order.total)} <Text style={[s.rowCur, { color: b.muted }]}>{t('currency')}</Text></> : (en ? 'Plan' : 'باقة')}
                </Text>
                <ForwardChevron color={b.faint} size={15} />
              </TouchableOpacity>
            )
          })}
        </Animated.View>
      )}

      <View style={{ height: 100 }} />
    </RNAnimated.ScrollView>

    <RatingSheet
      visible={!!ratingOrder}
      orderNumber={ratingOrder?.order_number}
      showDriver={!!ratingOrder?.driver_id}
      service={ratingService}
      driver={ratingDriver}
      note={ratingNote}
      submitting={ratingSubmitting}
      onService={setRatingService}
      onDriver={setRatingDriver}
      onNote={setRatingNote}
      onSubmit={handleSubmitRating}
      onDismiss={dismissRating}
    />
    <WelcomeGiftPopup userId={profile?.id} onOrderNow={() => router.push('/new-order')} />
    </>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 100 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarRing: { width: 52, height: 52, borderRadius: 26, padding: 2.5 },
  avatarImg: { width: '100%', height: '100%', borderRadius: 24, borderWidth: 2.5 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#0EA5E9' },
  avatarText: { fontSize: 19, color: '#fff', fontFamily: F.display },
  greetSmall: { fontSize: 12.5, fontFamily: F.regular },
  greetName: { fontSize: 20, fontFamily: F.display, lineHeight: 28 },
  addrChip: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', height: 24, paddingHorizontal: 9, borderRadius: 12, marginTop: 3, maxWidth: '100%' },
  addrText: { fontSize: 11.5, fontFamily: F.semibold, flexShrink: 1 },
  badge: { position: 'absolute', top: -4, end: -4, minWidth: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderWidth: 2 },
  badgeText: { color: '#fff', fontSize: 9.5, fontFamily: F.bold },

  live: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  liveIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  liveMeta: { fontSize: 11, fontFamily: F.semibold },
  liveTitle: { fontSize: 15, fontFamily: F.display, marginTop: 1 },

  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { height: 116, borderRadius: 18, overflow: 'hidden', backgroundColor: '#0F1A2E' },
  tileWide: { width: '100%', height: 124 },
  tileArrow: { position: 'absolute', top: 8, end: 8, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  tileText: { position: 'absolute', start: 11, end: 11, bottom: 9 },
  kicker: { fontFamily: F.displaySemi, fontSize: 9, letterSpacing: 1.8, color: '#7DD3FC' },
  tileName: { fontFamily: F.display, fontSize: 17, color: '#fff', lineHeight: 23, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  tilePrice: { fontFamily: F.semibold, fontSize: 11, color: '#FCD34D' },

  list: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, minHeight: 64, paddingVertical: 10 },
  rowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  rowNum: { fontFamily: F.display, fontSize: 14 },
  rowMeta: { fontSize: 11.5, fontFamily: F.regular, marginTop: 3 },
  rowPrice: { fontFamily: F.display, fontSize: 15 },
  rowCur: { fontFamily: F.semibold, fontSize: 10 },

  emptyCard: { borderRadius: 18, padding: 28, alignItems: 'center', borderWidth: 1 },
  emptyIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  emptyText: { fontSize: 15, fontFamily: F.semibold },
  emptySubText: { fontSize: 12, marginTop: 4, fontFamily: F.regular },
})

const cr = StyleSheet.create({
  banner: { height: BANNER_HEIGHT, borderRadius: 20, overflow: 'hidden', backgroundColor: '#0F1A2E' },
  bannerText: { position: 'absolute', top: 0, bottom: 0, start: 0, width: '72%', paddingHorizontal: 16, justifyContent: 'center', alignItems: 'flex-start' },
  badges: { flexDirection: 'row', gap: 5, marginBottom: 5 },
  badgeHot: { backgroundColor: '#F59E0B', paddingHorizontal: 8, height: 20, justifyContent: 'center', borderRadius: 10 },
  badgeHotText: { color: '#3A2300', fontSize: 10.5, fontFamily: F.bold },
  badgeOff: { backgroundColor: '#EF4444', paddingHorizontal: 8, height: 20, justifyContent: 'center', borderRadius: 10 },
  badgeOffText: { color: '#fff', fontSize: 10.5, fontFamily: F.bold },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  prePill: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)', borderRadius: 8, paddingHorizontal: 7, height: 21, justifyContent: 'center' },
  prePillText: { color: '#fff', fontSize: 11, fontFamily: F.bold },
  brand: { color: '#fff', fontFamily: F.display, fontSize: 21, writingDirection: 'ltr' },
  brandAccent: { color: '#7DD3FC' },
  title: { color: '#fff', fontSize: 19, fontFamily: F.display, lineHeight: 27 },
  sub: { color: 'rgba(255,255,255,0.86)', fontSize: 12, fontFamily: F.regular, marginTop: 2, lineHeight: 18 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 },
  price: { color: '#FCD34D', fontSize: 21, fontFamily: F.display },
  priceCur: { fontSize: 11, fontFamily: F.semibold },
  oldPrice: { color: 'rgba(255,255,255,0.6)', fontSize: 12, textDecorationLine: 'line-through', fontFamily: F.regular },
  perDay: { color: 'rgba(255,255,255,0.8)', fontSize: 11.5, fontFamily: F.regular },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff', alignSelf: 'flex-start', paddingHorizontal: 12, height: SIZE.S, borderRadius: 12, marginTop: 9 },
  ctaText: { color: '#0284C7', fontSize: 12, fontFamily: F.bold },
  meter: { width: '100%', height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', marginTop: 7, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 3, backgroundColor: '#4ADE80' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3 },
})

