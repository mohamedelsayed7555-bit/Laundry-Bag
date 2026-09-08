import { useState, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useAuth } from '../src/contexts/AuthContext'
import { useTheme } from '../src/contexts/ThemeContext'
import { useCustomAlert } from '../src/components/CustomAlert'
import { supabase } from '../src/lib/supabase'

const PAYMENT_METHODS = [
  { key: 'cash', icon: '💵', label: 'كاش' },
  { key: 'visa', icon: '💳', label: 'فيزا' },
  { key: 'instapay', icon: '📱', label: 'إنستاباي' },
  { key: 'e_wallet', icon: '📲', label: 'محفظة إلكترونية' },
]

export default function BagOrderScreen() {
  const { profile } = useAuth()
  const { colors } = useTheme()
  const router = useRouter()
  const { showAlert, AlertComponent } = useCustomAlert()

  const [bagOffer, setBagOffer] = useState<any>(null)
  const [addresses, setAddresses] = useState<any[]>([])
  const [selectedAddress, setSelectedAddress] = useState<any>(null)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    if (!profile) return
    const [bagRes, addrRes] = await Promise.all([
      supabase.from('settings').select('value').eq('key', 'bag_offer').single(),
      supabase.from('addresses').select('id, label, lat, lng, is_default, building, floor, apartment, landmark').eq('user_id', profile.id).order('is_default', { ascending: false }),
    ])
    if (bagRes.data?.value) setBagOffer(bagRes.data.value)
    if (addrRes.data) {
      setAddresses(addrRes.data)
      setSelectedAddress(addrRes.data.find((a: any) => a.is_default) ?? addrRes.data[0] ?? null)
    }
    setLoading(false)
  }, [profile])

  useEffect(() => { loadData() }, [loadData])

  async function handleOrder() {
    if (!profile || !bagOffer) return
    if (!selectedAddress) {
      showAlert({ title: 'تنبيه', message: 'اختار عنوان التوصيل', type: 'warning' })
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
      notes: `عرض الشنطة — حد أقصى ${bagOffer.max_items} قطعة`,
    }).select('id').single()

    setSaving(false)
    if (error) {
      showAlert({ title: 'خطأ', message: error.message, type: 'error' })
      return
    }

    await supabase.from('notifications').insert({
      user_id: profile.id,
      title: 'تم إنشاء طلب شنطة Laundry Bag',
      body: `طلبك بقيمة ${bagOffer.daily_price} ج.م — حد أقصى ${bagOffer.max_items} قطعة. السائق في الطريق إليك.`,
      type: 'order',
      data: { order_id: data?.id },
      sent_at: new Date().toISOString(),
    })

    showAlert({
      title: 'تم بنجاح! 🎉',
      message: `تم طلب شنطة Laundry Bag\nالحد الأقصى: ${bagOffer.max_items} قطعة\nالمبلغ: ${bagOffer.daily_price} ج.م`,
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
      <Text style={{ color: colors.navy[300], fontSize: 16 }}>العرض غير متاح حالياً</Text>
    </View>
  )

  const discount = bagOffer.original_price > bagOffer.daily_price
    ? Math.round((1 - bagOffer.daily_price / bagOffer.original_price) * 100)
    : 0

  return (
    <View style={{ flex: 1, backgroundColor: colors.navy[900] }}>
      <AlertComponent />
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
                  {discount > 0 && <Text style={s.oldPrice}>{bagOffer.original_price} ج.م</Text>}
                  <Text style={s.price}>{bagOffer.daily_price} ج.م</Text>
                  <Text style={s.perDay}>/ يومياً</Text>
                </View>
              </View>
              <Text style={{ fontSize: 52 }}>👜</Text>
            </View>
            <View style={s.infoRow}>
              <Text style={s.infoText}>📦 الحد الأقصى: {bagOffer.max_items} قطعة</Text>
              <Text style={s.infoText}>🚚 التوصيل مجاني</Text>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Address */}
        <Animated.View entering={FadeInDown.duration(500).delay(100)}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>📍 عنوان التوصيل</Text>
          {addresses.length === 0 ? (
            <TouchableOpacity style={[s.addAddressBtn, { borderColor: colors.navy[600] }]} onPress={() => router.push('/addresses')}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>+ أضف عنوان</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ gap: 8 }}>
              {addresses.map(addr => (
                <TouchableOpacity key={addr.id} onPress={() => setSelectedAddress(addr)}
                  style={[s.addressCard, { backgroundColor: colors.cardBg, borderColor: selectedAddress?.id === addr.id ? colors.primary : colors.navy[700] }]}>
                  <Text style={[s.addressLabel, { color: selectedAddress?.id === addr.id ? colors.primary : colors.text }]}>
                    {selectedAddress?.id === addr.id ? '✅ ' : ''}{addr.label}
                  </Text>
                  {addr.building && <Text style={{ color: colors.navy[400], fontSize: 11 }}>مبنى {addr.building}{addr.floor ? ` — ط${addr.floor}` : ''}</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Animated.View>

        {/* Payment */}
        <Animated.View entering={FadeInDown.duration(500).delay(200)}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>💳 طريقة الدفع</Text>
          <View style={{ gap: 8 }}>
            {PAYMENT_METHODS.map(pm => (
              <TouchableOpacity key={pm.key} onPress={() => setPaymentMethod(pm.key)}
                style={[s.paymentCard, { backgroundColor: colors.cardBg, borderColor: paymentMethod === pm.key ? colors.primary : colors.navy[700] }]}>
                <Text style={{ fontSize: 22 }}>{pm.icon}</Text>
                <Text style={[s.paymentLabel, { color: paymentMethod === pm.key ? colors.primary : colors.text }]}>{pm.label}</Text>
                {paymentMethod === pm.key && <Text style={{ color: colors.primary, marginLeft: 'auto' }}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* Summary */}
        <Animated.View entering={FadeInDown.duration(500).delay(300)}>
          <View style={[s.summaryCard, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }]}>
            <View style={s.summaryRow}>
              <Text style={{ color: colors.navy[300], fontSize: 14 }}>سعر الشنطة</Text>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{bagOffer.daily_price} ج.م</Text>
            </View>
            <View style={s.summaryRow}>
              <Text style={{ color: colors.navy[300], fontSize: 14 }}>التوصيل</Text>
              <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '700' }}>مجاناً</Text>
            </View>
            <View style={[s.summaryDivider, { backgroundColor: colors.navy[700] }]} />
            <View style={s.summaryRow}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>الإجمالي</Text>
              <Text style={{ color: colors.primary, fontSize: 20, fontWeight: '900' }}>{bagOffer.daily_price} ج.م</Text>
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
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.orderBtnText}>اطلب الشنطة الآن 👜</Text>}
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
  summaryCard: { borderRadius: 18, padding: 18, marginTop: 16, borderWidth: 1 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  summaryDivider: { height: 1, marginVertical: 8 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 36 },
  orderBtn: { borderRadius: 18, padding: 18, alignItems: 'center' },
  orderBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
})
