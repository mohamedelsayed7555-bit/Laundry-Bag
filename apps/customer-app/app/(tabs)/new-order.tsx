import { useState, useEffect, useCallback, useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withSequence, withTiming } from 'react-native-reanimated'
import { useAuth } from '../../src/contexts/AuthContext'
import { useCart } from '../../src/contexts/CartContext'
import { useCustomAlert } from '../../src/components/CustomAlert'
import { supabase } from '../../src/lib/supabase'
import { colors } from '../../src/theme'

const services = [
  { key: 'wash', icon: '👔', label: 'غسيل' },
  { key: 'dry_clean', icon: '🧹', label: 'تنظيف جاف' },
  { key: 'iron', icon: '👕', label: 'كي فقط' },
  { key: 'wash_iron', icon: '✨', label: 'غسيل وكي' },
]

const SUPABASE_URL = 'https://kjqtrmedkvqfofwymoni.supabase.co'

export default function NewOrderScreen() {
  const { profile } = useAuth()
  const { cart, addItem, removeItem, updateQuantity, totalPrice, totalItems, lastAddedIndex, clearLastAdded } = useCart()
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

  // Animation for floating cart bar
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

  useEffect(() => {
    Promise.all([
      supabase.from('prices').select('id, item_type, service_type, price, category_id').eq('is_active', true),
      supabase.from('categories').select('id, name, icon, sort_order').eq('is_active', true).order('sort_order'),
    ]).then(([pricesRes, catsRes]) => {
      setPrices(pricesRes.data ?? [])
      const cats = catsRes.data ?? []
      setCategories(cats)
      if (cats.length > 0) setSelectedCategory(cats[0].id)
      setDataLoading(false)
    })
    if (profile) {
      supabase.from('addresses').select('id, label, address, lat, lng, is_default').eq('user_id', profile.id).order('is_default', { ascending: false })
        .then(({ data }) => {
          setAddresses(data ?? [])
          const def = data?.find((a: any) => a.is_default) ?? data?.[0]
          if (def) setSelectedAddress(def)
        })
      supabase.from('subscriptions').select('*, plans(name)').eq('user_id', profile.id).eq('status', 'active').single()
        .then(({ data }) => setActiveSub(data))
    }
  }, [profile])

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

  const serviceLabel = (key: string) => services.find(s => s.key === key)?.label ?? key

  if (dataLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.navy[900], justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <>
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <Text style={s.title}>طلب جديد</Text>

        {activeSub && subRemaining !== null && (
          <View style={s.subBanner}>
            <View style={s.subBannerRow}>
              <Text style={s.subBannerName}>👑 {activeSub.plans?.name ?? 'باقتك'}</Text>
              <Text style={s.subBannerRemaining}>{subRemaining - totalItems} متبقي</Text>
            </View>
            <View style={s.subProgressBar}>
              <View style={[s.subProgressFill, { width: `${Math.min(100, ((activeSub.items_used + totalItems) / activeSub.items_limit) * 100)}%` }]} />
            </View>
            <Text style={s.subBannerHint}>
              {totalItems > 0
                ? `سيتم خصم ${totalItems} قطعة من باقتك (${subRemaining - totalItems >= 0 ? 'مجاناً' : 'تجاوزت الرصيد!'})`
                : `${activeSub.items_used} / ${activeSub.items_limit} قطعة مستخدمة`}
            </Text>
          </View>
        )}

        <Text style={s.sectionTitle}>عنوان الاستلام</Text>
        {addresses.length === 0 ? (
          <TouchableOpacity style={s.addAddressBtn} onPress={() => router.push('/addresses')}>
            <Text style={s.addAddressText}>📍 إضافة عنوان جديد</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.addressList}>
            {addresses.map(addr => (
              <TouchableOpacity key={addr.id} onPress={() => setSelectedAddress(addr)}
                style={[s.addressCard, selectedAddress?.id === addr.id && s.addressSelected]}>
                <Text style={s.addressLabel}>📍 {addr.label}</Text>
                {addr.building && <Text style={s.addressDetail}>{addr.building}{addr.floor ? ` - ط${addr.floor}` : ''}{addr.apartment ? ` - ش${addr.apartment}` : ''}</Text>}
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => router.push('/addresses')}>
              <Text style={s.manageAddressText}>إدارة العناوين</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={s.sectionTitle}>إضافة قطعة</Text>

        {/* Category Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.categoryScroll} contentContainerStyle={s.categoryScrollContent}>
          {categories.map(cat => (
            <TouchableOpacity key={cat.id} onPress={() => { setSelectedCategory(cat.id); setSelectedItemType(''); setSelectedService('') }}
              style={[s.categoryChip, selectedCategory === cat.id && s.categoryChipActive]}>
              <Text style={s.categoryChipIcon}>{cat.icon}</Text>
              <Text style={[s.categoryChipLabel, selectedCategory === cat.id && s.categoryChipLabelActive]}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Item Type Grid */}
        <Text style={s.stepLabel}>نوع القطعة</Text>
        <View style={s.grid}>
          {filteredItemTypes.map(type => (
            <TouchableOpacity key={type} onPress={() => { setSelectedItemType(type); setSelectedService('') }}
              style={[s.optionCard, selectedItemType === type && s.optionSelected]}>
              <Text style={[s.optionLabel, selectedItemType === type && s.optionLabelSelected]}>{type}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {selectedItemType ? (
          <>
            <Text style={s.stepLabel}>نوع الخدمة</Text>
            <View style={s.grid}>
              {availableServices.map(svc => (
                <TouchableOpacity key={svc.key} onPress={() => setSelectedService(svc.key)}
                  style={[s.optionCard, selectedService === svc.key && s.optionSelected]}>
                  <Text style={s.optionIcon}>{svc.icon}</Text>
                  <Text style={[s.optionLabel, selectedService === svc.key && s.optionLabelSelected]}>{svc.label}</Text>
                  <Text style={s.priceHint}>{getPrice(selectedItemType, svc.key)} ج.م</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : null}

        {selectedService ? (
          <View style={s.addRow}>
            <View style={s.counterRow}>
              <TouchableOpacity style={s.counterBtn} onPress={() => setItemQty(Math.max(1, itemQty - 1))}>
                <Text style={s.counterText}>−</Text>
              </TouchableOpacity>
              <Text style={s.counterValue}>{itemQty}</Text>
              <TouchableOpacity style={s.counterBtn} onPress={() => setItemQty(itemQty + 1)}>
                <Text style={s.counterText}>+</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.addBtn} onPress={handleAddToCart}>
              <Text style={s.addBtnText}>+ أضف للسلة</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {cart.length > 0 && (
          <>
            <Text style={s.sectionTitle}>القطع المضافة ({totalItems})</Text>
            {cart.map((item, i) => (
              <View key={i} style={s.cartItem}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cartItemName}>{item.name} — {serviceLabel(item.service_type)}</Text>
                  <Text style={s.cartItemDetail}>{item.quantity} × {item.price} = {item.quantity * item.price} ج.م</Text>
                </View>
                <View style={s.cartItemActions}>
                  <TouchableOpacity onPress={() => updateQuantity(i, item.quantity - 1)} style={s.qtyBtn}>
                    <Text style={s.qtyBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={s.qtyDisplay}>{item.quantity}</Text>
                  <TouchableOpacity onPress={() => updateQuantity(i, item.quantity + 1)} style={s.qtyBtn}>
                    <Text style={s.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeItem(i)} style={s.removeBtn}>
                    <Text style={s.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Cart Bar */}
      {cart.length > 0 && (
        <Animated.View style={[s.floatingBar, barAnimStyle]}>
          <TouchableOpacity
            style={s.floatingBarInner}
            activeOpacity={0.85}
            onPress={() => router.push('/cart')}
          >
            <View style={s.floatingBarLeft}>
              <Text style={s.floatingBarIcon}>🛒</Text>
              <Animated.View style={[s.floatingBadge, badgeAnimStyle]}>
                <Text style={s.floatingBadgeText}>{totalItems}</Text>
              </Animated.View>
            </View>
            <Text style={s.floatingBarLabel}>عرض السلة</Text>
            <Text style={s.floatingBarPrice}>{totalPrice.toFixed(2)} ج.م</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {AlertComponent}
    </>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900] },
  content: { padding: 20, paddingTop: 56, paddingBottom: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 12, marginTop: 20 },
  stepLabel: { fontSize: 13, fontWeight: '600', color: colors.navy[200], marginBottom: 8, marginTop: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  optionCard: {
    minWidth: '30%', backgroundColor: colors.navy[800], borderRadius: 16, padding: 14,
    alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: colors.navy[700],
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '15' },
  optionIcon: { fontSize: 24 },
  optionLabel: { fontSize: 13, fontWeight: '600', color: colors.navy[200], textAlign: 'center' },
  optionLabelSelected: { color: colors.primary },
  priceHint: { fontSize: 11, color: colors.navy[300], marginTop: 2 },
  addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, gap: 12 },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  counterBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.navy[800],
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.navy[700],
  },
  counterText: { fontSize: 20, color: '#fff', fontWeight: '600' },
  counterValue: { fontSize: 24, fontWeight: 'bold', color: '#fff', minWidth: 32, textAlign: 'center' },
  addBtn: {
    flex: 1, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cartItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.navy[800],
    borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.navy[700],
  },
  cartItemName: { fontSize: 14, fontWeight: '600', color: '#fff' },
  cartItemDetail: { fontSize: 12, color: colors.navy[300], marginTop: 2 },
  cartItemActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: colors.navy[700],
    justifyContent: 'center', alignItems: 'center',
  },
  qtyBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  qtyDisplay: { fontSize: 14, fontWeight: '700', color: '#fff', minWidth: 20, textAlign: 'center' },
  removeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.danger + '20', justifyContent: 'center', alignItems: 'center', marginLeft: 4 },
  removeBtnText: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  addAddressBtn: {
    backgroundColor: colors.navy[800], borderRadius: 16, padding: 16, alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.primary, borderStyle: 'dashed',
  },
  addAddressText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  addressList: { gap: 8 },
  addressCard: {
    backgroundColor: colors.navy[800], borderRadius: 12, padding: 12,
    borderWidth: 1.5, borderColor: colors.navy[700],
  },
  addressSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
  addressLabel: { fontSize: 14, fontWeight: '600', color: '#fff' },
  addressDetail: { fontSize: 11, color: colors.navy[300], marginTop: 2 },
  manageAddressText: { color: colors.accent, fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 8 },
  subBanner: {
    backgroundColor: colors.primary + '12', borderRadius: 16, padding: 16, marginBottom: 8,
    borderWidth: 1, borderColor: colors.primary + '30',
  },
  subBannerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  subBannerName: { fontSize: 14, fontWeight: '700', color: '#fff' },
  subBannerRemaining: { fontSize: 14, fontWeight: '700', color: colors.primary },
  subProgressBar: { height: 6, backgroundColor: colors.navy[700], borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  subProgressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
  subBannerHint: { fontSize: 11, color: colors.navy[300] },

  // Category chips
  categoryScroll: { marginBottom: 12 },
  categoryScrollContent: { gap: 8, paddingVertical: 4 },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.navy[800], borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1.5, borderColor: colors.navy[700],
  },
  categoryChipActive: { borderColor: colors.primary, backgroundColor: colors.primary + '15' },
  categoryChipIcon: { fontSize: 16 },
  categoryChipLabel: { fontSize: 13, fontWeight: '600', color: colors.navy[200] },
  categoryChipLabelActive: { color: colors.primary },

  // Floating cart bar
  floatingBar: {
    position: 'absolute', bottom: 90, left: 16, right: 16,
  },
  floatingBarInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.primary, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 10,
  },
  floatingBarLeft: { flexDirection: 'row', alignItems: 'center' },
  floatingBarIcon: { fontSize: 20 },
  floatingBadge: {
    backgroundColor: '#fff', borderRadius: 12, minWidth: 24, height: 24,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6, marginLeft: 6,
  },
  floatingBadgeText: { fontSize: 13, fontWeight: '800', color: colors.primary },
  floatingBarLabel: { fontSize: 16, fontWeight: '700', color: '#fff' },
  floatingBarPrice: { fontSize: 15, fontWeight: '700', color: '#fff' },
})
