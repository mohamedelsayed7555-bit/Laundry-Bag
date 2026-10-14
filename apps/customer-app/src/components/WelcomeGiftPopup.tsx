import { useEffect, useState, useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Dimensions } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../lib/supabase'

const { width } = Dimensions.get('window')
const GIFT_DISMISSED_KEY = '@welcome_gift_dismissed'

const giftItems = [
  { emoji: '🧺', ar: 'كيس غسيل قماش بالوجو', en: 'Branded Laundry Bag' },
  { emoji: '🧴', ar: 'عينة معطر ملابس فاخر', en: 'Premium Fabric Softener Sample' },
  { emoji: '🧼', ar: 'عينات مساحيق غسيل', en: 'Detergent Samples Pack' },
  { emoji: '🏷️', ar: 'كوبون خصم 20% على طلبك التاني', en: '20% Off Coupon for 2nd Order' },
]

interface Props {
  userId: string | undefined
  onOrderNow: () => void
}

export default function WelcomeGiftPopup({ userId, onOrderNow }: Props) {
  const { colors } = useTheme()
  const { locale } = useLanguage()
  const isEn = locale === 'en'
  const [visible, setVisible] = useState(false)
  const scaleAnim = useRef(new Animated.Value(0.7)).current
  const opacityAnim = useRef(new Animated.Value(0)).current
  const bounceAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!userId) return
    checkEligibility()
  }, [userId])

  async function checkEligibility() {
    try {
      const dismissed = await AsyncStorage.getItem(GIFT_DISMISSED_KEY)
      if (dismissed) return

      const { data: giftSetting } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'welcome_gift_enabled')
        .single()
      if (giftSetting && String(giftSetting.value) !== 'true') return

      const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', userId!)

      if ((count ?? 0) === 0) {
        setTimeout(() => setVisible(true), 1500)
      }
    } catch {}
  }

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start()

      Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, { toValue: -8, duration: 600, useNativeDriver: true }),
          Animated.timing(bounceAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        ])
      ).start()
    }
  }, [visible])

  async function dismiss() {
    await AsyncStorage.setItem(GIFT_DISMISSED_KEY, 'true')
    setVisible(false)
  }

  async function handleOrderNow() {
    await AsyncStorage.setItem(GIFT_DISMISSED_KEY, 'true')
    await AsyncStorage.setItem('@gift_eligible', 'true')
    setVisible(false)
    onOrderNow()
  }

  if (!visible) return null

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[s.overlay, { opacity: opacityAnim }]}>
        <Animated.View style={[s.card, { backgroundColor: colors.navy[800], borderColor: colors.navy[600], transform: [{ scale: scaleAnim }] }]}>
          {/* Close button */}
          <TouchableOpacity style={s.closeBtn} onPress={dismiss}>
            <Text style={[s.closeText, { color: colors.navy[400] }]}>✕</Text>
          </TouchableOpacity>

          {/* Gift icon with bounce */}
          <Animated.View style={[s.giftIconWrap, { transform: [{ translateY: bounceAnim }] }]}>
            <LinearGradient colors={['#f59e0b', '#ef4444']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.giftCircle}>
              <Text style={s.giftEmoji}>🎁</Text>
            </LinearGradient>
          </Animated.View>

          {/* Sparkles */}
          <Text style={s.sparkles}>✨ ✨ ✨</Text>

          {/* Title */}
          <Text style={[s.title, { color: colors.text }]}>
            {isEn ? 'Welcome Gift!' : 'هدية ترحيبية!'}
          </Text>
          <Text style={[s.subtitle, { color: colors.navy[200] }]}>
            {isEn
              ? 'Get a FREE gift box with your first order'
              : 'احصل على بوكس هدايا مجاناً مع أول طلب'}
          </Text>

          {/* Limited badge */}
          <View style={[s.limitedBadge, { backgroundColor: '#ef444420', borderColor: '#ef444440' }]}>
            <Text style={s.limitedText}>
              {isEn ? '⏰ Limited time offer — First month only!' : '⏰ عرض لفترة محدودة — أول شهر فقط!'}
            </Text>
          </View>

          {/* Gift items */}
          <View style={s.itemsWrap}>
            {giftItems.map((item, i) => (
              <View key={i} style={[s.itemRow, { backgroundColor: colors.navy[700] + '60', borderColor: colors.navy[600] }]}>
                <Text style={s.itemEmoji}>{item.emoji}</Text>
                <Text style={[s.itemText, { color: colors.navy[100] }]}>{isEn ? item.en : item.ar}</Text>
                <Text style={[s.freeTag, { color: '#10b981' }]}>{isEn ? 'FREE' : 'مجاناً'}</Text>
              </View>
            ))}
          </View>

          {/* Gift box image placeholder */}
          <View style={[s.imageWrap, { backgroundColor: colors.navy[700] + '40' }]}>
            <Text style={s.imageEmoji}>🧺🧴🧼🎀</Text>
            <Text style={[s.imageLabel, { color: colors.navy[300] }]}>
              {isEn ? 'Your Gift Box' : 'بوكس هديتك'}
            </Text>
          </View>

          {/* CTA Button */}
          <TouchableOpacity onPress={handleOrderNow} activeOpacity={0.8} style={s.ctaWrap}>
            <LinearGradient colors={[colors.primary, colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.ctaBtn}>
              <Text style={s.ctaText}>
                {isEn ? 'Order Now & Get Your Gift 🎁' : 'اطلب دلوقتي واستلم هديتك 🎁'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={[s.terms, { color: colors.navy[400] }]}>
            {isEn ? 'Gift included with first order only' : 'الهدية مع أول طلب فقط'}
          </Text>
        </Animated.View>
      </Animated.View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  card: {
    width: width - 48, maxWidth: 380, borderRadius: 28, padding: 24,
    alignItems: 'center', borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4, shadowRadius: 24, elevation: 20,
  },
  closeBtn: {
    position: 'absolute', top: 14, right: 14, zIndex: 10,
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  closeText: { fontSize: 18, fontWeight: '700' },
  giftIconWrap: { marginBottom: 8, marginTop: 4 },
  giftCircle: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#f59e0b', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 12,
  },
  giftEmoji: { fontSize: 40 },
  sparkles: { fontSize: 16, letterSpacing: 8, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 12 },
  limitedBadge: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 16,
  },
  limitedText: { fontSize: 12, fontWeight: '700', color: '#ef4444' },
  itemsWrap: { width: '100%', gap: 8, marginBottom: 16 },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1,
  },
  itemEmoji: { fontSize: 22 },
  itemText: { flex: 1, fontSize: 13, fontWeight: '600' },
  freeTag: { fontSize: 11, fontWeight: '800' },
  imageWrap: {
    width: '100%', height: 80, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  imageEmoji: { fontSize: 32, letterSpacing: 6 },
  imageLabel: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  ctaWrap: {
    width: '100%', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#0ea5e9', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 14, elevation: 10,
  },
  ctaBtn: { padding: 16, alignItems: 'center' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  terms: { fontSize: 10, marginTop: 10 },
})
