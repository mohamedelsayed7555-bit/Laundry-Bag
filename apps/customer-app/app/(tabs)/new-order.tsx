import { useState, useEffect, useCallback, useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, RefreshControl } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withSequence, withTiming } from 'react-native-reanimated'
import { useAuth } from '../../src/contexts/AuthContext'
import { useCart } from '../../src/contexts/CartContext'
import { useTheme } from '../../src/contexts/ThemeContext'
import { useLanguage } from '../../src/contexts/LanguageContext'
import { useCustomAlert } from '../../src/components/CustomAlert'
import { supabase } from '../../src/lib/supabase'

const services = [
  { key: 'wash', icon: '👔', label: 'غسيل', labelEn: 'Wash' },
  { key: 'dry_clean', icon: '🧹', label: 'تنظيف جاف', labelEn: 'Dry Clean' },
  { key: 'iron', icon: '👕', label: 'كي فقط', labelEn: 'Iron Only' },
  { key: 'wash_iron', icon: '✨', label: 'غسيل وكي', labelEn: 'Wash & Iron' },
]

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!

export default function NewOrderScreen() {
  const { profile } = useAuth()
  const { cart, addItem, removeItem, updateQuantity, totalPrice, totalItems, lastAddedIndex, clearLastAdded } = useCart()
  const { colors } = useTheme()
  const { t, locale } = useLanguage()
  const router = useRouter()
  const { showAlert, AlertComponent } = useCustomAlert()

  const [prices, setPrices] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [addresses, setAddresses] = useState<any[]>([])
  const [selectedAddress, setSelectedAddress] = useState<any>(null)
  const [selectedItemType, setSelectedItemType] = useState('')
  const [selectedService, setSelectedService] = useState('')
  const [itemQty, setItemQty] = useState(1)
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
    if (cats.length > 0 && !selectedCategory) setSelectedCategory(cats[0].id)
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
        supabase.from('addresses').select('id, label, address, lat, lng, is_default').eq('user_id', profile.id).order('is_default', { ascending: false })
          .then(({ data }) => {
            setAddresses(data ?? [])
            const def = data?.find((a: any) => a.is_default) ?? data?.[0]
            if (def) setSelectedAddress(def)
          }),
        supabase.from('subscriptions').select('*, plans(name)').eq('user_id', profile.id).eq('status', 'active').single()
          .then(({ data }) => setActiveSub(data)),
      ])
    }
  }, [profile, selectedCategory])

  useEffect(() => {
    loadData().then(() => setDataLoading(false))
  }, [profile])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }, [loadData])

  const subRemaining = activeSub ? activeSub.items_limit - activeSub.items_used : null

  const getPrice = useCallback((itemType: string, serviceType: string) => {
    return prices.find(p => p.item_type === itemType && p.service_type === serviceType)?.price ?? 0
  }, [prices])

  const filteredItemTypes = useMemo(() => {
    if (!selectedCategory) return []
    return [...new Set(prices.filter(p => p.category_id === selectedCategory).map(p => p.item_type))] as string[]
  }, [selectedCategory, prices])

  const availableServices = useMemo(() => {
    if (!selectedItemType) return []
    return services.filter(s => prices.some(p => p.item_type === selectedItemType && p.service_type === s.key))
  }, [selectedItemType, prices])

  const handleAddToCart = () => {
    if (!selectedItemType || !selectedService) return
    const unitPrice = getPrice(selectedItemType, selectedService)
    if (unitPrice === 0) return
    addItem({ name: selectedItemType, service_type: selectedService, quantity: itemQty, price: unitPrice })
    setSelectedItemType('')
    setSelectedService('')
    setItemQty(1)
  }

  const svcLabel = (key: string) => {
    const svc = services.find(s => s.key === key)
    if (!svc) return key
    return locale === 'en' ? svc.labelEn : svc.label
  }

  const catName = (name: string) => locale === 'en' ? (t(`cat:${name}`) !== `cat:${name}` ? t(`cat:${name}`) : name) : name
  const itemName = (name: string) => locale === 'en' ? (t(`item:${name}`) !== `item:${name}` ? t(`item:${name}`) : name) : name
  const pName = (name: string) => locale === 'en' ? (t(`plan:${name}` as any) !== `plan:${name}` ? t(`plan:${name}` as any) : name) : name

  if (dataLoading) {
    return (
      <View style={[s.loadingContainer, { backgroundColor: colors.navy[900] }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <>
      <ScrollView style={[s.container, { backgroundColor: colors.navy[900] }]} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}>
        <Text style={[s.title, { color: colors.text }]}>{t('newOrder')}</Text>

        {closed && (
          <View style={[s.closedBanner, { backgroundColor: '#ef444415', borderColor: '#ef444430' }]}>
            <Text style={s.closedIcon}>🔒</Text>
            <Text style={s.closedTitle}>المغسلة مغلقة حالياً</Text>
            <Text style={s.closedHours}>ساعات العمل: {workHoursText}</Text>
          </View>
        )}

        {activeSub && subRemaining !== null && (
          <View style={[s.subBanner, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}>
            <View style={s.subBannerRow}>
              <Text style={[s.subBannerName, { color: colors.text }]}>👑 {pName(activeSub.plans?.name ?? '') || t('subscriptionPlans')}</Text>
              <Text style={[s.subBannerRemaining, { color: colors.primary }]}>{subRemaining - totalItems} {t('remaining')}</Text>
            </View>
            <View style={[s.subProgressBar, { backgroundColor: colors.navy[700] }]}>
              <View style={[s.subProgressFill, { backgroundColor: colors.primary, width: `${Math.min(100, ((activeSub.items_used + totalItems) / activeSub.items_limit) * 100)}%` }]} />
            </View>
            <Text style={[s.subBannerHint, { color: colors.navy[300] }]}>
              {totalItems > 0
                ? locale === 'en'
                  ? `${totalItems} pieces from your plan (${subRemaining - totalItems >= 0 ? 'free' : 'exceeded!'})`
                  : `سيتم خصم ${totalItems} قطعة من باقتك (${subRemaining - totalItems >= 0 ? 'مجاناً' : 'تجاوزت الرصيد!'})`
                : `${activeSub.items_used} / ${activeSub.items_limit} ${locale === 'en' ? 'used' : 'قطعة مستخدمة'}`}
            </Text>
          </View>
        )}

        <Text style={[s.sectionTitle, { color: colors.text }]}>{t('pickupAddress')}</Text>
        {addresses.length === 0 ? (
          <TouchableOpacity style={[s.addAddressBtn, { backgroundColor: colors.cardBg, borderColor: colors.primary }]} onPress={() => router.push('/addresses')}>
            <Text style={[s.addAddressText, { color: colors.primary }]}>📍 {locale === 'en' ? 'Add new address' : 'إضافة عنوان جديد'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.addressList}>
            {addresses.map(addr => (
              <TouchableOpacity key={addr.id} onPress={() => setSelectedAddress(addr)}
                style={[s.addressCard, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }, selectedAddress?.id === addr.id && { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}>
                <Text style={[s.addressLabel, { color: colors.text }]}>📍 {addr.label}</Text>
                {addr.building && <Text style={[s.addressDetail, { color: colors.navy[300] }]}>{addr.building}{addr.floor ? ` - ط${addr.floor}` : ''}{addr.apartment ? ` - ش${addr.apartment}` : ''}</Text>}
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => router.push('/addresses')}>
              <Text style={[s.manageAddressText, { color: colors.accent }]}>{locale === 'en' ? 'Manage addresses' : 'إدارة العناوين'}</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={[s.sectionTitle, { color: colors.text }]}>{locale === 'en' ? 'Add item' : 'إضافة قطعة'}</Text>

        <ScrollView key={`cat-${locale}`} horizontal showsHorizontalScrollIndicator={false} style={s.categoryScroll} contentContainerStyle={s.categoryScrollContent}>
          {categories.map(cat => (
            <TouchableOpacity key={cat.id} onPress={() => { setSelectedCategory(cat.id); setSelectedItemType(''); setSelectedService('') }}
              style={[s.categoryChip, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }, selectedCategory === cat.id && { borderColor: colors.primary, backgroundColor: colors.primary + '15' }]}>
              <Text style={s.categoryChipIcon}>{cat.icon}</Text>
              <Text style={[s.categoryChipLabel, { color: colors.navy[200] }, selectedCategory === cat.id && { color: colors.primary }]}>{catName(cat.name)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={[s.stepLabel, { color: colors.navy[200] }]}>{locale === 'en' ? 'Item type' : 'نوع القطعة'}</Text>
        <View style={s.grid}>
          {filteredItemTypes.map(type => (
            <TouchableOpacity key={type} onPress={() => { setSelectedItemType(type); setSelectedService('') }}
              style={[s.optionCard, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }, selectedItemType === type && { borderColor: colors.primary, backgroundColor: colors.primary + '15' }]}>
              <Text style={[s.optionLabel, { color: colors.navy[200] }, selectedItemType === type && { color: colors.primary }]}>{itemName(type)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {selectedItemType ? (
          <>
            <Text style={[s.stepLabel, { color: colors.navy[200] }]}>{locale === 'en' ? 'Service type' : 'نوع الخدمة'}</Text>
            <View style={s.grid}>
              {availableServices.map(svc => (
                <TouchableOpacity key={svc.key} onPress={() => setSelectedService(svc.key)}
                  style={[s.optionCard, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }, selectedService === svc.key && { borderColor: colors.primary, backgroundColor: colors.primary + '15' }]}>
                  <Text style={s.optionIcon}>{svc.icon}</Text>
                  <Text style={[s.optionLabel, { color: colors.navy[200] }, selectedService === svc.key && { color: colors.primary }]}>{locale === 'en' ? svc.labelEn : svc.label}</Text>
                  <Text style={[s.priceHint, { color: colors.navy[300] }]}>{getPrice(selectedItemType, svc.key)} {t('currency')}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : null}

        {selectedService ? (
          <View style={s.addRow}>
            <View style={s.counterRow}>
              <TouchableOpacity style={[s.counterBtn, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }]} onPress={() => setItemQty(Math.max(1, itemQty - 1))}>
                <Text style={[s.counterText, { color: colors.text }]}>−</Text>
              </TouchableOpacity>
              <Text style={[s.counterValue, { color: colors.text }]}>{itemQty}</Text>
              <TouchableOpacity style={[s.counterBtn, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }]} onPress={() => setItemQty(itemQty + 1)}>
                <Text style={[s.counterText, { color: colors.text }]}>+</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[s.addBtn, { backgroundColor: closed ? colors.navy[600] : colors.primary }]} onPress={handleAddToCart} disabled={closed}>
              <Text style={s.addBtnText}>{locale === 'en' ? '+ Add to cart' : '+ أضف للسلة'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {cart.length > 0 && (
          <>
            <Text style={[s.sectionTitle, { color: colors.text }]}>{locale === 'en' ? `Added items (${totalItems})` : `القطع المضافة (${totalItems})`}</Text>
            {cart.map((item, i) => (
              <View key={i} style={[s.cartItem, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.cartItemName, { color: colors.text }]}>{itemName(item.name)} — {svcLabel(item.service_type)}</Text>
                  <Text style={[s.cartItemDetail, { color: colors.navy[300] }]}>{item.quantity} × {item.price} = {item.quantity * item.price} {t('currency')}</Text>
                </View>
                <View style={s.cartItemActions}>
                  <TouchableOpacity onPress={() => updateQuantity(i, item.quantity - 1)} style={[s.qtyBtn, { backgroundColor: colors.navy[700] }]}>
                    <Text style={s.qtyBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={[s.qtyDisplay, { color: colors.text }]}>{item.quantity}</Text>
                  <TouchableOpacity onPress={() => updateQuantity(i, item.quantity + 1)} style={[s.qtyBtn, { backgroundColor: colors.navy[700] }]}>
                    <Text style={s.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeItem(i)} style={[s.removeBtn, { backgroundColor: colors.danger + '20' }]}>
                    <Text style={[s.removeBtnText, { color: colors.danger }]}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {cart.length > 0 && (
        <Animated.View style={[s.floatingBar, barAnimStyle]}>
          <TouchableOpacity
            style={[s.floatingBarInner, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
            activeOpacity={0.85}
            onPress={() => router.push('/cart')}
          >
            <View style={s.floatingBarLeft}>
              <Text style={s.floatingBarIcon}>🛒</Text>
              <Animated.View style={[s.floatingBadge, badgeAnimStyle]}>
                <Text style={[s.floatingBadgeText, { color: colors.primary }]}>{totalItems}</Text>
              </Animated.View>
            </View>
            <Text style={s.floatingBarLabel}>{locale === 'en' ? 'View cart' : 'عرض السلة'}</Text>
            <Text style={s.floatingBarPrice}>{totalPrice.toFixed(2)} {t('currency')}</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {AlertComponent}
    </>
  )
}

const s = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1 },
  content: { padding: 20, paddingTop: 56, paddingBottom: 100 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, marginTop: 20 },
  stepLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  optionCard: {
    minWidth: '30%', borderRadius: 16, padding: 14,
    alignItems: 'center', gap: 4, borderWidth: 1.5,
  },
  optionIcon: { fontSize: 24 },
  optionLabel: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  priceHint: { fontSize: 11, marginTop: 2 },
  addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, gap: 12 },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  counterBtn: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1,
  },
  counterText: { fontSize: 20, fontWeight: '600' },
  counterValue: { fontSize: 24, fontWeight: 'bold', minWidth: 32, textAlign: 'center' },
  addBtn: {
    flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cartItem: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1,
  },
  cartItemName: { fontSize: 14, fontWeight: '600' },
  cartItemDetail: { fontSize: 12, marginTop: 2 },
  cartItemActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  qtyBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  qtyDisplay: { fontSize: 14, fontWeight: '700', minWidth: 20, textAlign: 'center' },
  removeBtn: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginLeft: 4 },
  removeBtnText: { fontSize: 12, fontWeight: '700' },
  addAddressBtn: {
    borderRadius: 16, padding: 16, alignItems: 'center',
    borderWidth: 1.5, borderStyle: 'dashed',
  },
  addAddressText: { fontSize: 14, fontWeight: '600' },
  addressList: { gap: 8 },
  addressCard: {
    borderRadius: 12, padding: 12, borderWidth: 1.5,
  },
  addressLabel: { fontSize: 14, fontWeight: '600' },
  addressDetail: { fontSize: 11, marginTop: 2 },
  manageAddressText: { fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 8 },
  subBanner: {
    borderRadius: 16, padding: 16, marginBottom: 8, borderWidth: 1,
  },
  subBannerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  subBannerName: { fontSize: 14, fontWeight: '700' },
  subBannerRemaining: { fontSize: 14, fontWeight: '700' },
  subProgressBar: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  subProgressFill: { height: '100%', borderRadius: 3 },
  subBannerHint: { fontSize: 11 },
  categoryScroll: { marginBottom: 12 },
  categoryScrollContent: { gap: 8, paddingVertical: 4 },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1.5,
  },
  categoryChipIcon: { fontSize: 16 },
  categoryChipLabel: { fontSize: 13, fontWeight: '600' },
  floatingBar: {
    position: 'absolute', bottom: 90, left: 16, right: 16,
  },
  floatingBarInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14,
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 10,
  },
  floatingBarLeft: { flexDirection: 'row', alignItems: 'center' },
  floatingBarIcon: { fontSize: 20 },
  floatingBadge: {
    backgroundColor: '#fff', borderRadius: 12, minWidth: 24, height: 24,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6, marginLeft: 6,
  },
  floatingBadgeText: { fontSize: 13, fontWeight: '800' },
  floatingBarLabel: { fontSize: 16, fontWeight: '700', color: '#fff' },
  floatingBarPrice: { fontSize: 15, fontWeight: '700', color: '#fff' },
  closedBanner: {
    borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1,
    alignItems: 'center', gap: 6,
  },
  closedIcon: { fontSize: 32 },
  closedTitle: { fontSize: 16, fontWeight: '800', color: '#ef4444' },
  closedHours: { fontSize: 13, color: '#ef4444', fontWeight: '600' },
})
