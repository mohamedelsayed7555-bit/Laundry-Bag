import { useState, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, TextInput } from 'react-native'
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
          showAlert({ title: t('error'), message: paymentData.error, type: 'error' })
        }
      } catch (e) {
        setSaving(false)
        showAlert({ title: t('error'), message: t('connectionError'), type: 'error' })
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
      onConfirm: () => router.replace('/(tabs)/orders'),
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
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Offer Card */}
        <Animated.View entering={FadeInDown.duration(500)}>
          <LinearGradient colors={['#059669', '#047857']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.offerCard}>
            <View style={s.offerBadges}>
              <View style={s.badge}><Text style={s.badgeText}>{bagOffer.badge_text}</Text></View>
              {discount > 0 && <View style={s.discountBadge}><Text style={s.discountText}>-{discount}%</Text></View>}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={s.offerTitle}>{bagOffer.title}</Text>
                <Text style={s.offerSub}>{bagOffer.subtitle}</Text>
                <View style={s.priceRow}>
                  {discount > 0 && <Text style={s.oldPrice}>{bagOffer.original_price} {t('currency')}</Text>}
                  <Text style={s.price}>{bagOffer.daily_price} {t('currency')}</Text>
                  <Text style={s.perDay}>/ {t('bagPerDay')}</Text>
                </View>
              </View>
              <Text style={{ fontSize: 52 }}>👜</Text>
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
          ) : (
            <View style={{ gap: 8 }}>
              {addresses.map(addr => (
                <TouchableOpacity key={addr.id} onPress={() => setSelectedAddress(addr)}
                  style={[s.addressCard, { backgroundColor: colors.cardBg, borderColor: selectedAddress?.id === addr.id ? colors.primary : colors.navy[700] }]}>
                  <Text style={[s.addressLabel, { color: selectedAddress?.id === addr.id ? colors.primary : colors.text }]}>
                    {selectedAddress?.id === addr.id ? '✅ ' : ''}{addr.label}
                  </Text>
                  {addr.building && <Text style={{ color: colors.navy[400], fontSize: 11 }}>{t('bagBuilding')} {addr.building}{addr.floor ? ` — ${t('bagFloor')}${addr.floor}` : ''}</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Animated.View>

        {/* Payment */}
        <Animated.View entering={FadeInDown.duration(500).delay(200)}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>💳 {t('paymentMethod')}</Text>
          <View style={{ gap: 8 }}>
            {PAYMENT_METHODS.map(pm => (
              <TouchableOpacity key={pm.key} onPress={() => setPaymentMethod(pm.key)}
                style={[s.paymentCard, { backgroundColor: colors.cardBg, borderColor: paymentMethod === pm.key ? colors.primary : colors.navy[700] }]}>
                <Text style={{ fontSize: 22 }}>{pm.icon}</Text>
                <Text style={[s.paymentLabel, { color: paymentMethod === pm.key ? colors.primary : colors.text }]}>{t(pm.labelKey)}</Text>
                {paymentMethod === pm.key && <Text style={{ color: colors.primary, marginLeft: 'auto' }}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>

          {/* E-Wallet phone input */}
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

          {/* InstaPay info */}
          {paymentMethod === 'instapay' && paymentSettings.instapay && (
            <View style={[s.paymentInfoCard, { backgroundColor: colors.cardBg, borderColor: colors.primary + '30' }]}>
              <Text style={[s.paymentInfoTitle, { color: colors.text }]}>🏦 {t('bagInstapayTitle')}</Text>
              <Text style={[s.paymentInfoNumber, { color: colors.primary }]} selectable>{paymentSettings.instapay}</Text>
              <Text style={[s.paymentInfoHint, { color: colors.navy[300] }]}>{t('bagInstapayHint')}</Text>
            </View>
          )}
        </Animated.View>

        {/* Summary */}
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
        </Animated.View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Order Button */}
      <View style={s.bottomBar}>
        <TouchableOpacity onPress={handleOrder} disabled={saving || !selectedAddress} activeOpacity={0.85}>
          <LinearGradient colors={['#059669', '#047857']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[s.orderBtn, { opacity: saving || !selectedAddress ? 0.5 : 1 }]}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.orderBtnText}>{t('bagOrderNow')} 👜</Text>}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, paddingTop: 56 },
  offerCard: { borderRadius: 24, padding: 20, marginBottom: 24 },
  offerBadges: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  badge: { backgroundColor: '#fbbf24', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeText: { color: '#78350f', fontSize: 11, fontWeight: '800' },
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
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, marginTop: 8 },
  addAddressBtn: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 16, padding: 20, alignItems: 'center' },
  addressCard: { borderRadius: 14, padding: 14, borderWidth: 1.5 },
  addressLabel: { fontSize: 14, fontWeight: '600' },
  paymentCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 14, borderWidth: 1.5 },
  paymentLabel: { fontSize: 14, fontWeight: '600' },
  paymentInfoCard: { borderRadius: 16, padding: 16, marginTop: 12, borderWidth: 1 },
  paymentInfoTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  paymentInfoNumber: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 8, letterSpacing: 2 },
  paymentInfoHint: { fontSize: 11, textAlign: 'center', marginTop: 8 },
  walletInput: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 18, textAlign: 'center', fontWeight: '700', letterSpacing: 2 },
  summaryCard: { borderRadius: 18, padding: 18, marginTop: 16, borderWidth: 1 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  summaryDivider: { height: 1, marginVertical: 8 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 36 },
  orderBtn: { borderRadius: 18, padding: 18, alignItems: 'center' },
  orderBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
})
