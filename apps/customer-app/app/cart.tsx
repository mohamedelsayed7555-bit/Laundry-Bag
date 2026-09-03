import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Platform } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import DateTimePicker from '@react-native-community/datetimepicker'
import { useAuth } from '../src/contexts/AuthContext'
import { haversineKm } from '../src/utils/distance'
import { useCart } from '../src/contexts/CartContext'
import { useCustomAlert } from '../src/components/CustomAlert'
import { playNotificationSound } from '../src/hooks/useNotifications'
import { supabase } from '../src/lib/supabase'
import { colors } from '../src/theme'

const paymentMethods = [
  { key: 'cash', icon: '💵', label: 'كاش' },
  { key: 'visa', icon: '💳', label: 'فيزا / ماستركارد' },
  { key: 'e_wallet', icon: '📱', label: 'محفظة إلكترونية' },
  { key: 'instapay', icon: '🏦', label: 'إنستاباي' },
]

const services = [
  { key: 'wash', label: 'غسيل' },
  { key: 'dry_clean', label: 'تنظيف جاف' },
  { key: 'iron', label: 'كي فقط' },
  { key: 'wash_iron', label: 'غسيل وكي' },
]

const SUPABASE_URL = 'https://kjqtrmedkvqfofwymoni.supabase.co'

export default function CartScreen() {
  const { profile } = useAuth()
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
  const [activeSub, setActiveSub] = useState<any>(null)
  const [walletPhone, setWalletPhone] = useState('')
  const [paymentSettings, setPaymentSettings] = useState<{ instapay: string; wallet: string }>({ instapay: '', wallet: '' })
  const [deliveryFee, setDeliveryFee] = useState(0)
  const [zoneSettings, setZoneSettings] = useState({ max_zone_km: 30, price_per_km: 2, base_delivery_km: 5, laundry_lat: 30.0444, laundry_lng: 31.2357 })
  const [distanceKm, setDistanceKm] = useState<number | null>(null)
  const [outOfZone, setOutOfZone] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('settings').select('key, value').in('key', ['delivery_fee', 'max_zone_km', 'price_per_km', 'base_delivery_km', 'laundry_lat', 'laundry_lng']),
      supabase.from('settings').select('key, value').in('key', ['instapay_number', 'wallet_number']),
      profile ? supabase.from('addresses').select('id, label, address, lat, lng, is_default').eq('user_id', profile.id).order('is_default', { ascending: false }) : null,
      profile ? supabase.from('subscriptions').select('*, plans(name)').eq('user_id', profile.id).eq('status', 'active').single() : null,
    ]).then(([allSettingsRes, settingsRes, addrRes, subRes]) => {
      if (allSettingsRes?.data) {
        const s: any = {}
        allSettingsRes.data.forEach((r: any) => { s[r.key] = r.value })
        setDeliveryFee(Number(s.delivery_fee) || 0)
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

  useEffect(() => {
    if (selectedAddress?.lat && selectedAddress?.lng) {
      const dist = haversineKm(zoneSettings.laundry_lat, zoneSettings.laundry_lng, selectedAddress.lat, selectedAddress.lng)
      setDistanceKm(Math.round(dist * 10) / 10)
      setOutOfZone(dist > zoneSettings.max_zone_km)
      if (dist > zoneSettings.base_delivery_km) {
        const extraKm = dist - zoneSettings.base_delivery_km
        setDeliveryFee(prev => Math.round(extraKm * zoneSettings.price_per_km))
      }
    }
  }, [selectedAddress, zoneSettings])

  const subRemaining = activeSub ? activeSub.items_limit - activeSub.items_used : null
  const useSubscription = activeSub && subRemaining !== null && subRemaining >= totalItems && totalItems > 0
  const fee = useSubscription ? 0 : deliveryFee
  const orderTotal = useSubscription ? 0 : totalPrice + fee

  const serviceLabel = (key: string) => services.find(s => s.key === key)?.label ?? key

  async function handleSubmit() {
    if (!profile) return
    if (!selectedAddress) {
      showAlert({ title: 'تنبيه', message: 'اختر عنوان الاستلام', type: 'warning' })
      return
    }
    if (cart.length === 0) {
      showAlert({ title: 'تنبيه', message: 'السلة فارغة', type: 'warning' })
      return
    }
    if (outOfZone) {
      showAlert({ title: 'خارج نطاق التوصيل', message: `العنوان المختار يبعد ${distanceKm} كم — الحد الأقصى ${zoneSettings.max_zone_km} كم`, type: 'warning' })
      return
    }
    if (activeSub && subRemaining !== null && totalItems > subRemaining) {
      showAlert({ title: 'تنبيه', message: `رصيد باقتك ${subRemaining} قطعة فقط وأنت محتاج ${totalItems} قطعة.\nيمكنك ترقية باقتك أو تقليل عدد القطع.`, type: 'warning' })
      return
    }

    setSaving(true)
    const isOnlinePayment = !useSubscription && (paymentMethod === 'visa' || paymentMethod === 'e_wallet')

    if (isOnlinePayment && paymentMethod === 'e_wallet' && !walletPhone.match(/^01[0-9]{9}$/)) {
      setSaving(false)
      showAlert({ title: 'تنبيه', message: 'أدخل رقم موبايل المحفظة بشكل صحيح (01xxxxxxxxx)', type: 'warning' })
      return
    }

    const { data: orderData, error } = await supabase.from('orders').insert({
      customer_id: profile.id,
      service_type: cart[0].service_type,
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
      delivery_location: selectedAddress ? { lat: selectedAddress.lat, lng: selectedAddress.lng, label: selectedAddress.label } : {},
      is_scheduled: isScheduled,
      scheduled_at: isScheduled ? scheduledDate.toISOString() : null,
      pickup_location: selectedAddress ? { lat: selectedAddress.lat, lng: selectedAddress.lng, label: selectedAddress.label } : null,
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
      showAlert({ title: 'خطأ', message: error.message || 'حدث خطأ أثناء إنشاء الطلب', type: 'error' })
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
          showAlert({ title: 'خطأ', message: paymentData.error, type: 'error' })
        }
      } catch (e) {
        setSaving(false)
        showAlert({ title: 'خطأ', message: 'حدث خطأ في الاتصال بخدمة الدفع', type: 'error' })
      }
      return
    }

    setSaving(false)
    clearCart()
    playNotificationSound('order-placed')
    const msg = useSubscription
      ? `تم إنشاء طلبك بنجاح!\nتم خصم ${totalItems} قطعة من باقتك (متبقي ${subRemaining! - totalItems})`
      : 'تم إنشاء طلبك بنجاح! سيتم تعيين سائق قريباً'
    showAlert({ title: 'تم', message: msg, type: 'success', buttons: [
      { text: 'حسناً', onPress: () => router.replace('/(tabs)/orders') },
    ] })
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.navy[900], justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (cart.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.navy[900], justifyContent: 'center', alignItems: 'center', padding: 40 }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🛒</Text>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 8 }}>السلة فارغة</Text>
        <Text style={{ fontSize: 14, color: colors.navy[300], marginBottom: 24, textAlign: 'center' }}>أضف قطع غسيل من شاشة الطلب الجديد</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>العودة</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <>
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <Text style={s.title}>سلتي ({totalItems} قطعة)</Text>

        {/* Cart Items */}
        {cart.map((item, i) => (
          <View key={i} style={s.cartItem}>
            <View style={{ flex: 1 }}>
              <Text style={s.cartItemName}>{item.name} — {serviceLabel(item.service_type)}</Text>
              <Text style={s.cartItemPrice}>{item.price} ج.م / قطعة</Text>
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

        <TouchableOpacity onPress={() => router.back()} style={s.addMoreBtn}>
          <Text style={s.addMoreText}>+ إضافة قطع أخرى</Text>
        </TouchableOpacity>

        {/* Address */}
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
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Distance Info */}
        {distanceKm !== null && (
          <View style={[s.distanceInfo, outOfZone && s.distanceInfoDanger]}>
            <Text style={[s.distanceText, outOfZone && { color: colors.danger }]}>
              📍 المسافة: {distanceKm} كم {outOfZone ? `(خارج النطاق — الحد ${zoneSettings.max_zone_km} كم)` : ''}
            </Text>
            {!outOfZone && deliveryFee > 0 && (
              <Text style={s.distanceFee}>رسوم التوصيل: {deliveryFee} ج.م</Text>
            )}
          </View>
        )}

        {/* Payment */}
        {!useSubscription && (
          <>
            <Text style={s.sectionTitle}>طريقة الدفع</Text>
            <View style={s.paymentGrid}>
              {paymentMethods.map(pm => (
                <TouchableOpacity key={pm.key} onPress={() => setPaymentMethod(pm.key)}
                  style={[s.paymentCard, paymentMethod === pm.key && s.paymentSelected]}>
                  <Text style={s.paymentIcon}>{pm.icon}</Text>
                  <Text style={[s.paymentLabel, paymentMethod === pm.key && s.paymentLabelSelected]}>{pm.label}</Text>
                  {paymentMethod === pm.key && <View style={s.paymentCheck}><Text style={s.paymentCheckText}>✓</Text></View>}
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {paymentMethod === 'e_wallet' && !useSubscription && (
          <View style={s.paymentInfoCard}>
            <Text style={s.paymentInfoTitle}>📱 رقم موبايل المحفظة</Text>
            <TextInput
              style={s.walletPhoneInput}
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
          <View style={s.paymentInfoCard}>
            <Text style={s.paymentInfoTitle}>🏦 حوّل على رقم الإنستاباي</Text>
            <Text style={s.paymentInfoNumber} selectable>{paymentSettings.instapay}</Text>
            <Text style={s.paymentInfoHint}>حوّل المبلغ وأرسل صورة الإيصال للسائق في المحادثة</Text>
          </View>
        )}

        {/* Scheduling */}
        <Text style={s.sectionTitle}>موعد الاستلام</Text>
        <View style={s.scheduleToggle}>
          <TouchableOpacity onPress={() => setIsScheduled(false)}
            style={[s.scheduleOption, !isScheduled && s.scheduleOptionActive]}>
            <Text style={[s.scheduleOptionText, !isScheduled && s.scheduleOptionTextActive]}>🚀 الآن</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsScheduled(true)}
            style={[s.scheduleOption, isScheduled && s.scheduleOptionActive]}>
            <Text style={[s.scheduleOptionText, isScheduled && s.scheduleOptionTextActive]}>🕐 جدولة</Text>
          </TouchableOpacity>
        </View>

        {isScheduled && (
          <View style={s.schedulePickerRow}>
            <TouchableOpacity style={s.schedulePickerBtn} onPress={() => setShowDatePicker(true)}>
              <Text style={s.schedulePickerLabel}>📅 {scheduledDate.toLocaleDateString('ar-EG')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.schedulePickerBtn} onPress={() => setShowTimePicker(true)}>
              <Text style={s.schedulePickerLabel}>🕐 {scheduledDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</Text>
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

        {/* Notes */}
        <Text style={s.sectionTitle}>ملاحظات (اختياري)</Text>
        <TextInput style={s.notesInput} value={notes} onChangeText={setNotes}
          placeholder="أي تعليمات خاصة..." placeholderTextColor={colors.navy[400]}
          multiline numberOfLines={3} textAlignVertical="top" textAlign="right" />

        {/* Total */}
        <View style={s.totalCard}>
          {useSubscription ? (
            <>
              <View style={s.totalRow}><Text style={s.totalLabel}>الإجمالي</Text><Text style={[s.totalValue, { color: colors.success }]}>مجاناً (باقة)</Text></View>
              <Text style={{ fontSize: 11, color: colors.navy[400], textDecorationLine: 'line-through', textAlign: 'left' }}>{totalPrice.toFixed(2)} ج.م</Text>
            </>
          ) : (
            <>
              <View style={s.totalRow}><Text style={s.breakdownLabel}>المجموع</Text><Text style={s.breakdownValue}>{totalPrice.toFixed(2)} ج.م</Text></View>
              {deliveryFee > 0 && <View style={s.totalRow}><Text style={s.breakdownLabel}>رسوم التوصيل</Text><Text style={s.breakdownValue}>{deliveryFee.toFixed(2)} ج.م</Text></View>}
              <View style={[s.totalRow, { borderTopWidth: 1, borderTopColor: colors.navy[700], paddingTop: 8, marginTop: 4 }]}>
                <Text style={s.totalLabel}>الإجمالي</Text>
                <Text style={s.totalValue}>{orderTotal.toFixed(2)} ج.م</Text>
              </View>
            </>
          )}
        </View>

        {/* Submit */}
        <TouchableOpacity style={[s.submitBtn, saving && s.submitDisabled]} onPress={handleSubmit} disabled={saving} activeOpacity={0.8}>
          <LinearGradient colors={[colors.primary, colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.submitGradient}>
            <Text style={s.submitText}>{saving ? 'جاري الإرسال...' : 'تأكيد الطلب'}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={clearCart} style={s.clearBtn}>
          <Text style={s.clearBtnText}>🗑 تفريغ السلة</Text>
        </TouchableOpacity>
      </ScrollView>
      {AlertComponent}
    </>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900] },
  content: { padding: 20, paddingTop: 56, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 12, marginTop: 24 },
  cartItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.navy[800],
    borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.navy[700],
  },
  cartItemName: { fontSize: 14, fontWeight: '600', color: '#fff' },
  cartItemPrice: { fontSize: 12, color: colors.navy[300], marginTop: 2 },
  cartItemActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.navy[700],
    justifyContent: 'center', alignItems: 'center',
  },
  qtyBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  qtyDisplay: { fontSize: 15, fontWeight: '700', color: '#fff', minWidth: 22, textAlign: 'center' },
  removeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.danger + '20', justifyContent: 'center', alignItems: 'center', marginLeft: 4 },
  removeBtnText: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  addMoreBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  addMoreText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
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
  paymentGrid: { gap: 10 },
  paymentCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.navy[800],
    borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: colors.navy[700], gap: 12,
  },
  paymentSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
  paymentIcon: { fontSize: 24 },
  paymentLabel: { fontSize: 14, fontWeight: '600', color: colors.navy[200], flex: 1 },
  paymentLabelSelected: { color: '#fff' },
  paymentCheck: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  paymentCheckText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  paymentInfoCard: {
    backgroundColor: colors.navy[800], borderRadius: 14, padding: 16, marginTop: 12,
    borderWidth: 1, borderColor: colors.accent + '30', borderStyle: 'dashed',
  },
  paymentInfoTitle: { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 8 },
  paymentInfoNumber: { fontSize: 22, fontWeight: 'bold', color: colors.accent, textAlign: 'center', marginBottom: 8, letterSpacing: 2 },
  paymentInfoHint: { fontSize: 11, color: colors.navy[300], textAlign: 'center', marginTop: 8 },
  walletPhoneInput: {
    backgroundColor: colors.navy[700], borderRadius: 12, padding: 14,
    color: '#fff', fontSize: 18, fontWeight: '600', letterSpacing: 1,
    borderWidth: 1, borderColor: colors.navy[600], textAlign: 'center',
  },
  distanceInfo: {
    backgroundColor: colors.primary + '10', borderRadius: 12, padding: 12, marginTop: 12,
    borderWidth: 1, borderColor: colors.primary + '30',
  },
  distanceInfoDanger: { backgroundColor: colors.danger + '10', borderColor: colors.danger + '30' },
  distanceText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  distanceFee: { fontSize: 12, color: colors.navy[300], marginTop: 4 },
  scheduleToggle: {
    flexDirection: 'row', gap: 10, marginBottom: 12,
  },
  scheduleOption: {
    flex: 1, backgroundColor: colors.navy[800], borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1.5, borderColor: colors.navy[700],
  },
  scheduleOptionActive: { borderColor: colors.primary, backgroundColor: colors.primary + '15' },
  scheduleOptionText: { fontSize: 15, fontWeight: '600', color: colors.navy[300] },
  scheduleOptionTextActive: { color: colors.primary },
  schedulePickerRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  schedulePickerBtn: {
    flex: 1, backgroundColor: colors.navy[800], borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1, borderColor: colors.navy[700],
  },
  schedulePickerLabel: { fontSize: 14, fontWeight: '600', color: '#fff' },
  notesInput: {
    backgroundColor: colors.navy[800], borderRadius: 16, padding: 16,
    color: '#fff', fontSize: 14, borderWidth: 1, borderColor: colors.navy[700], minHeight: 80,
  },
  totalCard: {
    backgroundColor: colors.navy[800], borderRadius: 16, padding: 20, marginTop: 24,
    borderWidth: 1, borderColor: colors.navy[700],
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 16, color: colors.navy[200] },
  totalValue: { fontSize: 24, fontWeight: 'bold', color: colors.primary },
  breakdownLabel: { fontSize: 13, color: colors.navy[400] },
  breakdownValue: { fontSize: 13, color: colors.navy[200] },
  submitBtn: {
    borderRadius: 16, overflow: 'hidden', marginTop: 20,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 10,
  },
  submitGradient: { padding: 18, alignItems: 'center' },
  submitDisabled: { opacity: 0.6 },
  submitText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  clearBtn: { alignItems: 'center', paddingVertical: 16, marginTop: 8 },
  clearBtnText: { color: colors.danger, fontSize: 14, fontWeight: '600' },
})
