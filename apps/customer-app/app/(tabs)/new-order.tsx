import { useState, useEffect, useCallback, useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, RefreshControl, Platform } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withSequence, withTiming } from 'react-native-reanimated'
import { MapPin, Plus, Check, Lock, Crown, Settings2 } from 'lucide-react-native'
import { useAuth } from '../../src/contexts/AuthContext'
import { useCart } from '../../src/contexts/CartContext'
import { useLanguage } from '../../src/contexts/LanguageContext'
import { useCustomAlert } from '../../src/components/CustomAlert'
import { SkeletonPage } from '../../src/components/Skeleton'
import { supabase } from '../../src/lib/supabase'
import { useBrand, Card, Chip, Pill, Stepper, DotsBackdrop, ForwardIcon, money, cardShadow, F, SIZE, HIT, type Brand } from '../../src/components/brand'

const services = [
  { key: 'wash', icon: '👔', label: 'غسيل', labelEn: 'Wash' },
  { key: 'dry_clean', icon: '🧹', label: 'تنظيف جاف', labelEn: 'Dry Clean' },
  { key: 'iron', icon: '👕', label: 'كي فقط', labelEn: 'Iron Only' },
  { key: 'wash_iron', icon: '✨', label: 'غسيل وكي', labelEn: 'Wash & Iron' },
  { key: 'housekeeping', icon: '🏠', label: 'تنظيف منازل', labelEn: 'House Keeping' },
  { key: 'carpet', icon: '🛋️', label: 'سجاد وبطاطين', labelEn: 'Carpets & Blankets' },
  { key: 'accessories', icon: '🛍️', label: 'منتجات وإكسسوارات', labelEn: 'Accessories & Products' },
]

const SERVICE_IMG: Record<string, any> = {
  wash: require('../../assets/services/wash.webp'),
  dry_clean: require('../../assets/services/dry.webp'),
  iron: require('../../assets/services/iron.webp'),
  wash_iron: require('../../assets/services/washiron.webp'),
  housekeeping: require('../../assets/services/home.webp'),
  carpet: require('../../assets/services/carpet.webp'),
  accessories: require('../../assets/services/shop.webp'),
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://kjqtrmedkvqfofwymoni.supabase.co'

// Matches the absolute tab bar in app/(tabs)/_layout.tsx (bottom 16 / 24 on iOS, height 68). The centre
// + button pokes ~28px above the bar, so the checkout bar sits above that with a small gap.
const TAB_BOTTOM = Platform.OS === 'ios' ? 24 : 16
const TAB_H = 68
const FAB_POKE = 28
const BAR_BOTTOM = TAB_BOTTOM + TAB_H + FAB_POKE + 6
const BAR_H = 56

function StepTitle({ n, title, b }: { n: number; title: string; b: Brand }) {
  return (
    <View style={s.stepRow}>
      <View style={[s.stepDot, { backgroundColor: b.primary }]}>
        <Text style={s.stepNum}>{n}</Text>
      </View>
      <Text style={[s.stepTitle, { color: b.ink }]}>{title}</Text>
    </View>
  )
}

function PinTile() {
  return (
    <LinearGradient colors={['#38BDF8', '#0284C7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.pinTile}>
      <MapPin size={18} color="#fff" />
    </LinearGradient>
  )
}

export default function NewOrderScreen() {
  const { profile } = useAuth()
  const { cart, addItem, removeItem, updateQuantity, totalPrice, totalItems, lastAddedIndex, clearLastAdded } = useCart()
  const { t, locale } = useLanguage()
  const router = useRouter()
  const params = useLocalSearchParams<{ service?: string }>()
  const { showAlert, AlertComponent } = useCustomAlert()
  const b = useBrand()
  const insets = useSafeAreaInsets()

  const [prices, setPrices] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [addresses, setAddresses] = useState<any[]>([])
  const [selectedAddress, setSelectedAddress] = useState<any>(null)
  const [selectedService, setSelectedService] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})
  const [activeCatId, setActiveCatId] = useState<string | null>(null)
  const [showAddressPicker, setShowAddressPicker] = useState(false)
  const [activeSub, setActiveSub] = useState<any>(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [closed, setClosed] = useState(false)
  const [workHoursText, setWorkHoursText] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const barScale = useSharedValue(1)
  const badgeBounce = useSharedValue(1)

  useEffect(() => {
    if (lastAddedIndex !== null) {
      barScale.value = withSequence(withTiming(0.95, { duration: 100 }), withSpring(1, { damping: 8 }))
      badgeBounce.value = withSequence(withTiming(1.4, { duration: 120 }), withSpring(1, { damping: 6 }))
      clearLastAdded()
    }
  }, [lastAddedIndex])

  const barAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: barScale.value }] }))
  const badgeAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: badgeBounce.value }] }))

  const loadData = useCallback(async () => {
    const [pricesRes, catsRes, settingsRes] = await Promise.all([
      supabase.from('prices').select('id, item_type, service_type, price, category_id').eq('is_active', true),
      supabase.from('categories').select('id, name, icon, sort_order').eq('is_active', true).order('sort_order'),
      supabase.from('settings').select('key, value').in('key', ['open_hour', 'close_hour', 'working_hours_enabled']),
    ])
    setPrices(pricesRes.data ?? [])
    const cats = catsRes.data ?? []
    setCategories(cats)
    const sMap: Record<string, string> = {}
    settingsRes.data?.forEach((s: any) => { sMap[s.key] = String(s.value) })
    const enabled = sMap['working_hours_enabled'] !== 'false'
    setClosed(false)
    if (enabled && sMap['open_hour'] && sMap['close_hour']) {
      const now = new Date()
      const [oh, om] = sMap['open_hour'].split(':').map(Number)
      const [ch, cm] = sMap['close_hour'].split(':').map(Number)
      const nowMins = now.getHours() * 60 + now.getMinutes()
      const openMins = oh * 60 + om
      const closeMins = ch * 60 + cm
      const isOpen = closeMins > openMins ? (nowMins >= openMins && nowMins < closeMins) : (nowMins >= openMins || nowMins < closeMins)
      if (!isOpen) {
        setClosed(true)
        const fmtTime = (h: number, m: number) => {
          const period = h >= 12 ? 'م' : 'ص'
          const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
          return `${h12}${m > 0 ? ':' + String(m).padStart(2, '0') : ''} ${period}`
        }
        setWorkHoursText(`${fmtTime(oh, om)} — ${fmtTime(ch, cm)}`)
      }
    }
    if (profile) {
      await Promise.all([
        supabase.from('addresses').select('id, label, building, floor, apartment, lat, lng, is_default').eq('user_id', profile.id).order('is_default', { ascending: false })
          .then(({ data }) => {
            setAddresses(data ?? [])
            const def = data?.find((a: any) => a.is_default) ?? data?.[0]
            if (def) setSelectedAddress(def)
          }),
        supabase.from('subscriptions').select('*, plans(name)').eq('user_id', profile.id).eq('status', 'active').single()
          .then(({ data }) => setActiveSub(data)),
      ])
    }
  }, [profile])

  useEffect(() => {
    loadData().then(() => {
      setDataLoading(false)
      if (params.service) setSelectedService(params.service)
    })
  }, [profile])

  useEffect(() => {
    if (params.service) setSelectedService(params.service)
  }, [params.service])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }, [loadData])

  const subRemaining = activeSub ? activeSub.items_limit - activeSub.items_used : null

  const getPrice = useCallback((itemType: string, serviceType: string) => {
    return prices.find(p => p.item_type === itemType && p.service_type === serviceType)?.price ?? 0
  }, [prices])

  const availableServicesForScreen = useMemo(() => {
    const activeServiceKeys = [...new Set(prices.map(p => p.service_type))]
    return services.filter(s => activeServiceKeys.includes(s.key))
  }, [prices])

  const categoriesWithItems = useMemo(() => {
    if (!selectedService) return []
    return categories.map(cat => {
      const itemTypes = [...new Set(prices.filter(p => p.category_id === cat.id && p.service_type === selectedService).map(p => p.item_type))] as string[]
      return { ...cat, itemTypes }
    }).filter(cat => cat.itemTypes.length > 0)
  }, [selectedService, categories, prices])

  const toggleCategory = useCallback((catId: string) => {
    setExpandedCategories(prev => ({ ...prev, [catId]: !prev[catId] }))
  }, [])

  useEffect(() => {
    if (categoriesWithItems.length > 0) {
      const first = categoriesWithItems[0]
      setExpandedCategories(prev => {
        if (prev[first.id] !== undefined) return prev
        return { ...prev, [first.id]: true }
      })
      setActiveCatId(prev => {
        if (prev && categoriesWithItems.some(c => c.id === prev)) return prev
        return first.id
      })
    }
  }, [categoriesWithItems])

  const [justAdded, setJustAdded] = useState<string | null>(null)

  const handleAddItem = (itemType: string) => {
    if (!selectedService) return
    const unitPrice = getPrice(itemType, selectedService)
    if (unitPrice === 0) return
    addItem({ name: itemType, service_type: selectedService, quantity: 1, price: unitPrice })
    setJustAdded(itemType)
    setTimeout(() => setJustAdded(null), 800)
  }

  const catName = (name: string) => locale === 'en' ? (t(`cat:${name}`) !== `cat:${name}` ? t(`cat:${name}`) : name) : name
  const itemName = (name: string) => locale === 'en' ? (t(`item:${name}`) !== `item:${name}` ? t(`item:${name}`) : name) : name
  const pName = (name: string) => locale === 'en' ? (t(`plan:${name}` as any) !== `plan:${name}` ? t(`plan:${name}` as any) : name) : name

  if (dataLoading) {
    return <SkeletonPage />
  }

  const addrDetails = (a: any) => [a.building, a.floor ? `ط${a.floor}` : '', a.apartment ? `ش${a.apartment}` : ''].filter(Boolean).join(' · ')
  const cartServices = [...new Set(cart.map(c => c.service_type))].filter(k => SERVICE_IMG[k]).slice(0, 2)
  const barInk = b.isDark ? '#E8EEF7' : b.ink
  const barMuted = b.isDark ? '#9FB6D6' : b.muted
  const inCartTint = b.isDark ? 'rgba(14,165,233,0.08)' : '#F0F8FF'

  return (
    <>
      <ScrollView
        style={[s.container, { backgroundColor: b.page }]}
        contentContainerStyle={[s.content, { paddingTop: insets.top + 14, paddingBottom: BAR_BOTTOM + BAR_H + 24 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={b.primary} colors={[b.primary]} />}
      >
        <DotsBackdrop height={insets.top + 190} />
        <Text style={[s.title, { color: b.ink }]}>{t('newOrder')}</Text>

        {closed && (
          <View style={[s.banner, { backgroundColor: b.warnTint, borderColor: 'rgba(245,158,11,0.32)' }]}>
            <View style={[s.bannerIcon, { backgroundColor: 'rgba(245,158,11,0.16)' }]}>
              <Lock size={18} color={b.isDark ? '#FBBF24' : '#B45309'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.bannerTitle, { color: b.isDark ? '#FBBF24' : '#B45309' }]}>المغسلة مغلقة حالياً</Text>
              <Text style={[s.bannerText, { color: b.warnText }]}>ساعات العمل: {workHoursText}</Text>
            </View>
          </View>
        )}

        {activeSub && subRemaining !== null && (
          <View style={[s.banner, s.bannerCol, { backgroundColor: b.tint, borderColor: b.tintBorder }]}>
            <View style={s.subRow}>
              <View style={[s.bannerIcon, { backgroundColor: b.isDark ? 'rgba(252,211,77,0.14)' : '#FFF6D6' }]}>
                <Crown size={18} color={b.isDark ? b.gold : '#B45309'} />
              </View>
              <Text style={[s.subName, { color: b.ink }]} numberOfLines={1}>{pName(activeSub.plans?.name ?? '') || t('subscriptionPlans')}</Text>
              <Text style={[s.subRemaining, { color: b.tintText }]}>{Math.max(0, subRemaining - totalItems)} {t('remaining')}</Text>
            </View>
            <View style={[s.subTrack, { backgroundColor: b.isDark ? '#22304A' : '#D9E9F7' }]}>
              <View style={[s.subFill, { backgroundColor: b.primary, width: `${Math.min(100, ((activeSub.items_used + totalItems) / activeSub.items_limit) * 100)}%` }]} />
            </View>
            <Text style={[s.bannerText, { color: b.muted }]}>
              {totalItems > 0
                ? locale === 'en'
                  ? `${Math.min(totalItems, subRemaining)} pieces from your plan (free)${totalItems > subRemaining ? ` + ${totalItems - subRemaining} charged separately` : ''}`
                  : `سيتم خصم ${Math.min(totalItems, subRemaining)} قطعة من باقتك (مجاناً)${totalItems > subRemaining ? ` + ${totalItems - subRemaining} قطعة محاسبة منفصلة` : ''}`
                : `${activeSub.items_used} / ${activeSub.items_limit} ${locale === 'en' ? 'used' : 'قطعة مستخدمة'}`}
            </Text>
          </View>
        )}

        <StepTitle n={1} title={t('pickupAddress')} b={b} />
        {addresses.length === 0 ? (
          <TouchableOpacity
            style={[s.dashedBtn, { borderColor: b.isDark ? 'rgba(56,189,248,0.35)' : '#BFDDF7' }]}
            onPress={() => router.push('/addresses')}
            accessibilityRole="button"
          >
            <MapPin size={16} color={b.accentIcon} />
            <Text style={[s.dashedText, { color: b.accentIcon }]}>{locale === 'en' ? 'Add new address' : 'إضافة عنوان جديد'}</Text>
          </TouchableOpacity>
        ) : showAddressPicker ? (
          <Card pad={false} style={s.listCard}>
            {addresses.map((addr, i) => {
              const on = selectedAddress?.id === addr.id
              return (
                <TouchableOpacity
                  key={addr.id}
                  onPress={() => { setSelectedAddress(addr); setShowAddressPicker(false) }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={[s.addrPickRow, i > 0 && { borderTopWidth: 1, borderTopColor: b.divider }, on && { backgroundColor: inCartTint }]}
                >
                  <View style={[s.radio, { borderColor: on ? b.primary : b.raisedBorder }, on && { borderWidth: 5 }]} />
                  <View style={s.addrBody}>
                    <Text style={[s.addrLabel, { color: b.ink }]} numberOfLines={1}>{addr.label}</Text>
                    {addr.building ? <Text style={[s.addrDetail, { color: b.muted }]} numberOfLines={1}>{addrDetails(addr)}</Text> : null}
                  </View>
                </TouchableOpacity>
              )
            })}
            <View style={[s.pickFooter, { borderTopColor: b.divider }]}>
              <Chip
                label={locale === 'en' ? 'Manage addresses' : 'إدارة العناوين'}
                onPress={() => router.push('/addresses')}
                icon={<Settings2 size={13} color={b.muted} />}
              />
            </View>
          </Card>
        ) : selectedAddress ? (
          <Card pad={false} style={s.addrCard}>
            <PinTile />
            <View style={s.addrBody}>
              <Text style={[s.addrLabel, { color: b.ink }]} numberOfLines={1}>{selectedAddress.label}</Text>
              {selectedAddress.building ? <Text style={[s.addrDetail, { color: b.muted }]} numberOfLines={1}>{addrDetails(selectedAddress)}</Text> : null}
            </View>
            <TouchableOpacity
              onPress={() => setShowAddressPicker(true)}
              hitSlop={HIT}
              accessibilityRole="button"
              style={[s.changeChip, { backgroundColor: b.tint, borderColor: b.tintBorder }]}
            >
              <Text style={[s.changeChipText, { color: b.tintText }]}>{locale === 'en' ? 'Change' : 'تغيير'}</Text>
            </TouchableOpacity>
          </Card>
        ) : null}

        <StepTitle n={2} title={locale === 'en' ? 'Service type' : 'نوع الخدمة'} b={b} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.bleed} contentContainerStyle={s.svcRow}>
          {availableServicesForScreen.map(svc => {
            const on = selectedService === svc.key
            const name = locale === 'en' ? svc.labelEn : svc.label
            const kickerEn = locale !== 'en'
            return (
              <TouchableOpacity
                key={svc.key}
                onPress={() => { setSelectedService(svc.key); setExpandedCategories({}) }}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={name}
                style={s.svcTile}
              >
                <View style={[s.svcPhoto, { borderColor: on ? b.primary : 'transparent', backgroundColor: b.iconTile }]}>
                  {SERVICE_IMG[svc.key] ? <Image source={SERVICE_IMG[svc.key]} style={s.svcImg} resizeMode="cover" /> : null}
                </View>
                {on ? (
                  <View style={[s.svcCheck, { backgroundColor: b.primary, borderColor: b.page }]}>
                    <Check size={11} color="#fff" />
                  </View>
                ) : null}
                <Text
                  style={[s.svcKicker, kickerEn ? { letterSpacing: 1.1, fontFamily: F.displaySemi } : { fontFamily: F.semibold }]}
                  numberOfLines={1}
                >
                  {kickerEn ? svc.labelEn.toUpperCase() : svc.label}
                </Text>
                <Text style={[s.svcName, { color: on ? b.primary : b.ink2 }]} numberOfLines={2}>{name}</Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>

        {selectedService && categoriesWithItems.length > 0 && (
          <>
            <StepTitle n={3} title={locale === 'en' ? 'Choose item' : 'اختر القطعة'} b={b} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.bleed} contentContainerStyle={s.catRow}>
              {categoriesWithItems.map(cat => (
                <Chip
                  key={cat.id}
                  label={catName(cat.name)}
                  active={activeCatId === cat.id}
                  onPress={() => setActiveCatId(cat.id)}
                  icon={cat.icon ? <Text style={s.catEmoji}>{cat.icon}</Text> : undefined}
                />
              ))}
            </ScrollView>
            {categoriesWithItems.filter(cat => cat.id === activeCatId).map(cat => (
              <Card key={cat.id} pad={false} style={s.itemsCard}>
                {cat.itemTypes.map((itemType: string, idx: number) => {
                  const price = getPrice(itemType, selectedService)
                  const inCart = cart.find(c => c.name === itemType && c.service_type === selectedService)
                  const isFirst = idx === 0
                  const tinted = !!inCart || justAdded === itemType
                  return (
                    <View
                      key={itemType}
                      style={[s.itemRow, idx > 0 && { borderTopWidth: 1, borderTopColor: b.divider }, tinted && { backgroundColor: inCartTint }]}
                    >
                      <View style={s.itemBody}>
                        <View style={s.itemNameRow}>
                          <Text style={[s.itemName, { color: b.ink }]} numberOfLines={1}>{itemName(itemType)}</Text>
                          {isFirst && <Pill tone="warn" label={locale === 'en' ? '🔥 Most ordered' : '🔥 الأكثر طلباً'} />}
                        </View>
                        <Text style={[s.itemPrice, { color: b.muted }]} numberOfLines={1}>
                          <Text style={[s.itemPriceNum, { color: b.isDark ? '#38BDF8' : '#0284C7' }]}>{money(price)}</Text>
                          {' '}{t('currency')} · {locale === 'en' ? 'per piece' : 'لكل قطعة'}
                        </Text>
                      </View>
                      {inCart ? (
                        <Stepper
                          qty={inCart.quantity}
                          onRemove={() => { const i = cart.indexOf(inCart); removeItem(i) }}
                          onMinus={() => { const i = cart.indexOf(inCart); updateQuantity(i, inCart.quantity - 1) }}
                          onPlus={() => { const i = cart.indexOf(inCart); updateQuantity(i, inCart.quantity + 1) }}
                        />
                      ) : (
                        <TouchableOpacity
                          onPress={() => !closed && handleAddItem(itemType)}
                          disabled={closed}
                          hitSlop={HIT}
                          accessibilityRole="button"
                          accessibilityLabel={`+ ${itemName(itemType)}`}
                          style={[
                            s.addBtn,
                            { backgroundColor: closed ? b.disabled : b.primary },
                            !closed && { shadowColor: b.primary, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
                          ]}
                        >
                          <Plus size={18} color="#fff" />
                        </TouchableOpacity>
                      )}
                    </View>
                  )
                })}
              </Card>
            ))}
          </>
        )}
      </ScrollView>

      {cart.length > 0 && (
        <Animated.View style={[s.floatingBar, { bottom: BAR_BOTTOM }, barAnimStyle]}>
          <View style={[s.barRing, { backgroundColor: b.isDark ? 'rgba(14,165,233,0.10)' : 'rgba(14,165,233,0.08)' }]}>
            <TouchableOpacity
              style={[s.barShell, { backgroundColor: b.isDark ? '#142848' : '#FFFFFF', shadowColor: b.isDark ? '#000' : '#10284F' }]}
              activeOpacity={0.9}
              onPress={() => router.push('/cart')}
              accessibilityRole="button"
              accessibilityLabel={locale === 'en' ? 'Complete order' : 'إتمام الطلب'}
            >
              {b.isDark ? (
                <LinearGradient colors={['#1B3560', '#142848', '#10213D']} locations={[0, 0.55, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.barFill} />
              ) : null}
              {b.isDark ? <View pointerEvents="none" style={s.barHighlight} /> : null}
              {cartServices.length > 0 ? (
                <View style={s.thumbs}>
                  {cartServices.map((k, i) => (
                    <Image
                      key={k}
                      source={SERVICE_IMG[k]}
                      style={[s.thumb, { borderColor: b.isDark ? '#17305A' : '#FFFFFF' }, i > 0 && { marginStart: -9 }]}
                    />
                  ))}
                </View>
              ) : null}
              <View style={s.barSum}>
                <Animated.View style={[s.barCountWrap, badgeAnimStyle]}>
                  <Text style={[s.barCount, { color: barMuted }]}>{totalItems} {t('pieces')}</Text>
                </Animated.View>
                <Text style={[s.barTotal, { color: barInk }]} numberOfLines={1}>
                  {money(totalPrice)} <Text style={[s.barCur, { color: barMuted }]}>{t('currency')}</Text>
                </Text>
              </View>
              <View style={[s.barCta, { shadowColor: b.primary }]}>
                <LinearGradient colors={['#38BDF8', '#0284C7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.barCtaFill} />
                <Text style={s.barCtaText}>{locale === 'en' ? 'Complete order' : 'إتمام الطلب'}</Text>
                <ForwardIcon color="#fff" size={16} />
              </View>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {AlertComponent}
    </>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16 },
  title: { fontFamily: F.display, fontSize: 22, marginBottom: 6 },

  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, marginBottom: 10, marginHorizontal: 2 },
  stepDot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepNum: { color: '#fff', fontSize: 11, fontFamily: F.bold, lineHeight: 14 },
  stepTitle: { fontFamily: F.display, fontSize: 16 },

  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1, padding: 12, marginTop: 12 },
  bannerCol: { flexDirection: 'column', alignItems: 'stretch', gap: 8 },
  bannerIcon: { width: SIZE.ICON, height: SIZE.ICON, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { fontSize: 14, fontFamily: F.bold },
  bannerText: { fontSize: 12, fontFamily: F.medium, marginTop: 1 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  subName: { flex: 1, fontSize: 14, fontFamily: F.bold },
  subRemaining: { fontSize: 13, fontFamily: F.bold },
  subTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  subFill: { height: '100%', borderRadius: 3 },

  dashedBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: SIZE.M, borderRadius: SIZE.rM, borderWidth: 1.5, borderStyle: 'dashed' },
  dashedText: { fontSize: 13, fontFamily: F.bold },
  addrCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  pinTile: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  addrBody: { flex: 1, minWidth: 0 },
  addrLabel: { fontSize: 14, fontFamily: F.bold },
  addrDetail: { fontSize: 11.5, fontFamily: F.regular, marginTop: 1 },
  changeChip: { height: SIZE.S - 4, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  changeChipText: { fontSize: 12, fontFamily: F.bold },
  listCard: { overflow: 'hidden' },
  addrPickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: SIZE.M + 8, paddingHorizontal: 12, paddingVertical: 8 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, backgroundColor: '#fff' },
  pickFooter: { flexDirection: 'row', justifyContent: 'flex-end', padding: 8, borderTopWidth: 1 },

  bleed: { marginHorizontal: -16 },
  svcRow: { gap: 10, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 2 },
  svcTile: { width: 76, alignItems: 'center' },
  svcPhoto: { width: 76, height: 76, borderRadius: 18, borderWidth: 2, overflow: 'hidden' },
  svcImg: { width: '100%', height: '100%' },
  svcCheck: { position: 'absolute', top: -4, start: -4, width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  svcKicker: { fontSize: 8, color: '#38BDF8', marginTop: 6, textAlign: 'center' },
  svcName: { fontSize: 11.5, fontFamily: F.semibold, lineHeight: 16, textAlign: 'center' },

  catRow: { gap: 7, paddingHorizontal: 16, paddingVertical: 2 },
  catEmoji: { fontSize: 13 },
  itemsCard: { marginTop: 12, overflow: 'hidden' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 58, paddingHorizontal: 12, paddingVertical: 9 },
  itemBody: { flex: 1, minWidth: 0 },
  itemNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemName: { fontSize: 14, fontFamily: F.bold, flexShrink: 1 },
  itemPrice: { fontSize: 11.5, fontFamily: F.medium, marginTop: 2 },
  itemPriceNum: { fontSize: 13.5, fontFamily: F.display },
  addBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  floatingBar: { position: 'absolute', left: 12, right: 12 },
  barRing: { borderRadius: 22, padding: 4 },
  barShell: {
    flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: BAR_H - 2,
    borderRadius: 18, borderWidth: 1, borderColor: 'rgba(56,189,248,0.45)',
    paddingVertical: 7, paddingStart: 12, paddingEnd: 7,
    shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 22, elevation: 14,
  },
  barFill: { ...StyleSheet.absoluteFillObject, borderRadius: 17 },
  barHighlight: { position: 'absolute', top: 0, left: 14, right: 14, height: 1, backgroundColor: 'rgba(142,193,255,0.25)' },
  thumbs: { flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 28, height: 28, borderRadius: 9, borderWidth: 2 },
  barSum: { flex: 1, minWidth: 0 },
  barCountWrap: { alignSelf: 'flex-start' },
  barCount: { fontSize: 11, fontFamily: F.semibold },
  barTotal: { fontSize: 17, fontFamily: F.display },
  barCur: { fontSize: 11, fontFamily: F.semibold },
  barCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 42, borderRadius: 13, paddingHorizontal: 14,
    shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  barCtaFill: { ...StyleSheet.absoluteFillObject, borderRadius: 13 },
  barCtaText: { color: '#fff', fontSize: 13.5, fontFamily: F.bold },
})
