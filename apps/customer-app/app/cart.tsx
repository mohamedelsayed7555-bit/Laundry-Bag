import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Platform, RefreshControl, I18nManager, Image, Switch } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MapPin, Package, Plus, Trash2, ShoppingBag, TriangleAlert, CircleCheck, CreditCard, Banknote, Wallet, Landmark, Smartphone, Clock, CalendarDays, Zap, NotebookPen, ChevronDown, ChevronUp, Ticket, X } from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter, useFocusEffect } from 'expo-router'
import DateTimePicker from '@react-native-community/datetimepicker'
import { useAuth } from '../src/contexts/AuthContext'
import { useLanguage } from '../src/contexts/LanguageContext'
import { haversineKm } from '../src/utils/distance'
import { useCart } from '../src/contexts/CartContext'
import { useCustomAlert } from '../src/components/CustomAlert'
import { playNotificationSound } from '../src/hooks/useNotifications'
import { supabase } from '../src/lib/supabase'
import { SkeletonPage } from '../src/components/Skeleton'
import { serverErrorMessage } from '../src/lib/serverErrors'
import { useBrand, Card, Stepper, ChoiceGrid, Segmented, StickyFooter, PulseHighlight, IconButton, BackIcon, ForwardIcon, money, clock, F, SIZE, HIT, type Choice } from '../src/components/brand'
import { PrimaryButton } from '../src/components/auth/ui'

const SERVICE_IMG: Record<string, any> = {
  wash: require('../assets/services/wash.webp'),
  dry_clean: require('../assets/services/dry.webp'),
  iron: require('../assets/services/iron.webp'),
  wash_iron: require('../assets/services/washiron.webp'),
  housekeeping: require('../assets/services/home.webp'),
  carpet: require('../assets/services/carpet.webp'),
  accessories: require('../assets/services/shop.webp'),
}

const paymentMethods = [
  { key: 'cash', icon: '💵', label: 'كاش', labelEn: 'Cash' },
  { key: 'visa', icon: '💳', label: 'فيزا / ماستركارد', labelEn: 'Visa / Mastercard' },
  { key: 'e_wallet', icon: '📱', label: 'محفظة إلكترونية', labelEn: 'E-Wallet' },
  { key: 'instapay', icon: '🏦', label: 'إنستاباي', labelEn: 'InstaPay' },
]

const services = [
  { key: 'wash', label: 'غسيل', labelEn: 'Wash' },
  { key: 'dry_clean', label: 'تنظيف جاف', labelEn: 'Dry Clean' },
  { key: 'iron', label: 'كي فقط', labelEn: 'Iron Only' },
  { key: 'wash_iron', label: 'غسيل وكي', labelEn: 'Wash & Iron' },
  { key: 'housekeeping', label: 'تنظيف منازل', labelEn: 'House Keeping' },
  { key: 'carpet', label: 'سجاد وبطاطين', labelEn: 'Carpets & Blankets' },
  { key: 'accessories', label: 'منتجات وإكسسوارات', labelEn: 'Accessories & Products' },
]

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://kjqtrmedkvqfofwymoni.supabase.co'

export default function CartScreen() {
  const { profile } = useAuth()
  const { t, locale } = useLanguage()
  const { cart, removeItem, updateQuantity, clearCart, totalPrice, totalItems } = useCart()
  const router = useRouter()
  const { showAlert, AlertComponent } = useCustomAlert()
  const b = useBrand()
  const insets = useSafeAreaInsets()

  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [isScheduled, setIsScheduled] = useState(false)
  const [scheduledDate, setScheduledDate] = useState(new Date(Date.now() + 3600000))
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [addresses, setAddresses] = useState<any[]>([])
  const [selectedAddress, setSelectedAddress] = useState<any>(null)
  const [deliveryAddress, setDeliveryAddress] = useState<any>(null)
  const [sameAddress, setSameAddress] = useState(true)
  const [activeSubs, setActiveSubs] = useState<any[]>([])
  const [walletPhone, setWalletPhone] = useState('')
  const [paymentSettings, setPaymentSettings] = useState<{ instapay: string; wallet: string }>({ instapay: '', wallet: '' })
  const [deliveryFee, setDeliveryFee] = useState(0)
  const [deliveryFeeBase, setDeliveryFeeBase] = useState(0)
  const [minOrderItems, setMinOrderItems] = useState(0)
  const [zoneSettings, setZoneSettings] = useState({ max_zone_km: 30, price_per_km: 2, base_delivery_km: 5, laundry_lat: 30.0444, laundry_lng: 31.2357 })
  const [distanceKm, setDistanceKm] = useState<number | null>(null)
  const [outOfZone, setOutOfZone] = useState(false)
  const [deliveryOutOfZone, setDeliveryOutOfZone] = useState(false)
  const [deliveryDistanceKm, setDeliveryDistanceKm] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null)
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [couponLoading, setCouponLoading] = useState(false)
  const paymentScrollRef = useRef<ScrollView>(null)
  const [showPickupPicker, setShowPickupPicker] = useState(false)
  const [showDeliveryPicker, setShowDeliveryPicker] = useState(false)
  const [showNotes, setShowNotes] = useState(false)

  const isEn = locale === 'en'

  const loadAddresses = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase.from('addresses').select('id, label, lat, lng, is_default, building, floor, apartment, landmark').eq('user_id', profile.id).order('is_default', { ascending: false })
    if (data) {
      setAddresses(data)
      setSelectedAddress((prev: any) => {
        if (prev && data.some((a: any) => a.id === prev.id)) return prev
        return data.find((a: any) => a.is_default) ?? data[0] ?? null
      })
      setDeliveryAddress((prev: any) => {
        if (prev && data.some((a: any) => a.id === prev.id)) return prev
        return data.find((a: any) => a.is_default) ?? data[0] ?? null
      })
    }
  }, [profile])

  const loadCartData = useCallback(async () => {
    const [settingsRes, addrRes, subRes] = await Promise.all([
      supabase.from('settings').select('key, value').in('key', ['delivery_fee', 'max_zone_km', 'price_per_km', 'base_delivery_km', 'laundry_lat', 'laundry_lng', 'min_order_items', 'instapay_number', 'wallet_number']),
      profile ? supabase.from('addresses').select('id, label, lat, lng, is_default, building, floor, apartment, landmark').eq('user_id', profile.id).order('is_default', { ascending: false }) : null,
      profile ? supabase.from('subscriptions').select('*, plans(name, covered_services, includes_all_services)').eq('user_id', profile.id).eq('status', 'active') : null,
    ])
    if (settingsRes?.data) {
      const s: any = {}
      settingsRes.data.forEach((r: any) => { s[r.key] = r.value })
      const baseFee = Number(s.delivery_fee) || 0
      setDeliveryFee(baseFee)
      setDeliveryFeeBase(baseFee)
      setMinOrderItems(Number(s.min_order_items) || 0)
      setZoneSettings({
        max_zone_km: Number(s.max_zone_km) || 30,
        price_per_km: Number(s.price_per_km) || 2,
        base_delivery_km: Number(s.base_delivery_km) || 5,
        laundry_lat: Number(s.laundry_lat) || 30.0444,
        laundry_lng: Number(s.laundry_lng) || 31.2357,
      })
      const inst = s.instapay_number
      const wal = s.wallet_number
      setPaymentSettings({
        instapay: typeof inst === 'string' ? inst : String(inst ?? ''),
        wallet: typeof wal === 'string' ? wal : String(wal ?? ''),
      })
    }
    if (addrRes?.data) {
      setAddresses(addrRes.data)
      const def = addrRes.data.find((a: any) => a.is_default) ?? addrRes.data[0]
      if (def) { setSelectedAddress(def); setDeliveryAddress(def) }
    }
    if (subRes?.data) setActiveSubs(Array.isArray(subRes.data) ? subRes.data : [subRes.data])
  }, [profile])

  useEffect(() => {
    loadCartData().then(() => setLoading(false))
  }, [profile])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadCartData()
    setRefreshing(false)
  }, [loadCartData])

  useFocusEffect(useCallback(() => { loadAddresses() }, [loadAddresses]))

  useEffect(() => {
    if (selectedAddress?.lat && selectedAddress?.lng) {
      const dist = haversineKm(zoneSettings.laundry_lat, zoneSettings.laundry_lng, selectedAddress.lat, selectedAddress.lng)
      setDistanceKm(Math.round(dist * 10) / 10)
      setOutOfZone(dist > zoneSettings.max_zone_km)
      if (dist > zoneSettings.base_delivery_km) {
        const extraKm = dist - zoneSettings.base_delivery_km
        setDeliveryFee(deliveryFeeBase + Math.round(extraKm * zoneSettings.price_per_km))
      } else {
        setDeliveryFee(deliveryFeeBase)
      }
    }
  }, [selectedAddress, zoneSettings, deliveryFeeBase])

  useEffect(() => {
    if (sameAddress) {
      setDeliveryOutOfZone(false)
      setDeliveryDistanceKm(null)
      return
    }
    if (deliveryAddress?.lat && deliveryAddress?.lng) {
      const dist = haversineKm(zoneSettings.laundry_lat, zoneSettings.laundry_lng, deliveryAddress.lat, deliveryAddress.lng)
      setDeliveryDistanceKm(Math.round(dist * 10) / 10)
      setDeliveryOutOfZone(dist > zoneSettings.max_zone_km)
    } else {
      setDeliveryOutOfZone(false)
      setDeliveryDistanceKm(null)
    }
  }, [deliveryAddress, sameAddress, zoneSettings])

  // Build coverage from all active subscriptions
  const subCoverage = useMemo(() => {
    if (!activeSubs.length) return { coveredServices: [] as string[], subs: [] as any[], totalRemaining: 0 }
    const allCovered: string[] = []
    for (const sub of activeSubs) {
      if (sub.plans?.includes_all_services) {
        cart.forEach((i: any) => { if (!allCovered.includes(i.service_type)) allCovered.push(i.service_type) })
      } else {
        const cs = sub.plans?.covered_services ?? ['wash', 'iron', 'wash_iron', 'dry_clean']
        cs.forEach((s: string) => { if (!allCovered.includes(s)) allCovered.push(s) })
      }
    }
    const totalRemaining = activeSubs.reduce((sum: number, s: any) => sum + Math.max(0, (s.items_limit ?? 0) - (s.items_used ?? 0)), 0)
    return { coveredServices: allCovered, subs: activeSubs, totalRemaining }
  }, [activeSubs, cart])

  const uncoveredItems = cart.filter((i: any) => !subCoverage.coveredServices.includes(i.service_type))
  const coveredItems = cart.filter((i: any) => subCoverage.coveredServices.includes(i.service_type))
  const uncoveredTotal = uncoveredItems.reduce((sum: number, i: any) => sum + (i.price * i.quantity), 0)
  const uncoveredCount = uncoveredItems.reduce((sum: number, i: any) => sum + i.quantity, 0)
  const coveredCount = coveredItems.reduce((sum: number, i: any) => sum + i.quantity, 0)
  const subRemaining = subCoverage.totalRemaining
  const subExhausted = activeSubs.length > 0 && subRemaining === 0
  const useSubscription = activeSubs.length > 0 && subRemaining > 0 && coveredCount > 0
  const actualCovered = useSubscription ? Math.min(coveredCount, subRemaining) : 0
  const overflowCount = useSubscription ? Math.max(0, coveredCount - subRemaining) : 0
  // Nudge the next step: set a pickup address, then move to confirming the order.
  const nextStep: 'address' | 'cta' = !selectedAddress ? 'address' : 'cta'
  const overflowTotal = useMemo(() => {
    if (overflowCount <= 0) return 0
    let remaining = overflowCount
    let total = 0
    for (let i = coveredItems.length - 1; i >= 0 && remaining > 0; i--) {
      const item = coveredItems[i]
      const take = Math.min(item.quantity, remaining)
      total += take * item.price
      remaining -= take
    }
    return total
  }, [coveredItems, overflowCount])
  const fee = useSubscription && uncoveredCount === 0 && overflowCount === 0 ? 0 : deliveryFee
  const subtotalBeforeDiscount = useSubscription ? uncoveredTotal + overflowTotal + fee : totalPrice + fee
  const orderTotal = Math.max(0, subtotalBeforeDiscount - couponDiscount)

  async function applyCoupon() {
    if (!couponCode.trim()) return
    setCouponLoading(true)
    const code = couponCode.trim().toUpperCase()
    const { data: coupon, error } = await supabase.from('coupons').select('*').eq('code', code).eq('is_active', true).single()
    if (error || !coupon) {
      setCouponLoading(false)
      showAlert({ title: isEn ? 'Invalid Code' : 'كود غير صالح', message: isEn ? 'This coupon code is invalid or expired' : 'كود الخصم غير صالح أو منتهي', type: 'warning' })
      return
    }
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      setCouponLoading(false)
      showAlert({ title: isEn ? 'Expired' : 'منتهي', message: isEn ? 'This coupon has expired' : 'كود الخصم منتهي الصلاحية', type: 'warning' })
      return
    }
    if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
      setCouponLoading(false)
      showAlert({ title: isEn ? 'Limit Reached' : 'نفذ', message: isEn ? 'This coupon has reached its usage limit' : 'كود الخصم نفذت مرات استخدامه', type: 'warning' })
      return
    }
    const itemsTotal = useSubscription ? uncoveredTotal + overflowTotal : totalPrice
    if (coupon.min_order_amount > 0 && itemsTotal < coupon.min_order_amount) {
      setCouponLoading(false)
      showAlert({ title: isEn ? 'Minimum not met' : 'الحد الأدنى', message: isEn ? `Minimum order is ${coupon.min_order_amount} EGP` : `الحد الأدنى للطلب ${coupon.min_order_amount} ج.م`, type: 'warning' })
      return
    }
    if (profile) {
      const { count } = await supabase.from('coupon_usage').select('id', { count: 'exact', head: true }).eq('coupon_id', coupon.id).eq('user_id', profile.id)
      if ((count ?? 0) >= (coupon.per_user_limit ?? 1)) {
        setCouponLoading(false)
        showAlert({ title: isEn ? 'Already Used' : 'مستخدم', message: isEn ? 'You already used this coupon' : 'لقد استخدمت هذا الكوبون من قبل', type: 'warning' })
        return
      }
    }
    let discount = 0
    if (coupon.type === 'percentage') {
      discount = itemsTotal * (coupon.value / 100)
      if (coupon.max_discount && discount > coupon.max_discount) discount = coupon.max_discount
    } else {
      discount = coupon.value
    }
    discount = Math.min(discount, itemsTotal)
    setAppliedCoupon(coupon)
    setCouponDiscount(Math.round(discount * 100) / 100)
    setCouponLoading(false)
  }

  function removeCoupon() {
    setAppliedCoupon(null)
    setCouponDiscount(0)
    setCouponCode('')
  }

  const serviceLabel = (key: string) => {
    const svc = services.find(s => s.key === key)
    return svc ? (isEn ? svc.labelEn : svc.label) : key
  }

  const itemName = (name: string) => isEn ? (t(`item:${name}`) !== `item:${name}` ? t(`item:${name}`) : name) : name

  async function handleSubmit() {
    if (!profile) return
    if (!selectedAddress) {
      showAlert({ title: isEn ? 'Notice' : 'تنبيه', message: isEn ? 'Select pickup address' : 'اختر عنوان الاستلام', type: 'warning' })
      return
    }
    if (!sameAddress && !deliveryAddress) {
      showAlert({ title: isEn ? 'Notice' : 'تنبيه', message: isEn ? 'Select delivery address or enable "Same as pickup"' : 'اختر عنوان التسليم أو فعّل "نفس عنوان الاستلام"', type: 'warning' })
      return
    }
    if (cart.length === 0) {
      showAlert({ title: isEn ? 'Notice' : 'تنبيه', message: isEn ? 'Cart is empty' : 'السلة فارغة', type: 'warning' })
      return
    }
    if (minOrderItems > 0 && totalItems < minOrderItems) {
      showAlert({ title: isEn ? 'Minimum items' : 'الحد الأدنى', message: isEn ? `Minimum order is ${minOrderItems} items. You have ${totalItems}.` : `الحد الأدنى للطلب ${minOrderItems} قطع. عندك ${totalItems} قطعة فقط.`, type: 'warning' })
      return
    }
    if (outOfZone) {
      showAlert({ title: isEn ? 'Out of zone' : 'خارج نطاق التوصيل', message: isEn ? `Pickup address is ${distanceKm} km away — max ${zoneSettings.max_zone_km} km` : `عنوان الاستلام يبعد ${distanceKm} كم — الحد الأقصى ${zoneSettings.max_zone_km} كم`, type: 'warning' })
      return
    }
    if (deliveryOutOfZone) {
      showAlert({ title: isEn ? 'Out of zone' : 'خارج نطاق التوصيل', message: isEn ? `Delivery address is ${deliveryDistanceKm} km away — max ${zoneSettings.max_zone_km} km` : `عنوان التسليم يبعد ${deliveryDistanceKm} كم — الحد الأقصى ${zoneSettings.max_zone_km} كم`, type: 'warning' })
      return
    }

    setSaving(true)

    if (useSubscription) {
      // Verify all subscriptions are still valid
      for (const sub of activeSubs) {
        const { data: freshSub } = await supabase.from('subscriptions').select('status, end_date, items_used, items_limit').eq('id', sub.id).single()
        if (!freshSub || freshSub.status !== 'active' || new Date(freshSub.end_date) < new Date()) {
          setSaving(false)
          showAlert({ title: isEn ? 'Subscription expired' : 'الاشتراك انتهى', message: isEn ? 'One of your subscriptions has expired. Please renew or pay normally.' : 'أحد اشتراكاتك انتهى. جدّد الباقة أو ادفع عادي.', type: 'error' })
          return
        }
      }
      const freshTotalRemaining = activeSubs.reduce((sum: number, s: any) => sum + Math.max(0, (s.items_limit ?? 0) - (s.items_used ?? 0)), 0)
      if (freshTotalRemaining <= 0) {
        setSaving(false)
        showAlert({ title: isEn ? 'Notice' : 'تنبيه', message: isEn ? 'Your plan items have been used up since you opened this page. Order will proceed at regular prices.' : 'رصيد باقتك خلص من وقت ما فتحت الصفحة. الطلب هيكمل بأسعار عادية.', type: 'warning' })
        return
      }
    }

    const hasPaidAmount = useSubscription ? (uncoveredTotal + overflowTotal + fee) > 0 : true
    const isOnlinePayment = hasPaidAmount && (paymentMethod === 'visa' || paymentMethod === 'e_wallet')

    if (isOnlinePayment && paymentMethod === 'e_wallet' && !walletPhone.match(/^01[0-9]{9}$/)) {
      setSaving(false)
      showAlert({ title: isEn ? 'Notice' : 'تنبيه', message: isEn ? 'Enter valid wallet phone (01xxxxxxxxx)' : 'أدخل رقم موبايل المحفظة بشكل صحيح (01xxxxxxxxx)', type: 'warning' })
      return
    }

    // Prices, delivery fee, plan coverage, coupon and the welcome gift are all decided on the server.
    const { data: placed, error } = await supabase.rpc('place_order', {
      p: {
        items: cart.map((i: any) => ({ name: i.name, service_type: i.service_type, quantity: i.quantity })),
        address_id: selectedAddress.id,
        delivery_address_id: sameAddress ? null : deliveryAddress?.id ?? null,
        payment_method: paymentMethod,
        notes: notes || null,
        is_scheduled: isScheduled,
        scheduled_at: isScheduled ? scheduledDate.toISOString() : null,
        coupon_code: appliedCoupon?.code ?? null,
      },
    })

    if (error || !placed) {
      setSaving(false)
      showAlert({ title: isEn ? 'Error' : 'خطأ', message: serverErrorMessage(error?.message, isEn), type: 'error' })
      return
    }

    const orderData = { id: placed.id as string }
    const payOnline = Number(placed.total) > 0 && (paymentMethod === 'visa' || paymentMethod === 'e_wallet')

    if (payOnline) {
      try {
        const session = (await supabase.auth.getSession()).data.session
        const res = await fetch(`${SUPABASE_URL}/functions/v1/paymob-pay`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            order_id: orderData.id,
            payment_method: paymentMethod === 'visa' ? 'card' : 'wallet',
            ...(paymentMethod === 'e_wallet' ? { wallet_phone: walletPhone } : {}),
          }),
        })
        const paymentData = await res.json()
        setSaving(false)
        if (paymentData.iframe_url) {
          clearCart()
          router.push({ pathname: '/payment', params: { url: paymentData.iframe_url, kind: 'order', id: orderData.id } })
        } else if (paymentData.error) {
          showAlert({ title: isEn ? 'Error' : 'خطأ', message: paymentData.error, type: 'error', onConfirm: () => router.replace(`/order/${orderData.id}`) })
        }
      } catch (e) {
        setSaving(false)
        showAlert({ title: isEn ? 'Error' : 'خطأ', message: isEn ? 'Payment service connection error' : 'حدث خطأ في الاتصال بخدمة الدفع', type: 'error', onConfirm: () => router.replace(`/order/${orderData.id}`) })
      }
      return
    }

    setSaving(false)
    clearCart()
    playNotificationSound('order-placed')
    const chargedSeparately = uncoveredCount + overflowCount
    const msg = useSubscription
      ? (isEn ? `Order created! ${actualCovered} items deducted from plans (${subRemaining - actualCovered} remaining)${chargedSeparately > 0 ? ` + ${chargedSeparately} items charged separately` : ''}` : `تم إنشاء طلبك بنجاح!\nتم خصم ${actualCovered} قطعة من باقاتك (متبقي ${subRemaining - actualCovered})${chargedSeparately > 0 ? `\n+ ${chargedSeparately} قطعة محاسبة بشكل منفصل` : ''}`)
      : (isEn ? 'Order created! A driver will be assigned soon' : 'تم إنشاء طلبك بنجاح! سيتم تعيين سائق قريباً')
    showAlert({ title: isEn ? 'Done' : 'تم', message: msg, type: 'success', buttons: [
      { text: t('ok'), onPress: () => router.replace('/(tabs)/orders') },
    ] })
  }

  if (loading) {
    return <SkeletonPage />
  }

  const addrDetails = (a: any) => [a.building && `${isEn ? 'Bldg' : 'مبنى'} ${a.building}`, a.floor && `${isEn ? 'Floor' : 'ط'}${a.floor}`, a.apartment && `${isEn ? 'Apt' : 'ش'}${a.apartment}`].filter(Boolean).join(' · ')
  const dateLabel = `${scheduledDate.getDate()}/${scheduledDate.getMonth() + 1}/${scheduledDate.getFullYear()}`
  const payItems: Choice[] = paymentMethods.map(pm => ({
    key: pm.key,
    label: isEn ? pm.labelEn : pm.label,
    icon: (() => {
      const on = paymentMethod === pm.key
      const c = on ? '#fff' : b.accentIcon
      if (pm.key === 'cash') return <Banknote size={15} color={c} />
      if (pm.key === 'visa') return <CreditCard size={15} color={c} />
      if (pm.key === 'e_wallet') return <Wallet size={15} color={c} />
      return <Landmark size={15} color={c} />
    })(),
  }))
  const showPayment = !useSubscription || (useSubscription && uncoveredCount > 0)

  if (cart.length === 0) {
    return (
      <View style={[s.emptyContainer, { backgroundColor: b.page }]}>
        <View style={[s.emptyIcon, { backgroundColor: b.iconTile }]}><ShoppingBag size={30} color={b.accentIcon} /></View>
        <Text style={[s.emptyTitle, { color: b.ink }]}>{isEn ? 'Cart is empty' : 'السلة فارغة'}</Text>
        <Text style={[s.emptyHint, { color: b.muted }]}>{isEn ? 'Add laundry items from the new order screen' : 'أضف قطع غسيل من شاشة الطلب الجديد'}</Text>
        <PrimaryButton title={isEn ? 'Go back' : 'العودة'} onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
      </View>
    )
  }

  // One compact address row (pickup or delivery) with a change chip.
  const AddrRow = ({ addr, onChange, delivery }: { addr: any; onChange: () => void; delivery?: boolean }) => (
    <View style={s.addrRow}>
      <LinearGradient colors={delivery ? ['#A78BFA', '#7C3AED'] : ['#38BDF8', '#0284C7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.pinTile}>
        {delivery ? <Package size={17} color="#fff" /> : <MapPin size={17} color="#fff" />}
      </LinearGradient>
      <View style={{ flex: 1, minWidth: 0 }}>
        {delivery ? <Text style={[s.addrKicker, { color: b.isDark ? '#C4B5FD' : '#7C3AED' }]}>{isEn ? 'Delivery Address' : 'عنوان التسليم'}</Text> : null}
        <Text style={[s.addressLabel, { color: b.ink }]} numberOfLines={1}>{addr.label}</Text>
        {(addr.building || addr.floor || addr.apartment) ? <Text style={[s.addressDetail, { color: b.muted }]} numberOfLines={1}>{addrDetails(addr)}</Text> : null}
      </View>
      <TouchableOpacity onPress={onChange} hitSlop={HIT} accessibilityRole="button" style={[s.changeChip, { backgroundColor: b.tint, borderColor: b.tintBorder }]}>
        <Text style={[s.changeChipText, { color: b.tintText }]}>{isEn ? 'Change' : 'تغيير'}</Text>
      </TouchableOpacity>
    </View>
  )

  // Compact radio list used while picking an address.
  const AddrPicker = ({ selectedId, onPick }: { selectedId?: string; onPick: (a: any) => void }) => (
    <View>
      {addresses.map((addr, idx) => {
        const on = selectedId === addr.id
        return (
          <TouchableOpacity
            key={addr.id}
            onPress={() => onPick(addr)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={[s.pickRow, idx > 0 && { borderTopWidth: 1, borderTopColor: b.divider }, on && { backgroundColor: b.isDark ? 'rgba(14,165,233,0.08)' : '#F0F8FF' }]}
          >
            <View style={[s.radio, { borderColor: on ? b.primary : b.raisedBorder }, on && { borderWidth: 5 }]} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.addressLabel, { color: b.ink }]} numberOfLines={1}>{addr.label}</Text>
              {(addr.building || addr.floor || addr.apartment) ? <Text style={[s.addressDetail, { color: b.muted }]} numberOfLines={1}>{addrDetails(addr)}</Text> : null}
              {addr.landmark ? <Text style={[s.addressLandmark, { color: b.faint }]} numberOfLines={1}>{addr.landmark}</Text> : null}
            </View>
          </TouchableOpacity>
        )
      })}
      <TouchableOpacity style={[s.dashedRow, { borderTopColor: b.divider }]} onPress={() => router.push('/addresses')} accessibilityRole="button">
        <Plus size={15} color={b.accentIcon} />
        <Text style={[s.addAddressText, { color: b.accentIcon }]}>{isEn ? 'Add new address' : 'إضافة عنوان جديد'}</Text>
      </TouchableOpacity>
    </View>
  )

  const SecTitle = ({ icon, title }: { icon: React.ReactNode; title: string }) => (
    <View style={s.secRow}>
      <View style={[s.secIcon, { backgroundColor: b.tint }]}>{icon}</View>
      <Text style={[s.sectionTitle, { color: b.ink }]}>{title}</Text>
    </View>
  )

  const headerH = insets.top + 58

  return (
    <View style={{ flex: 1, backgroundColor: b.page }}>
      <ScrollView
        style={s.scrollContainer}
        contentContainerStyle={[s.content, { paddingTop: headerH + 4, paddingBottom: 120 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={b.primary} colors={[b.primary]} progressViewOffset={headerH} />}
      >
        {/* Items */}
        <Card pad={false} style={{ overflow: 'hidden' }}>
          {cart.map((item, i) => (
            <View key={i} style={[s.itemRow, i > 0 && { borderTopWidth: 1, borderTopColor: b.divider }]}>
              <Image source={SERVICE_IMG[item.service_type] ?? SERVICE_IMG.wash} style={s.itemImg} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.cartItemName, { color: b.ink }]} numberOfLines={1}>{itemName(item.name)}</Text>
                <Text style={[s.cartItemPrice, { color: b.muted }]} numberOfLines={1}>
                  <Text style={[s.cartItemPriceNum, { color: b.isDark ? '#38BDF8' : '#0284C7' }]}>{money(item.price)}</Text> {t('currency')} / {isEn ? 'item' : 'قطعة'} · {serviceLabel(item.service_type)}
                </Text>
              </View>
              <Stepper
                qty={item.quantity}
                onRemove={() => removeItem(i)}
                onMinus={() => updateQuantity(i, item.quantity - 1)}
                onPlus={() => updateQuantity(i, item.quantity + 1)}
              />
            </View>
          ))}
        </Card>

        <TouchableOpacity
          onPress={() => { const svc = cart[0]?.service_type; router.push({ pathname: '/(tabs)/new-order', params: svc ? { service: svc } : {} }) }}
          style={[s.addMoreBtn, { borderColor: b.isDark ? 'rgba(56,189,248,0.35)' : '#BFDDF7' }]}
          accessibilityRole="button"
        >
          <Plus size={15} color={b.accentIcon} />
          <Text style={[s.addMoreText, { color: b.accentIcon }]}>{(isEn ? '+ Add more items' : '+ إضافة قطع أخرى').replace(/^\+\s*/, '')}</Text>
        </TouchableOpacity>

        {subExhausted && (
          <View style={[s.banner, { backgroundColor: b.dangerTint, borderColor: b.dangerBorder }]}>
            <TriangleAlert size={18} color={b.dangerText} />
            <Text style={[s.bannerText, { color: b.dangerText }]}>
              {(isEn ? '⚠️ Your plan items are used up. This order will be at regular prices.' : '⚠️ رصيد باقتك خلص. الطلب ده هيكون بأسعار عادية.').replace(/^⚠️\s*/, '')}
            </Text>
          </View>
        )}

        {/* Addresses */}
        <SecTitle icon={<MapPin size={14} color={b.tintText} />} title={isEn ? 'Pickup Address' : 'عنوان الاستلام'} />
        <PulseHighlight active={nextStep === 'address'} radius={14}>
        <Card pad={false} style={{ overflow: 'hidden' }}>
          {selectedAddress && !showPickupPicker
            ? <AddrRow addr={selectedAddress} onChange={() => setShowPickupPicker(true)} />
            : <AddrPicker selectedId={selectedAddress?.id} onPick={addr => { setSelectedAddress(addr); setShowPickupPicker(false) }} />}
          <View style={[s.toggleRow, { borderTopColor: b.divider }]}>
            <Text style={[s.toggleLabel, { color: b.ink2 }]}>{isEn ? 'Deliver to same address' : 'التسليم لنفس العنوان'}</Text>
            <Switch
              value={sameAddress}
              onValueChange={setSameAddress}
              trackColor={{ false: b.isDark ? '#2A3852' : '#D5DEEA', true: b.primary }}
              thumbColor="#fff"
            />
          </View>
          {!sameAddress && (
            <View style={{ borderTopWidth: 1, borderTopColor: b.divider }}>
              {deliveryAddress && !showDeliveryPicker
                ? <AddrRow delivery addr={deliveryAddress} onChange={() => setShowDeliveryPicker(true)} />
                : (
                  <>
                    <Text style={[s.pickTitle, { color: b.isDark ? '#C4B5FD' : '#7C3AED' }]}>{isEn ? 'Delivery Address' : 'عنوان التسليم'}</Text>
                    <AddrPicker selectedId={deliveryAddress?.id} onPick={addr => { setDeliveryAddress(addr); setShowDeliveryPicker(false) }} />
                  </>
                )}
            </View>
          )}
        </Card>
        </PulseHighlight>

        {outOfZone && distanceKm !== null && (
          <View style={[s.banner, { backgroundColor: b.dangerTint, borderColor: b.dangerBorder }]}>
            <TriangleAlert size={18} color={b.dangerText} />
            <Text style={[s.bannerText, { color: b.dangerText }]}>
              {isEn ? `Address is ${distanceKm} km away — max ${zoneSettings.max_zone_km} km` : `العنوان يبعد ${distanceKm} كم — الحد الأقصى ${zoneSettings.max_zone_km} كم`}
            </Text>
          </View>
        )}

        {activeSubs.length > 0 && subExhausted && (
          <View style={[s.banner, { backgroundColor: b.warnTint, borderColor: 'rgba(245,158,11,0.32)' }]}>
            <TriangleAlert size={18} color={b.isDark ? '#FBBF24' : '#B45309'} />
            <View style={{ flex: 1 }}>
              <Text style={[s.bannerTitle, { color: b.isDark ? '#FBBF24' : '#B45309' }]}>{isEn ? 'Plan limit reached' : 'رصيد الباقة خلص'}</Text>
              <Text style={[s.bannerSub, { color: b.warnText }]}>
                {isEn ? 'You have used all items in your plan. This order will be paid normally.' : 'استهلكت كل قطع باقتك. الطلب ده هيتدفع عادي.'}
              </Text>
            </View>
          </View>
        )}

        {useSubscription && activeSubs.length > 0 && (
          <View style={[s.banner, { backgroundColor: b.okTint, borderColor: b.isDark ? 'rgba(74,222,128,0.3)' : '#BBF0CF' }]}>
            <CircleCheck size={18} color={b.okText} />
            <View style={{ flex: 1 }}>
              <Text style={[s.bannerTitle, { color: b.okText }]}>{isEn ? 'Covered by your plans' : 'مغطى من باقاتك'}</Text>
              <Text style={[s.bannerSub, { color: b.muted }]}>
                {isEn
                  ? `${actualCovered} items will be deducted — ${subRemaining - actualCovered} remaining after this order${(uncoveredCount + overflowCount) > 0 ? `\n${uncoveredCount + overflowCount} items charged separately (${money(uncoveredTotal + overflowTotal)} ${t('currency')})` : ''}`
                  : `سيتم خصم ${actualCovered} قطعة — متبقي ${subRemaining - actualCovered} قطعة بعد الطلب${(uncoveredCount + overflowCount) > 0 ? `\n${uncoveredCount + overflowCount} قطعة محاسبة منفصلة (${money(uncoveredTotal + overflowTotal)} ${t('currency')})` : ''}`}
              </Text>
              {activeSubs.map((sub: any, idx: number) => (
                <Text key={idx} style={[s.bannerSub, { color: b.faint }]}>{sub.plans?.name ?? (isEn ? 'Subscription' : 'الباقة')} ({Math.max(0, (sub.items_limit ?? 0) - (sub.items_used ?? 0))} {isEn ? 'remaining' : 'متبقي'})</Text>
              ))}
            </View>
          </View>
        )}

        {/* Payment */}
        {showPayment && (
          <>
            <SecTitle
              icon={<CreditCard size={14} color={b.tintText} />}
              title={isEn ? (useSubscription ? `Pay for uncovered items (${money(uncoveredTotal)} ${t('currency')})` : 'Payment Method') : (useSubscription ? `دفع القطع خارج الباقة (${money(uncoveredTotal)} ${t('currency')})` : 'طريقة الدفع')}
            />
            <ChoiceGrid items={payItems} value={paymentMethod} onChange={setPaymentMethod} />
          </>
        )}

        {paymentMethod === 'e_wallet' && (!useSubscription || uncoveredCount > 0) && (
          <Card style={{ marginTop: 10 }}>
            <Text style={[s.infoTitle, { color: b.ink }]}>{isEn ? 'Wallet phone number' : 'رقم موبايل المحفظة'}</Text>
            <View style={[s.field, { backgroundColor: b.field, borderColor: b.fieldBorder }]}>
              <View style={[s.fieldIcon, { backgroundColor: b.iconTile }]}><Smartphone size={15} color={b.accentIcon} /></View>
              <TextInput
                style={[s.fieldInput, { color: b.ink }]}
                value={walletPhone}
                onChangeText={setWalletPhone}
                placeholder="01xxxxxxxxx"
                placeholderTextColor={b.faint}
                keyboardType="phone-pad"
                maxLength={11}
                textAlign="left"
              />
            </View>
          </Card>
        )}

        {paymentMethod === 'instapay' && paymentSettings.instapay && (!useSubscription || uncoveredCount > 0) && (
          <View style={[s.banner, s.bannerCol, { backgroundColor: b.tint, borderColor: b.tintBorder }]}>
            <Text style={[s.bannerTitle, { color: b.ink }]}>{isEn ? 'Transfer to InstaPay number' : 'حوّل على رقم الإنستاباي'}</Text>
            <Text style={[s.instaNumber, { color: b.tintText }]} selectable>{paymentSettings.instapay}</Text>
            <Text style={[s.bannerSub, { color: b.muted, textAlign: 'center' }]}>{isEn ? 'Transfer and send receipt screenshot to driver in chat' : 'حوّل المبلغ وأرسل صورة الإيصال للسائق في المحادثة'}</Text>
          </View>
        )}

        {/* Pickup time */}
        <SecTitle icon={<Clock size={14} color={b.tintText} />} title={isEn ? 'Pickup Time' : 'موعد الاستلام'} />
        <Segmented
          value={isScheduled ? 'later' : 'now'}
          onChange={k => setIsScheduled(k === 'later')}
          items={[
            { key: 'now', label: isEn ? 'Now' : 'الآن', icon: <Zap size={14} color={!isScheduled ? '#fff' : b.muted} /> },
            { key: 'later', label: isEn ? 'Schedule' : 'جدولة', icon: <CalendarDays size={14} color={isScheduled ? '#fff' : b.muted} /> },
          ]}
        />

        {isScheduled && (
          <View style={s.schedulePickerRow}>
            <TouchableOpacity style={[s.schedulePickerBtn, { backgroundColor: b.card, borderColor: b.cardBorder }]} onPress={() => setShowDatePicker(true)} accessibilityRole="button">
              <CalendarDays size={16} color={b.accentIcon} />
              <Text style={[s.schedulePickerLabel, { color: b.ink }]}>{dateLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.schedulePickerBtn, { backgroundColor: b.card, borderColor: b.cardBorder }]} onPress={() => setShowTimePicker(true)} accessibilityRole="button">
              <Clock size={16} color={b.accentIcon} />
              <Text style={[s.schedulePickerLabel, { color: b.ink }]}>{clock(scheduledDate, isEn)}</Text>
            </TouchableOpacity>
          </View>
        )}

        {showDatePicker && (
          <DateTimePicker
            value={scheduledDate}
            mode="date"
            minimumDate={new Date()}
            onChange={(_, date) => { setShowDatePicker(false); if (date) setScheduledDate(prev => { const d = new Date(date); d.setHours(prev.getHours(), prev.getMinutes()); return d }) }}
          />
        )}
        {showTimePicker && (
          <DateTimePicker
            value={scheduledDate}
            mode="time"
            onChange={(_, date) => { setShowTimePicker(false); if (date) setScheduledDate(date) }}
          />
        )}

        {/* Notes + coupon */}
        <Card pad={false} style={{ marginTop: 16, overflow: 'hidden' }}>
          <TouchableOpacity onPress={() => setShowNotes(!showNotes)} style={s.notesToggle} activeOpacity={0.7} accessibilityRole="button">
            <NotebookPen size={16} color={b.accentIcon} />
            <Text style={[s.notesToggleText, { color: b.ink2 }]}>{isEn ? 'Notes (optional)' : 'ملاحظات (اختياري)'}</Text>
            {showNotes ? <ChevronUp size={16} color={b.faint} /> : <ChevronDown size={16} color={b.faint} />}
          </TouchableOpacity>
          {showNotes && (
            <TextInput style={[s.notesInput, { backgroundColor: b.field, color: b.ink, borderColor: b.fieldBorder }]} value={notes} onChangeText={setNotes}
              placeholder={isEn ? 'Any special instructions...' : 'أي تعليمات خاصة...'} placeholderTextColor={b.faint}
              multiline numberOfLines={3} textAlignVertical="top" textAlign={isEn ? 'left' : 'right'} />
          )}
          <View style={[s.couponWrap, { borderTopColor: b.divider }]}>
            {appliedCoupon ? (
              <View style={s.couponApplied}>
                <View style={[s.fieldIcon, { backgroundColor: b.okTint }]}><Ticket size={15} color={b.okText} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.couponAppliedCode, { color: b.okText }]}>{appliedCoupon.code}</Text>
                  <Text style={[s.couponAppliedAmount, { color: b.muted }]}>
                    {isEn ? `Discount: ${money(couponDiscount)} EGP` : `خصم: ${money(couponDiscount)} ج.م`}
                  </Text>
                </View>
                <TouchableOpacity onPress={removeCoupon} hitSlop={HIT} accessibilityRole="button" accessibilityLabel="Remove coupon" style={[s.couponRemoveBtn, { backgroundColor: b.iconTile }]}>
                  <X size={14} color={b.muted} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.couponRow}>
                <View style={[s.field, s.couponField, { backgroundColor: b.field, borderColor: couponCode.trim() ? b.primary : b.fieldBorder }]}>
                  <Ticket size={16} color={b.isDark ? '#FBBF24' : '#D97706'} />
                  <TextInput
                    style={[s.fieldInput, s.couponInput, { color: b.ink }]}
                    value={couponCode}
                    onChangeText={t => setCouponCode(t.toUpperCase())}
                    placeholder={isEn ? 'Coupon code' : 'كود الخصم'}
                    placeholderTextColor={b.faint}
                    autoCapitalize="characters"
                    textAlign={isEn ? 'left' : 'right'}
                  />
                </View>
                <TouchableOpacity
                  onPress={applyCoupon}
                  disabled={couponLoading || !couponCode.trim()}
                  accessibilityRole="button"
                  style={[s.couponApplyBtn, { backgroundColor: couponCode.trim() ? b.primary : b.disabled }]}
                >
                  {couponLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.couponApplyText}>{isEn ? 'Apply' : 'تطبيق'}</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Card>

        {/* Receipt */}
        <Card style={{ marginTop: 12 }}>
          {useSubscription ? (
            uncoveredCount > 0 ? (
              <>
                <View style={s.totalRow}><Text style={[s.breakdownLabel, { color: b.okText }]}>{isEn ? 'Plan items' : 'قطع الباقة'} ({coveredCount})</Text><Text style={[s.breakdownValue, { color: b.okText }]}>{isEn ? 'Free' : 'مجاناً'}</Text></View>
                <View style={s.totalRow}><Text style={[s.breakdownLabel, { color: b.muted }]}>{isEn ? 'Uncovered items' : 'قطع خارج الباقة'} ({uncoveredCount})</Text><Text style={[s.breakdownValue, { color: b.ink2 }]}>{money(uncoveredTotal)} {t('currency')}</Text></View>
                {fee > 0 && <View style={s.totalRow}><Text style={[s.breakdownLabel, { color: b.muted }]}>{isEn ? 'Delivery' : 'التوصيل'}{distanceKm ? ` (${distanceKm} ${isEn ? 'km' : 'كم'})` : ''}</Text><Text style={[s.breakdownValue, { color: b.ink2 }]}>{money(fee)} {t('currency')}</Text></View>}
                {couponDiscount > 0 && <View style={s.totalRow}><Text style={[s.breakdownLabel, { color: b.okText }]}>{isEn ? 'Coupon' : 'كوبون'} ({appliedCoupon?.code})</Text><Text style={[s.breakdownValue, { color: b.okText }]}>-{money(couponDiscount)} {t('currency')}</Text></View>}
                <View style={[s.totalRow, s.totalLine, { borderTopColor: b.raisedBorder }]}>
                  <Text style={[s.totalLabel, { color: b.ink }]}>{isEn ? 'Amount to pay' : 'المبلغ المطلوب'}</Text>
                  <Text style={[s.totalValue, { color: b.isDark ? '#38BDF8' : '#0284C7' }]}>{money(orderTotal)} <Text style={[s.totalCur, { color: b.muted }]}>{t('currency')}</Text></Text>
                </View>
              </>
            ) : (
              <>
                <View style={s.totalRow}><Text style={[s.totalLabel, { color: b.ink }]}>{isEn ? 'Total' : 'الإجمالي'}</Text><Text style={[s.totalValue, { color: b.okText }]}>{isEn ? 'Free (Plan)' : 'مجاناً (باقة)'}</Text></View>
                <Text style={{ fontSize: 11, color: b.faint, textDecorationLine: 'line-through', textAlign: 'left', fontFamily: F.regular }}>{money(totalPrice)} {t('currency')}</Text>
              </>
            )
          ) : (
            <>
              <View style={s.totalRow}><Text style={[s.breakdownLabel, { color: b.muted }]}>{isEn ? 'Subtotal' : 'المجموع'}</Text><Text style={[s.breakdownValue, { color: b.ink2 }]}>{money(totalPrice)} {t('currency')}</Text></View>
              {deliveryFee > 0 && <View style={s.totalRow}><Text style={[s.breakdownLabel, { color: b.muted }]}>{isEn ? 'Delivery' : 'التوصيل'}{distanceKm ? ` (${distanceKm} ${isEn ? 'km' : 'كم'})` : ''}</Text><Text style={[s.breakdownValue, { color: b.ink2 }]}>{money(deliveryFee)} {t('currency')}</Text></View>}
              {couponDiscount > 0 && <View style={s.totalRow}><Text style={[s.breakdownLabel, { color: b.okText }]}>{isEn ? 'Coupon' : 'كوبون'} ({appliedCoupon?.code})</Text><Text style={[s.breakdownValue, { color: b.okText }]}>-{money(couponDiscount)} {t('currency')}</Text></View>}
              <View style={[s.totalRow, s.totalLine, { borderTopColor: b.raisedBorder }]}>
                <Text style={[s.totalLabel, { color: b.ink }]}>{isEn ? 'Total' : 'الإجمالي'}</Text>
                <Text style={[s.totalValue, { color: b.isDark ? '#38BDF8' : '#0284C7' }]}>{money(orderTotal)} <Text style={[s.totalCur, { color: b.muted }]}>{t('currency')}</Text></Text>
              </View>
            </>
          )}
        </Card>
      </ScrollView>

      {/* Fixed top bar so content never scrolls under the status bar */}
      <View style={[s.topBar, { paddingTop: insets.top + 8, height: headerH, backgroundColor: b.page, borderBottomColor: b.divider }]}>
        <IconButton onPress={() => router.back()} label={isEn ? 'Back' : 'رجوع'}>
          <BackIcon color={b.ink} />
        </IconButton>
        <Text style={[s.title, { color: b.ink }]} numberOfLines={1}>{isEn ? 'My Cart' : 'سلتي'}</Text>
        <View style={[s.countPill, { backgroundColor: b.tint }]}>
          <Text style={[s.countPillText, { color: b.tintText }]}>{isEn ? `${totalItems} items` : `${totalItems} قطعة`}</Text>
        </View>
        <View style={{ flex: 1 }} />
        <IconButton onPress={clearCart} label={isEn ? 'Clear cart' : 'تفريغ السلة'} style={{ backgroundColor: b.dangerTint, borderColor: b.dangerBorder }}>
          <Trash2 size={17} color={b.dangerText} />
        </IconButton>
      </View>

      <StickyFooter label={isEn ? 'Total' : 'الإجمالي'} total={useSubscription && uncoveredCount === 0 ? (isEn ? 'Free' : 'مجاناً') : money(orderTotal)} currency={useSubscription && uncoveredCount === 0 ? '' : t('currency')} bottomInset={insets.bottom}>
        <PulseHighlight active={nextStep === 'cta'} radius={14}>
          <PrimaryButton
            title={isEn ? 'Confirm Order' : 'تأكيد الطلب'}
            loadingTitle={isEn ? 'Submitting...' : 'جاري الإرسال...'}
            loading={saving}
            onPress={handleSubmit}
            trailing={<ForwardIcon color="#fff" size={17} />}
          />
        </PulseHighlight>
      </StickyFooter>
      {AlertComponent}
    </View>
  )
}

const s = StyleSheet.create({
  scrollContainer: { flex: 1 },
  content: { paddingHorizontal: 16 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 8, borderBottomWidth: 1 },
  title: { fontSize: 19, fontFamily: F.display },
  countPill: { height: 22, borderRadius: 11, paddingHorizontal: 8, justifyContent: 'center' },
  countPillText: { fontSize: 11, fontFamily: F.bold },

  secRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 20, marginBottom: 9, marginHorizontal: 2 },
  secIcon: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontFamily: F.display, flexShrink: 1 },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontSize: 18, fontFamily: F.display, marginBottom: 6 },
  emptyHint: { fontSize: 13.5, fontFamily: F.regular, marginBottom: 22, textAlign: 'center' },

  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 11, paddingVertical: 10 },
  itemImg: { width: 42, height: 42, borderRadius: 12 },
  cartItemName: { fontSize: 14, fontFamily: F.bold },
  cartItemPrice: { fontSize: 11, fontFamily: F.medium, marginTop: 2 },
  cartItemPriceNum: { fontSize: 13, fontFamily: F.display },
  addMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: SIZE.M, borderRadius: SIZE.rM, borderWidth: 1.5, borderStyle: 'dashed', marginTop: 10 },
  addMoreText: { fontSize: 13.5, fontFamily: F.bold },

  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  pinTile: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  addrKicker: { fontSize: 10.5, fontFamily: F.bold },
  addressLabel: { fontSize: 14, fontFamily: F.bold },
  addressDetail: { fontSize: 11.5, fontFamily: F.regular, marginTop: 1 },
  addressLandmark: { fontSize: 11, fontFamily: F.regular, marginTop: 1 },
  changeChip: { height: SIZE.S - 4, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  changeChipText: { fontSize: 12, fontFamily: F.bold },
  pickTitle: { fontSize: 11.5, fontFamily: F.bold, paddingHorizontal: 12, paddingTop: 10 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: SIZE.M + 6, paddingHorizontal: 12, paddingVertical: 8 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, backgroundColor: '#fff' },
  dashedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: SIZE.M, borderTopWidth: 1 },
  addAddressText: { fontSize: 13, fontFamily: F.bold },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: SIZE.M + 4, paddingHorizontal: 12, borderTopWidth: 1 },
  toggleLabel: { fontSize: 13, fontFamily: F.semibold, flex: 1 },

  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 14, borderWidth: 1, padding: 12, marginTop: 12 },
  bannerCol: { flexDirection: 'column', alignItems: 'stretch', gap: 4 },
  bannerTitle: { fontSize: 14, fontFamily: F.bold },
  bannerSub: { fontSize: 12, fontFamily: F.regular, marginTop: 2, lineHeight: 18 },
  bannerText: { flex: 1, fontSize: 13, fontFamily: F.semibold, lineHeight: 19 },
  instaNumber: { fontSize: 22, fontFamily: F.display, textAlign: 'center', letterSpacing: 1.5 },
  infoTitle: { fontSize: 13, fontFamily: F.bold, marginBottom: 8 },

  field: { flexDirection: 'row', alignItems: 'center', gap: 9, height: SIZE.L, borderRadius: 13, borderWidth: 1, paddingHorizontal: 10 },
  fieldIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  fieldInput: { flex: 1, fontSize: 15, fontFamily: F.medium, paddingVertical: 0 },

  schedulePickerRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  schedulePickerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, height: SIZE.M, borderRadius: SIZE.rM, borderWidth: 1 },
  schedulePickerLabel: { fontSize: 13.5, fontFamily: F.semibold },

  notesToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: SIZE.M, paddingHorizontal: 12 },
  notesToggleText: { flex: 1, fontSize: 13, fontFamily: F.semibold },
  notesInput: { borderRadius: 12, padding: 12, fontSize: 14, fontFamily: F.regular, borderWidth: 1, minHeight: 70, marginHorizontal: 12, marginBottom: 12 },
  couponWrap: { padding: 10, borderTopWidth: 1 },
  couponRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  couponField: { flex: 1, height: SIZE.M },
  couponInput: { letterSpacing: 1 },
  couponApplyBtn: { height: SIZE.M, borderRadius: SIZE.rM, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', minWidth: 76 },
  couponApplyText: { color: '#fff', fontSize: 13.5, fontFamily: F.bold },
  couponApplied: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  couponAppliedCode: { fontSize: 14, fontFamily: F.bold, letterSpacing: 1 },
  couponAppliedAmount: { fontSize: 12, fontFamily: F.regular, marginTop: 1 },
  couponRemoveBtn: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  totalLine: { borderTopWidth: 1.5, borderStyle: 'dashed', paddingTop: 10, marginTop: 6 },
  totalLabel: { fontSize: 14, fontFamily: F.bold },
  totalValue: { fontSize: 21, fontFamily: F.display },
  totalCur: { fontSize: 11, fontFamily: F.semibold },
  breakdownLabel: { fontSize: 12.5, fontFamily: F.regular, flexShrink: 1 },
  breakdownValue: { fontSize: 13, fontFamily: F.semibold },
})
