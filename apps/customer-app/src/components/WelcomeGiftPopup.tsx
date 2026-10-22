import { useEffect, useState, useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Dimensions, Image } from 'react-native'
import { Gift, Timer, X, ShoppingBag, SprayCan, Droplets } from 'lucide-react-native'
import { useBrand, F, SIZE, HIT } from './brand'
import { PrimaryButton } from './auth/ui'
import { LinearGradient } from 'expo-linear-gradient'
import { useLanguage } from '../contexts/LanguageContext'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../lib/supabase'

const { width } = Dimensions.get('window')
// Per account: a phone used for several test accounts (or shared) must still show the popup to each new customer.
const dismissedKey = (userId: string) => `@welcome_gift_dismissed:${userId}`

const giftItems = [
  { icon: (c: string) => <ShoppingBag size={16} color={c} />, ar: 'كيس غسيل قماش بالوجو', en: 'Branded Laundry Bag' },
  { icon: (c: string) => <SprayCan size={16} color={c} />, ar: 'عينة معطر ملابس فاخر', en: 'Premium Fabric Softener Sample' },
  { icon: (c: string) => <Droplets size={16} color={c} />, ar: 'عينات مساحيق غسيل', en: 'Detergent Samples Pack' },
]

interface Props {
  userId: string | undefined
  onOrderNow: () => void
}

export default function WelcomeGiftPopup({ userId, onOrderNow }: Props) {
  const b = useBrand()
  const { locale } = useLanguage()
  const isEn = locale === 'en'
  const [visible, setVisible] = useState(false)
  const [daysLeft, setDaysLeft] = useState<number | null>(null)
  const scaleAnim = useRef(new Animated.Value(0.7)).current
  const opacityAnim = useRef(new Animated.Value(0)).current
  const bounceAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!userId) return
    checkEligibility()
  }, [userId])

  async function checkEligibility() {
    try {
      const dismissed = await AsyncStorage.getItem(dismissedKey(userId!))
      if (dismissed) return

      // Same rules the server uses when it adds the gift to the order (enabled, no orders yet, still valid).
      const { data } = await supabase.rpc('my_welcome_gift')
      if (data?.eligible) {
        setDaysLeft(typeof data.days_left === 'number' ? data.days_left : null)
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
    if (userId) await AsyncStorage.setItem(dismissedKey(userId), 'true')
    setVisible(false)
  }

  async function handleOrderNow() {
    // The server adds the gift to the first order on its own, so nothing else to remember here.
    if (userId) await AsyncStorage.setItem(dismissedKey(userId), 'true')
    setVisible(false)
    onOrderNow()
  }

  if (!visible) return null

  const daysText = daysLeft != null
    ? (isEn ? `Valid for ${daysLeft} more day${daysLeft === 1 ? '' : 's'}` : `الهدية متاحة لمدة ${daysLeft} ${daysLeft >= 3 && daysLeft <= 10 ? 'أيام' : 'يوم'} كمان`)
    : (isEn ? 'Limited time offer' : 'عرض لفترة محدودة')

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={dismiss}>
      <Animated.View style={[s.overlay, { opacity: opacityAnim }]}>
        <Animated.View style={[s.card, { backgroundColor: b.card, borderColor: b.cardBorder, transform: [{ scale: scaleAnim }] }]}>
          {/* Gift photo with confetti */}
          <View style={s.hero}>
            <Image source={require('../../assets/auth/gift.webp')} style={fillImage} resizeMode="cover" />
            <LinearGradient colors={['rgba(0,0,0,0)', b.card]} locations={[0.55, 1]} style={StyleSheet.absoluteFill} />
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { direction: 'ltr' }]}>
              {CONFETTI.map((c, i) => (
                <View key={i} style={{ position: 'absolute', left: c.x, top: c.y, width: c.w, height: c.h, borderRadius: c.h / 2, backgroundColor: c.color, transform: [{ rotate: c.r + 'deg' }] }} />
              ))}
            </View>
            <TouchableOpacity style={s.closeBtn} onPress={dismiss} hitSlop={HIT} accessibilityRole="button" accessibilityLabel={isEn ? 'Close' : 'إغلاق'}>
              <X size={16} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Gold badge */}
          <Animated.View style={[s.badgeWrap, { transform: [{ translateY: bounceAnim }] }]}>
            <LinearGradient colors={['#FCD34D', '#F59E0B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.badge, { borderColor: b.card }]}>
              <Gift size={26} color="#fff" />
            </LinearGradient>
          </Animated.View>

          <View style={s.body}>
            <Text style={[s.title, { color: b.ink }]}>{isEn ? 'Welcome Gift!' : 'هدية ترحيبية!'}</Text>
            <Text style={[s.subtitle, { color: b.muted }]}>
              {isEn ? 'Get a FREE gift box with your first order' : 'احصل على بوكس هدايا مجاناً مع أول طلب'}
            </Text>

            <View style={[s.daysPill, { backgroundColor: b.isDark ? 'rgba(245,158,11,0.14)' : '#FFF4D6' }]}>
              <Timer size={13} color={b.isDark ? '#FBBF24' : '#B45309'} />
              <Text style={[s.daysText, { color: b.isDark ? '#FBBF24' : '#B45309' }]}>{daysText}</Text>
            </View>

            <View style={[s.items, { borderColor: b.cardBorder }]}>
              {giftItems.map((item, i) => (
                <View key={i} style={[s.itemRow, i > 0 && { borderTopWidth: 1, borderTopColor: b.divider }]}>
                  <View style={[s.itemIcon, { backgroundColor: b.iconTile }]}>{item.icon(b.accentIcon)}</View>
                  <Text style={[s.itemText, { color: b.ink }]} numberOfLines={1}>{isEn ? item.en : item.ar}</Text>
                  <Text style={[s.freeTag, { color: b.okText }]}>{isEn ? 'FREE' : 'مجاناً'}</Text>
                </View>
              ))}
            </View>

            <PrimaryButton
              title={isEn ? 'Order Now & Get Your Gift' : 'اطلب دلوقتي واستلم هديتك'}
              onPress={handleOrderNow}
              style={{ alignSelf: 'stretch' }}
            />

            <Text style={[s.terms, { color: b.faint }]}>{isEn ? 'Gift included with first order only' : 'الهدية مع أول طلب فقط'}</Text>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  )
}

const CONFETTI = [
  { x: 18, y: 16, w: 8, h: 4, r: 30, color: '#FCD34D' },
  { x: 60, y: 44, w: 6, h: 6, r: 0, color: '#38BDF8' },
  { x: 108, y: 12, w: 9, h: 4, r: -25, color: '#F472B6' },
  { x: 150, y: 52, w: 7, h: 3, r: 50, color: '#4ADE80' },
  { x: 196, y: 20, w: 6, h: 6, r: 0, color: '#FCD34D' },
  { x: 236, y: 58, w: 9, h: 4, r: -40, color: '#818CF8' },
  { x: 270, y: 14, w: 7, h: 3, r: 20, color: '#38BDF8' },
  { x: 36, y: 86, w: 6, h: 3, r: -15, color: '#F472B6' },
  { x: 250, y: 96, w: 6, h: 6, r: 0, color: '#FCD34D' },
]

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(2,6,14,0.72)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: {
    width: width - 48, maxWidth: 360, borderRadius: 26, borderWidth: 1, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.4, shadowRadius: 24, elevation: 20,
  },
  hero: { height: 150, overflow: 'hidden' },
  closeBtn: { position: 'absolute', top: 12, end: 12, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  badgeWrap: { alignSelf: 'center', marginTop: -30 },
  badge: {
    width: 60, height: 60, borderRadius: 30, borderWidth: 4, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  body: { paddingHorizontal: 18, paddingBottom: 16, paddingTop: 8, alignItems: 'center' },
  title: { fontSize: 21, fontFamily: F.display, textAlign: 'center' },
  subtitle: { fontSize: 13, fontFamily: F.regular, textAlign: 'center', lineHeight: 20, marginTop: 2 },
  daysPill: { flexDirection: 'row', alignItems: 'center', gap: 5, height: SIZE.S - 4, paddingHorizontal: 12, borderRadius: 13, marginTop: 10 },
  daysText: { fontSize: 12, fontFamily: F.bold },
  items: { alignSelf: 'stretch', borderWidth: 1, borderRadius: 16, marginTop: 14, marginBottom: 14 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: SIZE.M + 4, paddingHorizontal: 10 },
  itemIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  itemText: { flex: 1, fontSize: 13, fontFamily: F.semibold },
  freeTag: { fontSize: 11.5, fontFamily: F.bold },
  terms: { fontSize: 11, fontFamily: F.regular, marginTop: 10 },
})

// See home.tsx: an Image sized only by insets renders at its own pixel size.
const fillImage = { position: 'absolute' as const, top: 0, left: 0, width: '100%' as const, height: '100%' as const }
