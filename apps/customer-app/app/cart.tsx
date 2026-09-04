import { useState, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Platform } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter, useFocusEffect } from 'expo-router'
import DateTimePicker from '@react-native-community/datetimepicker'
import { useAuth } from '../src/contexts/AuthContext'
import { useTheme } from '../src/contexts/ThemeContext'
import { useLanguage } from '../src/contexts/LanguageContext'
import { haversineKm } from '../src/utils/distance'
import { useCart } from '../src/contexts/CartContext'
import { useCustomAlert } from '../src/components/CustomAlert'
import { playNotificationSound } from '../src/hooks/useNotifications'
import { supabase } from '../src/lib/supabase'

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
]

const SUPABASE_URL = 'https://kjqtrmedkvqfofwymoni.supabase.co'

export default function CartScreen() {
  const { profile } = useAuth()
  const { colors } = useTheme()
  const { t, locale } = useLanguage()
  const { cart, removeItem, updateQuantity, clearCart, totalPrice, totalItems } = useCart()
  const router = useRouter()
  const { showAlert, AlertComponent } = useCustomAlert()

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
  const [activeSub, setActiveSub] = useState<any>(null)
  const [walletPhone, setWalletPhone] = useState('')
  const [paymentSettings, setPaymentSettings] = useState<{ instapay: string; wallet: string }>({ instapay: '', wallet: '' })
  const [deliveryFee, setDeliveryFee] = useState(0)
  const [minOrderItems, setMinOrderItems] = useState(0)
  const [zoneSettings, setZoneSettings] = useState({ max_zone_km: 30, price_per_km: 2, base_delivery_km: 5, laundry_lat: 30.0444, laundry_lng: 31.2357 })
  const [distanceKm, setDistanceKm] = useState<number | null>(null)
  const [outOfZone, setOutOfZone] = useState(false)
  const [loading, setLoading] = useState(true)

  const isEn = locale === 'en'

  const loadAddresses = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase.from('addresses').select('id, label, address, lat, lng, is_default').eq('user_id', profile.id).order('is_default', { ascending: false })
    if (data) {
      setAddresses(data)
      const def = data.find((a: any) => a.is_default) ?? data[0]
      if (def && !selectedAddress) setSelectedAddress(def)
    }
  }, [profile])

  useEffect(() => {
    Promise.all([
      supabase.from('settings').select('key, value').in('key', ['delivery_fee', 'max_zone_km', 'price_per_km', 'base_delivery_km', 'laundry_lat', 'laundry_lng', 'min_order_items']),
      supabase.from('settings').select('key, value').in('key', ['instapay_number', 'wallet_number']),
      profile ? supabase.from('addresses').select('id, label, address, lat, lng, is_default').eq('user_id', profile.id).order('is_default', { ascending: false }) : null,
      profile ? supabase.from('subscriptions').select('*, plans(name)').eq('user_id', profile.id).eq('status', 'active').single() : null,
    ]).then(([allSettingsRes, settingsRes, addrRes, subRes]) => {
      if (allSettingsRes?.data) {
        const s: any = {}
        allSettingsRes.data.forEach((r: any) => { s[r.key] = r.value })
        setDeliveryFee(Number(s.delivery_fee) || 0)
        setMinOrderItems(Number(s.min_order_items) || 0)
        setZoneSettings({
          max_zone_km: Number(s.max_zone_km) || 30,
          price_per_km: Number(s.price_per_km) || 2,
          base_delivery_km: Number(s.base_delivery_km) || 5,
          laundry_lat: Number(s.laundry_lat) || 30.0444,
          laundry_lng: Number(s.laundry_lng) || 31.2357,
        })
      }
      if (settingsRes?.data) {
        const inst = settingsRes.data.find((s: any) => s.key === 'instapay_number')
        const wal = settingsRes.data.find((s: any) => s.key === 'wallet_number')
        setPaymentSettings({
          instapay: typeof inst?.value === 'string' ? inst.value : String(inst?.value ?? ''),
          wallet: typeof wal?.value === 'string' ? wal.value : String(wal?.value ?? ''),
        })
      }
      if (addrRes?.data) {
        setAddresses(addrRes.data)
        const def = addrRes.data.find((a: any) => a.is_default) ?? addrRes.data[0]
        if (def) setSelectedAddress(def)
      }
      if (subRes?.data) setActiveSub(subRes.data)
      setLoading(false)
    })
  }, [profile])

  useFocusEffect(useCallback(() => { loadAddresses() }, [loadAddresses]))

  useEffect(() => {
    if (selectedAddress?.lat && selectedAddress?.lng) {
      const dist = haversineKm(zoneSettings.laundry_lat, zoneSettings.laundry_lng, selectedAddress.lat, selectedAddress.lng)
      setDistanceKm(Math.round(dist * 10) / 10)
      setOutOfZone(dist > zoneSettings.max_zone_km)
      if (dist > zoneSettings.base_delivery_km) {
        const extraKm = dist - zoneSettings.base_delivery_km
        setDeliveryFee(Math.round(extraKm * zoneSettings.price_per_km))
      }
    }
  }, [selectedAddress, zoneSettings])

  const subRemaining = activeSub ? Math.max(0, activeSub.items_limit - activeSub.items_used) : null
  const subExhausted = activeSub && subRemaining === 0
  const useSubscription = activeSub && subRemaining !== null && subRemaining > 0 && subRemaining >= totalItems && totalItems > 0
  const fee = useSubscription ? 0 : deliveryFee
  const orderTotal = useSubscription ? 0 : totalPrice + fee

  const serviceLabel = (key: string) => {
    const svc = services.find(s => s.key === key)
    return svc ? (isEn ? svc.labelEn : svc.label) : key
  }

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
      showAlert({ title: isEn ? 'Out of zone' : 'خارج نطاق التوصيل', message: isEn ? `Address is ${distanceKm} km away — max ${zoneSettings.max_zone_km} km` : `العنوان المختار يبعد ${distanceKm} كم — الحد الأقصى ${zoneSettings.max_zone_km} كم`, type: 'warning' })
      return
    }
    if (activeSub && subRemaining !== null && totalItems > subRemaining) {
      showAlert({ title: isEn ? 'Notice' : 'تنبيه', message: isEn ? `Your plan has ${subRemaining} items left but you need ${totalItems}. Upgrade or reduce items.` : `رصيد باقتك ${subRemaining} قطعة فقط وأنت محتاج ${totalItems} قطعة.\nيمكنك ترقية باقتك أو تقليل عدد القطع.`, type: 'warning' })
      return
    }

    setSaving(true)

    if (useSubscription && activeSub) {
      const { data: freshSub } = await supabase.from('subscriptions').select('status, end_date, items_used, items_limit').eq('id', activeSub.id).single()
      if (!freshSub || freshSub.status !== 'active' || new Date(freshSub.end_date) < new Date()) {
        setSaving(false)
        showAlert({ title: isEn ? 'Subscription expired' : 'الاشتراك انتهى', message: isEn ? 'Your subscription has expired. Please renew or pay normally.' : 'اشتراكك انتهى. جدّد الباقة أو ادفع عادي.', type: 'error' })
        return
      }
      const freshRemaining = (freshSub.items_limit ?? 0) - (freshSub.items_used ?? 0)
      if (totalItems > freshRemaining) {
        setSaving(false)
        showAlert({ title: isEn ? 'Notice' : 'تنبيه', message: isEn ? `Only ${freshRemaining} items left in your plan.` : `رصيد باقتك ${freshRemaining} قطعة فقط.`, type: 'warning' })
        return
      }
    }

    const isOnlinePayment = !useSubscription && (paymentMethod === 'visa' || paymentMethod === 'e_wallet')

    if (isOnlinePayment && paymentMethod === 'e_wallet' && !walletPhone.match(/^01[0-9]{9}$/)) {
      setSaving(false)
      showAlert({ title: isEn ? 'Notice' : 'تنبيه', message: isEn ? 'Enter valid wallet phone (01xxxxxxxxx)' : 'أدخل رقم موبايل المحفظة بشكل صحيح (01xxxxxxxxx)', type: 'warning' })
      return
    }

    const { data: orderData, error } = await supabase.from('orders').insert({
      customer_id: profile.id,
      service_type: [...new Set(cart.map((i: any) => i.service_type))].join('+'),
      items: cart,
      items_count: totalItems,
      subtotal: totalPrice,
      delivery_fee: fee,
      total: orderTotal,
      payment_method: useSubscription ? 'cash' : paymentMethod,
      notes: notes || null,
      status: 'pending',
      payment_status: useSubscription ? 'confirmed' : 'pending',
      subscription_id: useSubscription ? activeSub.id : null,
      address_id: selectedAddress?.id || null,
      pickup_location: selectedAddress ? { lat: selectedAddress.lat, lng: selectedAddress.lng, label: selectedAddress.label } : null,
      delivery_location: (() => {
        const addr = sameAddress ? selectedAddress : deliveryAddress
        return addr ? { lat: addr.lat, lng: addr.lng, label: addr.label } : null
      })(),
      is_scheduled: isScheduled,
      scheduled_at: isScheduled ? scheduledDate.toISOString() : null,
      delivery_distance_km: distanceKm,
    }).select('id').single()

    if (!error && useSubscription) {
      await supabase
        .from('subscriptions')
        .update({ items_used: activeSub.items_used + totalItems })
        .eq('id', activeSub.id)
    }

    if (error) {
      setSaving(false)
      showAlert({ title: isEn ? 'Error' : 'خطأ', message: error.message || (isEn ? 'An error occurred' : 'حدث خطأ أثناء إنشاء الطلب'), type: 'error' })
      return
    }

    if (isOnlinePayment && orderData) {
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
          router.push({ pathname: '/payment', params: { url: paymentData.iframe_url } })
        } else if (paymentData.error) {
          showAlert({ title: isEn ? 'Error' : 'خطأ', message: paymentData.error, type: 'error' })
        }
      } catch (e) {
        setSaving(false)
        showAlert({ title: isEn ? 'Error' : 'خطأ', message: isEn ? 'Payment service connection error' : 'حدث خطأ في الاتصال بخدمة الدفع', type: 'error' })
      }
      return
    }

    setSaving(false)
    clearCart()
    playNotificationSound('order-placed')
    const msg = useSubscription
      ? (isEn ? `Order created! ${totalItems} items deducted from plan (${subRemaining! - totalItems} remaining)` : `تم إنشاء طلبك بنجاح!\nتم خصم ${totalItems} قطعة من باقتك (متبقي ${subRemaining! - totalItems})`)
      : (isEn ? 'Order created! A driver will be assigned soon' : 'تم إنشاء طلبك بنجاح! سيتم تعيين سائق قريباً')
    showAlert({ title: isEn ? 'Done' : 'تم', message: msg, type: 'success', buttons: [
      { text: t('ok'), onPress: () => router.replace('/(tabs)/orders') },
    ] })
  }

  if (loading) {
    return (
      <View style={[s.container, { backgroundColor: colors.navy[900], justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (cart.length === 0) {
    return (
      <View style={[s.emptyContainer, { backgroundColor: colors.navy[900] }]}>
        <Text style={s.emptyIcon}>🛒</Text>
        <Text style={[s.emptyTitle, { color: colors.text }]}>{isEn ? 'Cart is empty' : 'السلة فارغة'}</Text>
        <Text style={[s.emptyHint, { color: colors.navy[300] }]}>{isEn ? 'Add laundry items from the new order screen' : 'أضف قطع غسيل من شاشة الطلب الجديد'}</Text>
        <TouchableOpacity onPress={() => router.back()} style={[s.emptyBtn, { backgroundColor: colors.primary }]}>
          <Text style={s.emptyBtnText}>{isEn ? 'Go back' : 'العودة'}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <>
      <ScrollView style={[s.scrollContainer, { backgroundColor: colors.navy[900] }]} contentContainerStyle={s.content}>
        <Text style={[s.title, { color: colors.text }]}>{isEn ? `My Cart (${totalItems} items)` : `سلتي (${totalItems} قطعة)`}</Text>

        {cart.map((item, i) => (
          <View key={i} style={[s.cartItem, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.cartItemName, { color: colors.text }]}>{item.name} — {serviceLabel(item.service_type)}</Text>
              <Text style={[s.cartItemPrice, { color: colors.navy[300] }]}>{item.price} {t('currency')} / {isEn ? 'item' : 'قطعة'}</Text>
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

        <TouchableOpacity onPress={() => router.back()} style={s.addMoreBtn}>
          <Text style={[s.addMoreText, { color: colors.primary }]}>{isEn ? '+ Add more items' : '+ إضافة قطع أخرى'}</Text>
        </TouchableOpacity>

        {subExhausted && (
          <View style={[s.exhaustedBanner, { backgroundColor: colors.danger + '10', borderColor: colors.danger + '30' }]}>
            <Text style={[s.exhaustedText, { color: colors.danger }]}>
              {isEn ? '⚠️ Your plan items are used up. This order will be at regular prices.' : '⚠️ رصيد باقتك خلص. الطلب ده هيكون بأسعار عادية.'}
            </Text>
          </View>
        )}

        <Text style={[s.sectionTitle, { color: colors.text }]}>{isEn ? 'Pickup Address' : 'عنوان الاستلام (البيك أب)'}</Text>
        {addresses.length === 0 ? (
          <TouchableOpacity style={[s.addAddressBtn, { backgroundColor: colors.cardBg, borderColor: colors.primary }]} onPress={() => router.push('/addresses')}>
            <Text style={[s.addAddressText, { color: colors.primary }]}>📍 {isEn ? 'Add new address' : 'إضافة عنوان جديد'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.addressList}>
            {addresses.map(addr => (
              <TouchableOpacity key={addr.id} onPress={() => setSelectedAddress(addr)}
                style={[s.addressCard, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }, selectedAddress?.id === addr.id && { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}>
                <Text style={[s.addressLabel, { color: colors.text }]}>📍 {addr.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity style={s.checkboxRow} onPress={() => setSameAddress(!sameAddress)} activeOpacity={0.7}>
          <View style={[s.checkbox, { borderColor: colors.navy[500] }, sameAddress && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
            {sameAddress && <Text style={s.checkboxMark}>✓</Text>}
          </View>
          <Text style={[s.checkboxLabel, { color: colors.navy[100] }]}>{isEn ? 'Delivery address is same as pickup' : 'عنوان التسليم هو نفس عنوان الاستلام'}</Text>
        </TouchableOpacity>

        {!sameAddress && (
          <>
            <Text style={[s.sectionTitle, { color: colors.text }]}>{isEn ? 'Delivery Address' : 'عنوان التسليم (التوصيل)'}</Text>
            {addresses.length === 0 ? (
              <TouchableOpacity style={[s.addAddressBtn, { backgroundColor: colors.cardBg, borderColor: colors.primary }]} onPress={() => router.push('/addresses')}>
                <Text style={[s.addAddressText, { color: colors.primary }]}>📍 {isEn ? 'Add new address' : 'إضافة عنوان جديد'}</Text>
              </TouchableOpacity>
            ) : (
              <View style={s.addressList}>
                {addresses.map(addr => (
                  <TouchableOpacity key={addr.id} onPress={() => setDeliveryAddress(addr)}
                    style={[s.addressCard, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }, deliveryAddress?.id === addr.id && { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}>
                    <Text style={[s.addressLabel, { color: colors.text }]}>📍 {addr.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}

        {distanceKm !== null && (
          <View style={[s.distanceInfo, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }, outOfZone && { backgroundColor: colors.danger + '10', borderColor: colors.danger + '30' }]}>
            <Text style={[s.distanceText, { color: colors.primary }, outOfZone && { color: colors.danger }]}>
              📍 {isEn ? `Distance: ${distanceKm} km` : `المسافة: ${distanceKm} كم`} {outOfZone ? (isEn ? `(Out of zone — max ${zoneSettings.max_zone_km} km)` : `(خارج النطاق — الحد ${zoneSettings.max_zone_km} كم)`) : ''}
            </Text>
            {!outOfZone && deliveryFee > 0 && (
              <Text style={[s.distanceFee, { color: colors.navy[300] }]}>{isEn ? `Delivery fee: ${deliveryFee} EGP` : `رسوم التوصيل: ${deliveryFee} ج.م`}</Text>
            )}
          </View>
        )}

        {!useSubscription && (
          <>
            <Text style={[s.sectionTitle, { color: colors.text }]}>{isEn ? 'Payment Method' : 'طريقة الدفع'}</Text>
            <View style={s.paymentGrid}>
              {paymentMethods.map(pm => (
                <TouchableOpacity key={pm.key} onPress={() => setPaymentMethod(pm.key)}
                  style={[s.paymentCard, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }, paymentMethod === pm.key && { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}>
                  <Text style={s.paymentIcon}>{pm.icon}</Text>
                  <Text style={[s.paymentLabel, { color: colors.navy[200] }, paymentMethod === pm.key && { color: colors.text }]}>{isEn ? pm.labelEn : pm.label}</Text>
                  {paymentMethod === pm.key && <View style={[s.paymentCheck, { backgroundColor: colors.primary }]}><Text style={s.paymentCheckText}>✓</Text></View>}
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {paymentMethod === 'e_wallet' && !useSubscription && (
          <View style={[s.paymentInfoCard, { backgroundColor: colors.cardBg, borderColor: colors.accent + '30' }]}>
            <Text style={[s.paymentInfoTitle, { color: colors.text }]}>📱 {isEn ? 'Wallet phone number' : 'رقم موبايل المحفظة'}</Text>
            <TextInput
              style={[s.walletPhoneInput, { backgroundColor: colors.navy[700], color: colors.text, borderColor: colors.navy[600] }]}
              value={walletPhone}
              onChangeText={setWalletPhone}
              placeholder="01xxxxxxxxx"
              placeholderTextColor={colors.navy[400]}
              keyboardType="phone-pad"
              maxLength={11}
              textAlign="left"
            />
          </View>
        )}

        {paymentMethod === 'instapay' && paymentSettings.instapay && !useSubscription && (
          <View style={[s.paymentInfoCard, { backgroundColor: colors.cardBg, borderColor: colors.accent + '30' }]}>
            <Text style={[s.paymentInfoTitle, { color: colors.text }]}>🏦 {isEn ? 'Transfer to InstaPay number' : 'حوّل على رقم الإنستاباي'}</Text>
            <Text style={[s.paymentInfoNumber, { color: colors.accent }]} selectable>{paymentSettings.instapay}</Text>
            <Text style={[s.paymentInfoHint, { color: colors.navy[300] }]}>{isEn ? 'Transfer and send receipt screenshot to driver in chat' : 'حوّل المبلغ وأرسل صورة الإيصال للسائق في المحادثة'}</Text>
          </View>
        )}

        <Text style={[s.sectionTitle, { color: colors.text }]}>{isEn ? 'Pickup Time' : 'موعد الاستلام'}</Text>
        <View style={s.scheduleToggle}>
          <TouchableOpacity onPress={() => setIsScheduled(false)}
            style={[s.scheduleOption, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }, !isScheduled && { borderColor: colors.primary, backgroundColor: colors.primary + '15' }]}>
            <Text style={[s.scheduleOptionText, { color: colors.navy[300] }, !isScheduled && { color: colors.primary }]}>🚀 {isEn ? 'Now' : 'الآن'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsScheduled(true)}
            style={[s.scheduleOption, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }, isScheduled && { borderColor: colors.primary, backgroundColor: colors.primary + '15' }]}>
            <Text style={[s.scheduleOptionText, { color: colors.navy[300] }, isScheduled && { color: colors.primary }]}>🕐 {isEn ? 'Schedule' : 'جدولة'}</Text>
          </TouchableOpacity>
        </View>

        {isScheduled && (
          <View style={s.schedulePickerRow}>
            <TouchableOpacity style={[s.schedulePickerBtn, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }]} onPress={() => setShowDatePicker(true)}>
              <Text style={[s.schedulePickerLabel, { color: colors.text }]}>📅 {scheduledDate.toLocaleDateString(isEn ? 'en-US' : 'ar-EG')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.schedulePickerBtn, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }]} onPress={() => setShowTimePicker(true)}>
              <Text style={[s.schedulePickerLabel, { color: colors.text }]}>🕐 {scheduledDate.toLocaleTimeString(isEn ? 'en-US' : 'ar-EG', { hour: '2-digit', minute: '2-digit' })}</Text>
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

        <Text style={[s.sectionTitle, { color: colors.text }]}>{isEn ? 'Notes (optional)' : 'ملاحظات (اختياري)'}</Text>
        <TextInput style={[s.notesInput, { backgroundColor: colors.cardBg, color: colors.text, borderColor: colors.navy[700] }]} value={notes} onChangeText={setNotes}
          placeholder={isEn ? 'Any special instructions...' : 'أي تعليمات خاصة...'} placeholderTextColor={colors.navy[400]}
          multiline numberOfLines={3} textAlignVertical="top" textAlign={isEn ? 'left' : 'right'} />

        <View style={[s.totalCard, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }]}>
          {useSubscription ? (
            <>
              <View style={s.totalRow}><Text style={[s.totalLabel, { color: colors.navy[200] }]}>{isEn ? 'Total' : 'الإجمالي'}</Text><Text style={[s.totalValue, { color: colors.success }]}>{isEn ? 'Free (Plan)' : 'مجاناً (باقة)'}</Text></View>
              <Text style={{ fontSize: 11, color: colors.navy[400], textDecorationLine: 'line-through', textAlign: 'left' }}>{totalPrice.toFixed(2)} {t('currency')}</Text>
            </>
          ) : (
            <>
              <View style={s.totalRow}><Text style={[s.breakdownLabel, { color: colors.navy[400] }]}>{isEn ? 'Subtotal' : 'المجموع'}</Text><Text style={[s.breakdownValue, { color: colors.navy[200] }]}>{totalPrice.toFixed(2)} {t('currency')}</Text></View>
              {deliveryFee > 0 && <View style={s.totalRow}><Text style={[s.breakdownLabel, { color: colors.navy[400] }]}>{isEn ? 'Delivery fee' : 'رسوم التوصيل'}</Text><Text style={[s.breakdownValue, { color: colors.navy[200] }]}>{deliveryFee.toFixed(2)} {t('currency')}</Text></View>}
              <View style={[s.totalRow, { borderTopWidth: 1, borderTopColor: colors.navy[700], paddingTop: 8, marginTop: 4 }]}>
                <Text style={[s.totalLabel, { color: colors.navy[200] }]}>{isEn ? 'Total' : 'الإجمالي'}</Text>
                <Text style={[s.totalValue, { color: colors.primary }]}>{orderTotal.toFixed(2)} {t('currency')}</Text>
              </View>
            </>
          )}
        </View>

        <TouchableOpacity style={[s.submitBtn, saving && s.submitDisabled]} onPress={handleSubmit} disabled={saving} activeOpacity={0.8}>
          <LinearGradient colors={[colors.primary, colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.submitGradient}>
            <Text style={s.submitText}>{saving ? (isEn ? 'Submitting...' : 'جاري الإرسال...') : (isEn ? 'Confirm Order' : 'تأكيد الطلب')}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={clearCart} style={s.clearBtn}>
          <Text style={[s.clearBtnText, { color: colors.danger }]}>🗑 {isEn ? 'Clear cart' : 'تفريغ السلة'}</Text>
        </TouchableOpacity>
      </ScrollView>
      {AlertComponent}
    </>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scrollContainer: { flex: 1 },
  content: { padding: 20, paddingTop: 56, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, marginTop: 24 },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyHint: { fontSize: 14, marginBottom: 24, textAlign: 'center' },
  emptyBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
  emptyBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  cartItem: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1,
  },
  cartItemName: { fontSize: 14, fontWeight: '600' },
  cartItemPrice: { fontSize: 12, marginTop: 2 },
  cartItemActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: {
    width: 30, height: 30, borderRadius: 15,
    justifyContent: 'center', alignItems: 'center',
  },
  qtyBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  qtyDisplay: { fontSize: 15, fontWeight: '700', minWidth: 22, textAlign: 'center' },
  removeBtn: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginLeft: 4 },
  removeBtnText: { fontSize: 12, fontWeight: '700' },
  addMoreBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  addMoreText: { fontSize: 14, fontWeight: '600' },
  addAddressBtn: {
    borderRadius: 16, padding: 16, alignItems: 'center',
    borderWidth: 1.5, borderStyle: 'dashed',
  },
  addAddressText: { fontSize: 14, fontWeight: '600' },
  addressList: { gap: 8 },
  addressCard: {
    borderRadius: 12, padding: 12,
    borderWidth: 1.5,
  },
  addressLabel: { fontSize: 14, fontWeight: '600' },
  checkboxRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 16, paddingVertical: 8,
  },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxMark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  checkboxLabel: { fontSize: 14, fontWeight: '600', flex: 1 },
  paymentGrid: { gap: 10 },
  paymentCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, padding: 16, borderWidth: 1.5, gap: 12,
  },
  paymentIcon: { fontSize: 24 },
  paymentLabel: { fontSize: 14, fontWeight: '600', flex: 1 },
  paymentCheck: {
    width: 24, height: 24, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  paymentCheckText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  paymentInfoCard: {
    borderRadius: 14, padding: 16, marginTop: 12,
    borderWidth: 1, borderStyle: 'dashed',
  },
  paymentInfoTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  paymentInfoNumber: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 8, letterSpacing: 2 },
  paymentInfoHint: { fontSize: 11, textAlign: 'center', marginTop: 8 },
  walletPhoneInput: {
    borderRadius: 12, padding: 14,
    fontSize: 18, fontWeight: '600', letterSpacing: 1,
    borderWidth: 1, textAlign: 'center',
  },
  distanceInfo: {
    borderRadius: 12, padding: 12, marginTop: 12,
    borderWidth: 1,
  },
  distanceText: { fontSize: 13, fontWeight: '600' },
  distanceFee: { fontSize: 12, marginTop: 4 },
  scheduleToggle: {
    flexDirection: 'row', gap: 10, marginBottom: 12,
  },
  scheduleOption: {
    flex: 1, borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1.5,
  },
  scheduleOptionText: { fontSize: 15, fontWeight: '600' },
  schedulePickerRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  schedulePickerBtn: {
    flex: 1, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1,
  },
  schedulePickerLabel: { fontSize: 14, fontWeight: '600' },
  notesInput: {
    borderRadius: 16, padding: 16,
    fontSize: 14, borderWidth: 1, minHeight: 80,
  },
  totalCard: {
    borderRadius: 16, padding: 20, marginTop: 24,
    borderWidth: 1,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 16 },
  totalValue: { fontSize: 24, fontWeight: 'bold' },
  breakdownLabel: { fontSize: 13 },
  breakdownValue: { fontSize: 13 },
  submitBtn: {
    borderRadius: 16, overflow: 'hidden', marginTop: 20,
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 10,
  },
  submitGradient: { padding: 18, alignItems: 'center' },
  submitDisabled: { opacity: 0.6 },
  submitText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  exhaustedBanner: {
    borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1,
  },
  exhaustedText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  clearBtn: { alignItems: 'center', paddingVertical: 16, marginTop: 8 },
  clearBtnText: { fontSize: 14, fontWeight: '600' },
})
