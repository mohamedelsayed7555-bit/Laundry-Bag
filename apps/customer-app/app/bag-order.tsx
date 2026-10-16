import { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, RefreshControl, Image, I18nManager } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useAuth } from '../src/contexts/AuthContext'
import { useCustomAlert } from '../src/components/CustomAlert'
import { useLanguage } from '../src/contexts/LanguageContext'
import { supabase } from '../src/lib/supabase'
import { SkeletonPage } from '../src/components/Skeleton'
import { serverErrorMessage } from '../src/lib/serverErrors'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MapPin, Package, Truck, Plus, CreditCard, Banknote, Wallet, Landmark, Smartphone, ShoppingBag } from 'lucide-react-native'
import { useBrand, Card, ChoiceGrid, StickyFooter, IconButton, BackIcon, SoftWaves, money, cardShadow, F, SIZE, HIT, type Choice } from '../src/components/brand'
import { PrimaryButton } from '../src/components/auth/ui'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://kjqtrmedkvqfofwymoni.supabase.co'

const PAYMENT_METHODS = [
  { key: 'cash', icon: '💵', labelKey: 'pmCash' },
  { key: 'visa', icon: '💳', labelKey: 'pmVisa' },
  { key: 'instapay', icon: '📱', labelKey: 'pmInstapay' },
  { key: 'e_wallet', icon: '📲', labelKey: 'pmWallet' },
]

export default function BagOrderScreen() {
  const { profile } = useAuth()
  const router = useRouter()
  const { showAlert, AlertComponent } = useCustomAlert()
  const { t, locale } = useLanguage()
  const b = useBrand()
  const insets = useSafeAreaInsets()

  const [bagOffer, setBagOffer] = useState<any>(null)
  const [addresses, setAddresses] = useState<any[]>([])
  const [selectedAddress, setSelectedAddress] = useState<any>(null)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const bagPayScrollRef = useRef<ScrollView>(null)
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
    const { data, error } = await supabase.rpc('place_bag_order', {
      p: {
        address_id: selectedAddress.id,
        payment_method: paymentMethod,
        notes: `${t('bagNotePrefix')} ${bagOffer.max_items} ${t('bagNoteSuffix')}`,
      },
    })

    if (error || !data) {
      setSaving(false)
      showAlert({ title: t('error'), message: serverErrorMessage(error?.message, locale === 'en'), type: 'error' })
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
          router.push({ pathname: '/payment', params: { url: paymentData.iframe_url, kind: 'order', id: data.id } })
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

  if (loading) return <SkeletonPage />

  if (!bagOffer) return (
    <View style={[s.center, { backgroundColor: b.page }]}>
      <Text style={{ color: b.muted, fontSize: 16, fontFamily: F.medium }}>{t('bagOfferUnavailable')}</Text>
    </View>
  )

  const discount = bagOffer.original_price > bagOffer.daily_price
    ? Math.round((1 - bagOffer.daily_price / bagOffer.original_price) * 100)
    : 0
  const en = locale === 'en'
  // Texts are edited in the dashboard (Arabic); English keeps the translation.
  const bagBadge = (!en && bagOffer.badge_text) || t('bagBadge')
  const bagSub = (!en && bagOffer.subtitle) || t('bagSubtitle')
  const rtl = I18nManager.isRTL
  const payItems: Choice[] = PAYMENT_METHODS.map(pm => {
    const c = paymentMethod === pm.key ? '#fff' : b.accentIcon
    const Icon = pm.key === 'cash' ? Banknote : pm.key === 'visa' ? CreditCard : pm.key === 'instapay' ? Landmark : Wallet
    return { key: pm.key, label: t(pm.labelKey), icon: <Icon size={15} color={c} /> }
  })
  const addrDetails = (a: any) => [a.building && `${t('bagBuilding')} ${a.building}`, a.floor && `${t('bagFloor')}${a.floor}`].filter(Boolean).join(' · ')

  return (
    <View style={{ flex: 1, backgroundColor: b.page }}>
      {AlertComponent}
      <ScrollView
        contentContainerStyle={[s.content, { paddingTop: insets.top + 12, paddingBottom: 120 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={b.primary} colors={[b.primary]} />}
      >
        <SoftWaves height={520} crest={300} />

        <View style={s.header}>
          <IconButton onPress={() => router.back()} label={t('back')}>
            <BackIcon color={b.ink} />
          </IconButton>
        </View>

        {/* Offer hero: same look as the home banner */}
        <Animated.View entering={FadeInDown.duration(500)} style={s.hero}>
          <Image source={require('../assets/banners/bag.webp')} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <LinearGradient
            colors={['rgba(7,22,46,0.95)', 'rgba(7,22,46,0.75)', 'rgba(7,22,46,0.1)']}
            locations={[0, 0.5, 1]}
            start={{ x: rtl ? 1 : 0, y: 0 }}
            end={{ x: rtl ? 0 : 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={s.heroText}>
            <View style={s.badges}>
              <View style={s.badgeHot}><Text style={s.badgeHotText}>{bagBadge}</Text></View>
              {discount > 0 && <View style={s.badgeOff}><Text style={s.badgeOffText}>-{discount}%</Text></View>}
            </View>
            {en ? (
              <Text style={s.brand} numberOfLines={1}>{t('bagTitle')}</Text>
            ) : (
              <View style={s.brandRow}>
                <View style={s.prePill}><Text style={s.prePillText}>شنطة</Text></View>
                <Text style={s.brand}>Laundry <Text style={s.brandAccent}>Bag</Text></Text>
              </View>
            )}
            <Text style={s.heroSub} numberOfLines={2}>{bagSub}</Text>
            <View style={s.priceRow}>
              <Text style={s.price}>{bagOffer.daily_price} <Text style={s.priceCur}>{t('currency')}</Text></Text>
              {discount > 0 && <Text style={s.oldPrice}>{bagOffer.original_price}</Text>}
              <Text style={s.perDay}>/ {t('bagPerDay')}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Max items + free delivery */}
        <Animated.View entering={FadeInDown.duration(500).delay(80)} style={s.meta}>
          <View style={[s.metaCard, { backgroundColor: b.card, borderColor: b.cardBorder }, cardShadow(b)]}>
            <View style={[s.metaIcon, { backgroundColor: b.tint }]}><Package size={15} color={b.tintText} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.metaKey, { color: b.muted }]} numberOfLines={1}>{t('bagMaxItems')}</Text>
              <Text style={[s.metaVal, { color: b.ink }]} numberOfLines={1}>{bagOffer.max_items} {t('pieces')}</Text>
            </View>
          </View>
          <View style={[s.metaCard, { backgroundColor: b.card, borderColor: b.cardBorder }, cardShadow(b)]}>
            <View style={[s.metaIcon, { backgroundColor: b.okTint }]}><Truck size={15} color={b.okText} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.metaKey, { color: b.muted }]} numberOfLines={1}>{t('deliveryFee')}</Text>
              <Text style={[s.metaVal, { color: b.okText }]} numberOfLines={1}>{t('bagFreeDelivery')}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Address */}
        <Animated.View entering={FadeInDown.duration(500).delay(140)}>
          <View style={s.secRow}>
            <View style={[s.secIcon, { backgroundColor: b.tint }]}><MapPin size={14} color={b.tintText} /></View>
            <Text style={[s.sectionTitle, { color: b.ink }]}>{t('deliveryAddress')}</Text>
          </View>
          {addresses.length === 0 ? (
            <TouchableOpacity style={[s.dashed, { borderColor: b.isDark ? 'rgba(56,189,248,0.35)' : '#BFDDF7' }]} onPress={() => router.push('/addresses')} accessibilityRole="button">
              <Plus size={15} color={b.accentIcon} />
              <Text style={[s.dashedText, { color: b.accentIcon }]}>{t('selectAddress')}</Text>
            </TouchableOpacity>
          ) : selectedAddress && !showAddressPicker ? (
            <Card pad={false} style={s.addrRow}>
              <LinearGradient colors={['#38BDF8', '#0284C7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.pinTile}>
                <MapPin size={17} color="#fff" />
              </LinearGradient>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.addressLabel, { color: b.ink }]} numberOfLines={1}>{selectedAddress.label}</Text>
                {(selectedAddress.building || selectedAddress.floor) ? <Text style={[s.addressDetail, { color: b.muted }]} numberOfLines={1}>{addrDetails(selectedAddress)}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => setShowAddressPicker(true)} hitSlop={HIT} accessibilityRole="button" style={[s.changeChip, { backgroundColor: b.tint, borderColor: b.tintBorder }]}>
                <Text style={[s.changeChipText, { color: b.tintText }]}>{en ? 'Change' : 'تغيير'}</Text>
              </TouchableOpacity>
            </Card>
          ) : (
            <Card pad={false} style={{ overflow: 'hidden' }}>
              {addresses.map((addr, idx) => {
                const on = selectedAddress?.id === addr.id
                return (
                  <TouchableOpacity
                    key={addr.id}
                    onPress={() => { setSelectedAddress(addr); setShowAddressPicker(false) }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    style={[s.pickRow, idx > 0 && { borderTopWidth: 1, borderTopColor: b.divider }, on && { backgroundColor: b.isDark ? 'rgba(14,165,233,0.08)' : '#F0F8FF' }]}
                  >
                    <View style={[s.radio, { borderColor: on ? b.primary : b.raisedBorder }, on && { borderWidth: 5 }]} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[s.addressLabel, { color: b.ink }]} numberOfLines={1}>{addr.label}</Text>
                      {addr.building ? <Text style={[s.addressDetail, { color: b.muted }]} numberOfLines={1}>{addrDetails(addr)}</Text> : null}
                    </View>
                  </TouchableOpacity>
                )
              })}
              <TouchableOpacity style={[s.dashedRow, { borderTopColor: b.divider }]} onPress={() => router.push('/addresses')} accessibilityRole="button">
                <Plus size={15} color={b.accentIcon} />
                <Text style={[s.dashedText, { color: b.accentIcon }]}>{en ? 'Add new address' : 'إضافة عنوان جديد'}</Text>
              </TouchableOpacity>
            </Card>
          )}
        </Animated.View>

        {/* Payment */}
        <Animated.View entering={FadeInDown.duration(500).delay(200)}>
          <View style={s.secRow}>
            <View style={[s.secIcon, { backgroundColor: b.tint }]}><CreditCard size={14} color={b.tintText} /></View>
            <Text style={[s.sectionTitle, { color: b.ink }]}>{t('paymentMethod')}</Text>
          </View>
          <ChoiceGrid items={payItems} value={paymentMethod} onChange={setPaymentMethod} />

          {paymentMethod === 'e_wallet' && (
            <Card style={{ marginTop: 10 }}>
              <Text style={[s.infoTitle, { color: b.ink }]}>{t('enterWalletPhone').replace(/^\S+\s/, '')}</Text>
              <View style={[s.field, { backgroundColor: b.field, borderColor: b.fieldBorder }]}>
                <View style={[s.fieldIcon, { backgroundColor: b.iconTile }]}><Smartphone size={15} color={b.accentIcon} /></View>
                <TextInput
                  style={[s.fieldInput, { color: b.ink }]}
                  placeholder="01xxxxxxxxx"
                  placeholderTextColor={b.faint}
                  value={walletPhone}
                  onChangeText={setWalletPhone}
                  keyboardType="phone-pad"
                  maxLength={11}
                  textAlign="left"
                />
              </View>
            </Card>
          )}

          {paymentMethod === 'instapay' && paymentSettings.instapay && (
            <View style={[s.infoCard, { backgroundColor: b.tint, borderColor: b.tintBorder }]}>
              <Text style={[s.infoTitle, { color: b.ink, textAlign: 'center' }]}>{t('bagInstapayTitle')}</Text>
              <Text style={[s.instaNumber, { color: b.tintText }]} selectable>{paymentSettings.instapay}</Text>
              <Text style={[s.infoHint, { color: b.muted }]}>{t('bagInstapayHint')}</Text>
            </View>
          )}
        </Animated.View>

        {/* Receipt */}
        <Animated.View entering={FadeInDown.duration(500).delay(260)}>
          <Card style={{ marginTop: 14 }}>
            <View style={s.summaryRow}>
              <Text style={[s.sumKey, { color: b.muted }]}>{t('bagPrice')}</Text>
              <Text style={[s.sumVal, { color: b.ink2 }]}>{money(bagOffer.daily_price)} {t('currency')}</Text>
            </View>
            <View style={s.summaryRow}>
              <Text style={[s.sumKey, { color: b.muted }]}>{t('deliveryFee')}</Text>
              <Text style={[s.sumVal, { color: b.okText }]}>{t('bagFree')}</Text>
            </View>
            <View style={[s.summaryRow, s.totalLine, { borderTopColor: b.raisedBorder }]}>
              <Text style={[s.totalKey, { color: b.ink }]}>{t('total')}</Text>
              <Text style={[s.totalVal, { color: b.isDark ? '#38BDF8' : '#0284C7' }]}>{money(bagOffer.daily_price)} <Text style={[s.totalCur, { color: b.muted }]}>{t('currency')}</Text></Text>
            </View>
          </Card>
        </Animated.View>
      </ScrollView>

      <StickyFooter label={t('total')} total={money(bagOffer.daily_price)} currency={t('currency')} bottomInset={insets.bottom}>
        <PrimaryButton
          title={t('bagOrderNow')}
          onPress={handleOrder}
          loading={saving}
          disabled={!selectedAddress}
          leading={<ShoppingBag size={18} color="#fff" />}
        />
      </StickyFooter>
    </View>
  )
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: 16 },
  header: { flexDirection: 'row', marginBottom: 12 },
  hero: { height: 184, borderRadius: 20, overflow: 'hidden', backgroundColor: '#0F1A2E' },
  heroText: { position: 'absolute', top: 0, bottom: 0, start: 0, width: '76%', paddingHorizontal: 16, justifyContent: 'center', alignItems: 'flex-start' },
  badges: { flexDirection: 'row', gap: 5, marginBottom: 6 },
  badgeHot: { backgroundColor: '#F59E0B', paddingHorizontal: 9, height: 21, justifyContent: 'center', borderRadius: 11 },
  badgeHotText: { color: '#3A2300', fontSize: 11, fontFamily: F.bold },
  badgeOff: { backgroundColor: '#EF4444', paddingHorizontal: 9, height: 21, justifyContent: 'center', borderRadius: 11 },
  badgeOffText: { color: '#fff', fontSize: 11, fontFamily: F.bold },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  prePill: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)', borderRadius: 8, paddingHorizontal: 7, height: 22, justifyContent: 'center' },
  prePillText: { color: '#fff', fontSize: 11.5, fontFamily: F.bold },
  brand: { color: '#fff', fontFamily: F.display, fontSize: 22, writingDirection: 'ltr' },
  brandAccent: { color: '#7DD3FC' },
  heroSub: { color: 'rgba(255,255,255,0.88)', fontSize: 12.5, fontFamily: F.regular, marginTop: 3, lineHeight: 19 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 6 },
  price: { color: '#FCD34D', fontSize: 23, fontFamily: F.display },
  priceCur: { fontSize: 12, fontFamily: F.semibold },
  oldPrice: { color: 'rgba(255,255,255,0.6)', fontSize: 13, textDecorationLine: 'line-through', fontFamily: F.regular },
  perDay: { color: 'rgba(255,255,255,0.82)', fontSize: 12, fontFamily: F.regular },

  meta: { flexDirection: 'row', gap: 8, marginTop: 10 },
  metaCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 9, borderRadius: 14, borderWidth: 1 },
  metaIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  metaKey: { fontSize: 10.5, fontFamily: F.medium },
  metaVal: { fontSize: 13, fontFamily: F.bold },

  secRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 20, marginBottom: 9, marginHorizontal: 2 },
  secIcon: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontFamily: F.display },

  dashed: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: SIZE.M, borderRadius: SIZE.rM, borderWidth: 1.5, borderStyle: 'dashed' },
  dashedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: SIZE.M, borderTopWidth: 1 },
  dashedText: { fontSize: 13, fontFamily: F.bold },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  pinTile: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  addressLabel: { fontSize: 14, fontFamily: F.bold },
  addressDetail: { fontSize: 11.5, fontFamily: F.regular, marginTop: 1 },
  changeChip: { height: SIZE.S - 4, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  changeChipText: { fontSize: 12, fontFamily: F.bold },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: SIZE.M + 6, paddingHorizontal: 12, paddingVertical: 8 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, backgroundColor: '#fff' },

  infoCard: { borderRadius: 14, borderWidth: 1, padding: 12, marginTop: 10, gap: 4 },
  infoTitle: { fontSize: 13, fontFamily: F.bold, marginBottom: 8 },
  instaNumber: { fontSize: 22, fontFamily: F.display, textAlign: 'center', letterSpacing: 1.5 },
  infoHint: { fontSize: 11.5, fontFamily: F.regular, textAlign: 'center' },
  field: { flexDirection: 'row', alignItems: 'center', gap: 9, height: SIZE.L, borderRadius: 13, borderWidth: 1, paddingHorizontal: 10 },
  fieldIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  fieldInput: { flex: 1, fontSize: 15, fontFamily: F.medium, paddingVertical: 0, letterSpacing: 1 },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  sumKey: { fontSize: 13, fontFamily: F.regular },
  sumVal: { fontSize: 13.5, fontFamily: F.semibold },
  totalLine: { borderTopWidth: 1.5, borderStyle: 'dashed', paddingTop: 10, marginTop: 6 },
  totalKey: { fontSize: 14.5, fontFamily: F.bold },
  totalVal: { fontSize: 21, fontFamily: F.display },
  totalCur: { fontSize: 11, fontFamily: F.semibold },
})
