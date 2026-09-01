import { useState, useEffect, useCallback, useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useAuth } from '../../src/contexts/AuthContext'
import { useCustomAlert } from '../../src/components/CustomAlert'
import { supabase } from '../../src/lib/supabase'
import { colors } from '../../src/theme'

const services = [
  { key: 'wash', icon: '👔', label: 'غسيل' },
  { key: 'dry_clean', icon: '🧹', label: 'تنظيف جاف' },
  { key: 'iron', icon: '👕', label: 'كي فقط' },
  { key: 'wash_iron', icon: '✨', label: 'غسيل وكي' },
]

const paymentMethods = [
  { key: 'cash', icon: '💵', label: 'كاش' },
  { key: 'visa', icon: '💳', label: 'فيزا / ماستركارد' },
  { key: 'e_wallet', icon: '📱', label: 'محفظة إلكترونية' },
  { key: 'instapay', icon: '🏦', label: 'إنستاباي' },
]

const SUPABASE_URL = 'https://kjqtrmedkvqfofwymoni.supabase.co'

type OrderItem = {
  name: string
  service_type: string
  quantity: number
  price: number
}

export default function NewOrderScreen() {
  const { profile } = useAuth()
  const router = useRouter()
  const { showAlert, AlertComponent } = useCustomAlert()
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [notes, setNotes] = useState('')
  const [prices, setPrices] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [addresses, setAddresses] = useState<any[]>([])
  const [selectedAddress, setSelectedAddress] = useState<any>(null)

  const [itemTypes, setItemTypes] = useState<string[]>([])
  const [selectedItemType, setSelectedItemType] = useState('')
  const [selectedService, setSelectedService] = useState('')
  const [itemQty, setItemQty] = useState(1)

  const [cart, setCart] = useState<OrderItem[]>([])
  const [activeSub, setActiveSub] = useState<any>(null)
  const [walletPhone, setWalletPhone] = useState('')
  const [paymentSettings, setPaymentSettings] = useState<{ instapay: string; wallet: string }>({ instapay: '', wallet: '' })
  const [deliveryFee, setDeliveryFee] = useState(0)
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    supabase.from('prices').select('id, item_type, service_type, price').eq('is_active', true).then(({ data }) => {
      setPrices(data ?? [])
      const types = [...new Set((data ?? []).map((p: any) => p.item_type))]
      setItemTypes(types as string[])
      setDataLoading(false)
    })
    supabase.from('settings').select('key, value').eq('key', 'delivery_fee').single().then(({ data }) => {
      if (data) setDeliveryFee(Number(data.value) || 0)
    })
    supabase.from('settings').select('key, value').in('key', ['instapay_number', 'wallet_number']).then(({ data }) => {
      const inst = data?.find(s => s.key === 'instapay_number')
      const wal = data?.find(s => s.key === 'wallet_number')
      setPaymentSettings({
        instapay: typeof inst?.value === 'string' ? inst.value : String(inst?.value ?? ''),
        wallet: typeof wal?.value === 'string' ? wal.value : String(wal?.value ?? ''),
      })
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
    const match = prices.find(p => p.item_type === itemType && p.service_type === serviceType)
    return match?.price ?? 0
  }, [prices])

  const availableServices = useMemo(() => {
    if (!selectedItemType) return []
    return services.filter(s => prices.some(p => p.item_type === selectedItemType && p.service_type === s.key))
  }, [selectedItemType, prices])

  const addToCart = () => {
    if (!selectedItemType || !selectedService) return
    const unitPrice = getPrice(selectedItemType, selectedService)
    if (unitPrice === 0) return

    const existing = cart.findIndex(
      c => c.name === selectedItemType && c.service_type === selectedService
    )
    if (existing >= 0) {
      const updated = [...cart]
      updated[existing] = { ...updated[existing], quantity: updated[existing].quantity + itemQty }
      setCart(updated)
    } else {
      setCart([...cart, { name: selectedItemType, service_type: selectedService, quantity: itemQty, price: unitPrice }])
    }
    setSelectedItemType('')
    setSelectedService('')
    setItemQty(1)
  }

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index))
  }

  const totalPrice = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart])
  const totalItems = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart])

  const serviceLabel = (key: string) => services.find(s => s.key === key)?.label ?? key

  async function handleSubmit() {
    if (!profile) return
    if (!selectedAddress) {
      showAlert({ title: 'تنبيه', message: 'ادخل موقعك — اختر عنوان من عناوينك أو أضف عنوان جديد', type: 'warning' })
      return
    }
    if (cart.length === 0) {
      showAlert({ title: 'تنبيه', message: 'أضف قطعة واحدة على الأقل', type: 'warning' })
      return
    }

    if (activeSub && subRemaining !== null && totalItems > subRemaining) {
      showAlert({ title: 'تنبيه', message: `رصيد باقتك ${subRemaining} قطعة فقط وأنت محتاج ${totalItems} قطعة.\nيمكنك ترقية باقتك أو تقليل عدد القطع.`, type: 'warning' })
      return
    }

    const useSubscription = activeSub && subRemaining !== null && subRemaining >= totalItems
    const fee = useSubscription ? 0 : deliveryFee
    const orderTotal = useSubscription ? 0 : totalPrice + fee

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
    }).select('id').single()

    if (!error && useSubscription) {
      await supabase
        .from('subscriptions')
        .update({ items_used: activeSub.items_used + totalItems })
        .eq('id', activeSub.id)
      setActiveSub({ ...activeSub, items_used: activeSub.items_used + totalItems })
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
    const msg = useSubscription
      ? `تم إنشاء طلبك بنجاح!\nتم خصم ${totalItems} قطعة من باقتك (متبقي ${subRemaining! - totalItems})`
      : 'تم إنشاء طلبك بنجاح! سيتم تعيين سائق قريباً'
    showAlert({ title: 'تم', message: msg, type: 'success', buttons: [
      { text: 'حسناً', onPress: () => router.replace('/(tabs)/orders') },
    ] })
  }

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

      {/* Subscription Banner */}
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

      <Text style={s.stepLabel}>نوع القطعة</Text>
      <View style={s.grid}>
        {itemTypes.map(type => (
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
          <TouchableOpacity style={s.addBtn} onPress={addToCart}>
            <Text style={s.addBtnText}>+ أضف للطلب</Text>
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
              <TouchableOpacity onPress={() => removeFromCart(i)} style={s.removeBtn}>
                <Text style={s.removeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}

      {/* Payment - hidden if subscription covers it */}
      {!(activeSub && subRemaining !== null && subRemaining >= totalItems && totalItems > 0) && (
        <>
          <Text style={s.sectionTitle}>طريقة الدفع</Text>
          <View style={s.grid}>
            {paymentMethods.map(pm => (
              <TouchableOpacity key={pm.key} onPress={() => setPaymentMethod(pm.key)}
                style={[s.optionCard, paymentMethod === pm.key && s.optionSelected]}>
                <Text style={s.optionIcon}>{pm.icon}</Text>
                <Text style={[s.optionLabel, paymentMethod === pm.key && s.optionLabelSelected]}>{pm.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {paymentMethod === 'e_wallet' && (
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
          <Text style={s.paymentInfoHint}>أدخل رقم موبايل المحفظة (فودافون كاش / أورانج كاش / إلخ) وهيجيلك إشعار للموافقة على الدفع</Text>
        </View>
      )}

      {paymentMethod === 'instapay' && paymentSettings.instapay ? (
        <View style={s.paymentInfoCard}>
          <Text style={s.paymentInfoTitle}>🏦 حوّل على رقم الإنستاباي</Text>
          <Text style={s.paymentInfoNumber} selectable>{paymentSettings.instapay}</Text>
          <Text style={s.paymentInfoHint}>حوّل المبلغ وأرسل صورة الإيصال للسائق في المحادثة</Text>
        </View>
      ) : null}

      <Text style={s.sectionTitle}>ملاحظات (اختياري)</Text>
      <TextInput style={s.notesInput} value={notes} onChangeText={setNotes}
        placeholder="أي تعليمات خاصة..." placeholderTextColor={colors.navy[400]}
        multiline numberOfLines={3} textAlignVertical="top" textAlign="right" />

      <View style={s.totalCard}>
        {activeSub && subRemaining !== null && subRemaining >= totalItems && totalItems > 0 ? (
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
              <Text style={s.totalValue}>{(totalPrice + deliveryFee).toFixed(2)} ج.م</Text>
            </View>
          </>
        )}
      </View>

      <TouchableOpacity style={[s.submitBtn, (saving || cart.length === 0) && s.submitDisabled]} onPress={handleSubmit} disabled={saving || cart.length === 0} activeOpacity={0.8}>
        <LinearGradient colors={[colors.primary, colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.submitGradient}>
          <Text style={s.submitText}>{saving ? 'جاري الإرسال...' : 'تأكيد الطلب'}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
    {AlertComponent}
    </>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900] },
  content: { padding: 20, paddingTop: 56, paddingBottom: 120 },
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
  removeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.navy[700], justifyContent: 'center', alignItems: 'center' },
  removeBtnText: { color: colors.danger, fontSize: 14, fontWeight: '700' },
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

  // Payment info
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

  // Subscription banner
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
})
