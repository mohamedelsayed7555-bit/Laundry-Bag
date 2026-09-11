import { useState, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, RefreshControl, Image } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useAuth } from '../src/contexts/AuthContext'
import { useTheme } from '../src/contexts/ThemeContext'
import { useCustomAlert } from '../src/components/CustomAlert'
import { useLanguage } from '../src/contexts/LanguageContext'
import { supabase } from '../src/lib/supabase'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!

const PAYMENT_METHODS = [
  { key: 'cash', icon: '💵', labelKey: 'pmCash' },
  { key: 'visa', icon: '💳', labelKey: 'pmVisa' },
  { key: 'instapay', icon: '📱', labelKey: 'pmInstapay' },
  { key: 'e_wallet', icon: '📲', labelKey: 'pmWallet' },
]

export default function BagOrderScreen() {
  const { profile } = useAuth()
  const { colors } = useTheme()
  const router = useRouter()
  const { showAlert, AlertComponent } = useCustomAlert()
  const { t, locale } = useLanguage()

  const [bagOffer, setBagOffer] = useState<any>(null)
  const [addresses, setAddresses] = useState<any[]>([])
  const [selectedAddress, setSelectedAddress] = useState<any>(null)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [walletPhone, setWalletPhone] = useState('')
  const [paymentSettings, setPaymentSettings] = useState<{ instapay: string; wallet: string }>({ instapay: '', wallet: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [showAddressPicker, setShowAddressPicker] = useState(false)

  const loadData = useCallback(async () => {
    if (!profile) return
    const [bagRes, addrRes, settingsRes] = await Promise.all([
      supabase.from('settings').select('value').eq('key', 'bag_offer').single(),
      supabase.from('addresses').select('id, label, lat, lng, is_default, building, floor, apartment, landmark').eq('user_id', profile.id).order('is_default', { ascending: false }),
      supabase.from('settings').select('key, value').in('key', ['instapay_number', 'wallet_number']),
    ])
    let bagVal = bagRes.data?.value
    if (typeof bagVal === 'string') try { bagVal = JSON.parse(bagVal) } catch {}
    if (bagVal) setBagOffer(bagVal)
    if (addrRes.data) {
      setAddresses(addrRes.data)
      setSelectedAddress(addrRes.data.find((a: any) => a.is_default) ?? addrRes.data[0] ?? null)
    }
    if (settingsRes.data) {
      const inst = settingsRes.data.find((s: any) => s.key === 'instapay_number')
      const wal = settingsRes.data.find((s: any) => s.key === 'wallet_number')
      setPaymentSettings({
        instapay: typeof inst?.value === 'string' ? inst.value : String(inst?.value ?? ''),
        wallet: typeof wal?.value === 'string' ? wal.value : String(wal?.value ?? ''),
      })
    }
    setLoading(false)
  }, [profile])

  useEffect(() => { loadData() }, [loadData])

  async function onRefresh() {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  async function handleOrder() {
    if (!profile || !bagOffer) return
    if (!selectedAddress) {
      showAlert({ title: t('warning'), message: t('bagSelectAddress'), type: 'warning' })
      return
    }

    const isOnlinePayment = paymentMethod === 'visa' || paymentMethod === 'e_wallet'

    if (paymentMethod === 'e_wallet' && !walletPhone.match(/^01[0-9]{9}$/)) {
      showAlert({ title: t('warning'), message: t('bagWalletPhoneInvalid'), type: 'warning' })
      return
    }

    setSaving(true)
    const { data, error } = await supabase.from('orders').insert({
      customer_id: profile.id,
      service_type: 'wash_iron',
      items: [{ name: 'شنطة Laundry Bag', service_type: 'wash_iron', quantity: 1, price: bagOffer.daily_price }],
      items_count: bagOffer.max_items,
      subtotal: bagOffer.daily_price,
      delivery_fee: 0,
      total: bagOffer.daily_price,
      payment_method: paymentMethod,
      payment_status: 'pending',
      order_type: 'bag_offer',
      address_id: selectedAddress.id,
      pickup_location: { lat: selectedAddress.lat, lng: selectedAddress.lng, label: selectedAddress.label },
      delivery_location: { lat: selectedAddress.lat, lng: selectedAddress.lng, label: selectedAddress.label },
      notes: `${t('bagNotePrefix')} ${bagOffer.max_items} ${t('bagNoteSuffix')}`,
    }).select('id').single()

    if (error) {
      setSaving(false)
      showAlert({ title: t('error'), message: error.message, type: 'error' })
      return
    }

    if (isOnlinePayment && data) {
      try {
        const session = (await supabase.auth.getSession()).data.session
        const res = await fetch(`${SUPABASE_URL}/functions/v1/paymob-pay`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            order_id: data.id,
            payment_method: paymentMethod === 'visa' ? 'card' : 'wallet',
            ...(paymentMethod === 'e_wallet' ? { wallet_phone: walletPhone } : {}),
          }),
        })
        const paymentData = await res.json()
        setSaving(false)
        if (paymentData.iframe_url) {
          router.push({ pathname: '/payment', params: { url: paymentData.iframe_url } })
        } else if (paymentData.error) {
          showAlert({ title: t('error'), message: paymentData.error, type: 'error', onConfirm: () => router.replace(`/order/${data.id}`) })
        }
      } catch (e) {
        setSaving(false)
        showAlert({ title: t('error'), message: t('connectionError'), type: 'error', onConfirm: () => router.replace(`/order/${data.id}`) })
      }
      return
    }

    await supabase.from('notifications').insert({
      user_id: profile.id,
      title: t('bagOrderCreated'),
      body: `${t('bagOrderNotifBody')} ${bagOffer.daily_price} ${t('currency')} — ${t('bagOrderNotifMax')} ${bagOffer.max_items} ${t('bagOrderNotifPieces')}`,
      type: 'order',
      data: { order_id: data?.id },
      sent_at: new Date().toISOString(),
    })

    setSaving(false)
    showAlert({
      title: `${t('success')}! 🎉`,
      message: `${t('bagOrderSuccess')}\n${t('bagMaxItems')}: ${bagOffer.max_items} ${t('pieces')}\n${t('total')}: ${bagOffer.daily_price} ${t('currency')}`,
      type: 'success',
      onConfirm: () => router.replace(`/tracking/${data?.id}`),
    })
  }

  if (loading) return (
    <View style={[s.center, { backgroundColor: colors.navy[900] }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  )

  if (!bagOffer) return (
    <View style={[s.center, { backgroundColor: colors.navy[900] }]}>
      <Text style={{ color: colors.navy[300], fontSize: 16 }}>{t('bagOfferUnavailable')}</Text>
    </View>
  )

  const discount = bagOffer.original_price > bagOffer.daily_price
    ? Math.round((1 - bagOffer.daily_price / bagOffer.original_price) * 100)
    : 0

  return (
    <View style={{ flex: 1, backgroundColor: colors.navy[900] }}>
      {AlertComponent}
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}>
        {/* Offer Card */}
        <Animated.View entering={FadeInDown.duration(500)}>
          <LinearGradient colors={[colors.navy[700], colors.navy[800]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.offerCard, { borderWidth: 1, borderColor: colors.primary + '40' }]}>
            <View style={s.offerBadges}>
              <View style={[s.badge, { backgroundColor: colors.primary }]}><Text style={[s.badgeText, { color: '#fff' }]}>{t('bagBadge')}</Text></View>
              {discount > 0 && <View style={s.discountBadge}><Text style={s.discountText}>-{discount}%</Text></View>}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={s.offerTitle}>{t('bagTitle')}</Text>
                <Text style={s.offerSub}>{t('bagSubtitle')}</Text>
                <View style={s.priceRow}>
                  {discount > 0 && <Text style={s.oldPrice}>{bagOffer.original_price} {t('currency')}</Text>}
                  <Text style={s.price}>{bagOffer.daily_price} {t('currency')}</Text>
                  <Text style={s.perDay}>/ {t('bagPerDay')}</Text>
                </View>
              </View>
              <Image source={require('../assets/logo.jpg')} style={{ width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: colors.primary + '60' }} resizeMode="contain" />
            </View>
            <View style={s.infoRow}>
              <Text style={s.infoText}>📦 {t('bagMaxItems')}: {bagOffer.max_items} {t('pieces')}</Text>
              <Text style={s.infoText}>🚚 {t('bagFreeDelivery')}</Text>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Address */}
        <Animated.View entering={FadeInDown.duration(500).delay(100)}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>📍 {t('deliveryAddress')}</Text>
          {addresses.length === 0 ? (
            <TouchableOpacity style={[s.addAddressBtn, { borderColor: colors.navy[600] }]} onPress={() => router.push('/addresses')}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>+ {t('selectAddress')}</Text>
            </TouchableOpacity>
          ) : selectedAddress && !showAddressPicker ? (
            <View style={[s.compactAddrCard, { backgroundColor: colors.cardBg, borderColor: colors.primary }]}>
              <TouchableOpacity onPress={() => setShowAddressPicker(true)} style={[s.addrChangeBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }]}>
                <Text style={[s.addrChangeBtnText, { color: colors.primary }]}>{locale === 'en' ? 'Change' : 'تغيير'}</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={[s.addressLabel, { color: colors.text }]}>{selectedAddress.label}</Text>
                {(selectedAddress.building || selectedAddress.floor) && (
                  <Text style={{ color: colors.navy[300], fontSize: 12, marginTop: 4 }}>{[selectedAddress.building && `${t('bagBuilding')} ${selectedAddress.building}`, selectedAddress.floor && `${t('bagFloor')}${selectedAddress.floor}`].filter(Boolean).join(' — ')}</Text>
                )}
              </View>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {addresses.map(addr => (
                <TouchableOpacity key={addr.id} onPress={() => { setSelectedAddress(addr); setShowAddressPicker(false) }}
                  style={[s.addressCard, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }, selectedAddress?.id === addr.id && { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}>
                  <Text style={[s.addressLabel, { color: colors.text }]}>{selectedAddress?.id === addr.id ? '✅' : '📍'} {addr.label}</Text>
                  {addr.building && <Text style={{ color: colors.navy[400], fontSize: 11, marginTop: 4 }}>{t('bagBuilding')} {addr.building}{addr.floor ? ` — ${t('bagFloor')}${addr.floor}` : ''}</Text>}
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={[s.addAddressBtn, { borderColor: colors.primary }]} onPress={() => router.push('/addresses')}>
                <Text style={{ color: colors.primary, fontWeight: '700' }}>+ {locale === 'en' ? 'Add new address' : 'إضافة عنوان جديد'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>

        {/* Payment */}
        <Animated.View entering={FadeInDown.duration(500).delay(200)}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>💳 {t('paymentMethod')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.paymentChipsRow}>
            {PAYMENT_METHODS.map(pm => (
              <TouchableOpacity key={pm.key} onPress={() => setPaymentMethod(pm.key)}
                style={[s.paymentChip, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }, paymentMethod === pm.key && { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}>
                <Text style={{ fontSize: 18 }}>{pm.icon}</Text>
                <Text style={[s.paymentChipLabel, { color: colors.navy[300] }, paymentMethod === pm.key && { color: colors.primary }]}>{t(pm.labelKey)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {paymentMethod === 'e_wallet' && (
            <View style={[s.paymentInfoCard, { backgroundColor: colors.cardBg, borderColor: colors.primary + '30' }]}>
              <Text style={[s.paymentInfoTitle, { color: colors.text }]}>📱 {t('enterWalletPhone')}</Text>
              <TextInput
                style={[s.walletInput, { color: colors.text, borderColor: colors.navy[600], backgroundColor: colors.navy[800] }]}
                placeholder="01xxxxxxxxx"
                placeholderTextColor={colors.navy[400]}
                value={walletPhone}
                onChangeText={setWalletPhone}
                keyboardType="phone-pad"
                maxLength={11}
              />
            </View>
          )}

          {paymentMethod === 'instapay' && paymentSettings.instapay && (
            <View style={[s.paymentInfoCard, { backgroundColor: colors.cardBg, borderColor: colors.primary + '30' }]}>
              <Text style={[s.paymentInfoTitle, { color: colors.text }]}>🏦 {t('bagInstapayTitle')}</Text>
              <Text style={[s.paymentInfoNumber, { color: colors.primary }]} selectable>{paymentSettings.instapay}</Text>
              <Text style={[s.paymentInfoHint, { color: colors.navy[300] }]}>{t('bagInstapayHint')}</Text>
            </View>
          )}
        </Animated.View>

        {/* Summary + Order Button */}
        <Animated.View entering={FadeInDown.duration(500).delay(300)}>
          <View style={[s.summaryCard, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }]}>
            <View style={s.summaryRow}>
              <Text style={{ color: colors.navy[300], fontSize: 14 }}>{t('bagPrice')}</Text>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{bagOffer.daily_price} {t('currency')}</Text>
            </View>
            <View style={s.summaryRow}>
              <Text style={{ color: colors.navy[300], fontSize: 14 }}>{t('deliveryFee')}</Text>
              <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '700' }}>{t('bagFree')}</Text>
            </View>
            <View style={[s.summaryDivider, { backgroundColor: colors.navy[700] }]} />
            <View style={s.summaryRow}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>{t('total')}</Text>
              <Text style={{ color: colors.primary, fontSize: 20, fontWeight: '900' }}>{bagOffer.daily_price} {t('currency')}</Text>
            </View>
          </View>

          <TouchableOpacity onPress={handleOrder} disabled={saving || !selectedAddress} activeOpacity={0.85} style={{ marginTop: 16 }}>
            <LinearGradient colors={[colors.primary, colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={[s.orderBtn, { opacity: saving || !selectedAddress ? 0.5 : 1 }]}>
              {saving ? <ActivityIndicator color="#fff" /> : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={s.orderBtnText}>{t('bagOrderNow')}</Text>
                  <Text style={{ fontSize: 20 }}>👜</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, paddingTop: 56 },
  offerCard: { borderRadius: 24, padding: 20, marginBottom: 24 },
  offerBadges: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  discountBadge: { backgroundColor: '#ef4444', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  discountText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  offerTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 4 },
  offerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 12, lineHeight: 20 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  oldPrice: { color: 'rgba(255,255,255,0.4)', fontSize: 14, textDecorationLine: 'line-through' },
  price: { color: '#fff', fontSize: 26, fontWeight: '900' },
  perDay: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  infoRow: { flexDirection: 'row', gap: 16, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)' },
  infoText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, marginTop: 24 },
  addAddressBtn: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 16, padding: 16, alignItems: 'center' },
  compactAddrCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12, borderWidth: 1.5, gap: 12 },
  addrChangeBtn: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5 },
  addrChangeBtnText: { fontSize: 13, fontWeight: '700' },
  addressCard: { borderRadius: 12, padding: 12, borderWidth: 1.5 },
  addressLabel: { fontSize: 14, fontWeight: '600' },
  paymentChipsRow: { gap: 8, paddingVertical: 4 },
  paymentChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1.5 },
  paymentChipLabel: { fontSize: 12, fontWeight: '600' },
  paymentInfoCard: { borderRadius: 16, padding: 16, marginTop: 12, borderWidth: 1 },
  paymentInfoTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  paymentInfoNumber: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 8, letterSpacing: 2 },
  paymentInfoHint: { fontSize: 11, textAlign: 'center', marginTop: 8 },
  walletInput: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 18, textAlign: 'center', fontWeight: '700', letterSpacing: 2 },
  summaryCard: { borderRadius: 18, padding: 18, marginTop: 16, borderWidth: 1 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  summaryDivider: { height: 1, marginVertical: 8 },
  orderBtn: { borderRadius: 18, padding: 18, alignItems: 'center' },
  orderBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
})
