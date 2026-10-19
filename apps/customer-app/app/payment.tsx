import { useState, useCallback, useEffect } from 'react'
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native'
import { WebView } from 'react-native-webview'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSpring, Easing } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Check, X, MapPin, Crown, ClipboardList, Clock } from 'lucide-react-native'
import { useLanguage } from '../src/contexts/LanguageContext'
import { useBrand, FlowLines, money, F, SIZE } from '../src/components/brand'
import { PrimaryButton, SecondaryButton } from '../src/components/auth/ui'

type PaymentResult = 'pending' | 'success' | 'failed'

// Paymob adds amount_cents to the return URL; shown only when present.
function amountFrom(u: string) {
  const m = /[?&]amount_cents=(\d+)/i.exec(u)
  return m ? Number(m[1]) / 100 : null
}

export default function PaymentScreen() {
  // kind/id tell what was paid: an order (→ its page) or a subscription (→ plans)
  const { url, kind, id } = useLocalSearchParams<{ url: string; kind?: 'order' | 'subscription'; id?: string }>()
  const router = useRouter()
  const b = useBrand()
  const insets = useSafeAreaInsets()
  const { locale } = useLanguage()
  const isEn = locale === 'en'
  const isSub = kind === 'subscription'

  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<PaymentResult>('pending')
  const [amount, setAmount] = useState<number | null>(null)
  const [attempt, setAttempt] = useState(0)

  const handleNavigationChange = useCallback((navState: { url: string }) => {
    const u = navState.url.toLowerCase()
    if (u.includes('success=true')) {
      setAmount(amountFrom(u))
      setResult('success')
    } else if (u.includes('success=false')) {
      setResult('failed')
    }
  }, [])

  const openTarget = () => {
    if (isSub) router.replace('/plans')
    else if (id) router.replace(`/order/${id}`)
    else router.replace('/(tabs)/orders')
  }

  if (result !== 'pending') {
    const ok = result === 'success'
    return (
      <View style={[s.container, { backgroundColor: b.page, paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}>
        <FlowLines height={300} />
        <View style={s.resultWrap}>
          <ResultBadge ok={ok} />
          <Text style={[s.title, { color: b.ink }]}>
            {ok ? (isEn ? 'Payment successful!' : 'تم الدفع بنجاح!') : (isEn ? 'Payment failed' : 'الدفع ما تمّش')}
          </Text>
          <Text style={[s.sub, { color: b.muted }]}>
            {ok
              ? (isSub ? (isEn ? 'Your plan is being activated' : 'جاري تفعيل اشتراكك') : (isEn ? 'Your order is confirmed' : 'طلبك اتأكد'))
              : (isEn ? 'Something went wrong with the payment. Please try again.' : 'حصلت مشكلة في عملية الدفع. جرّب تاني.')}
          </Text>

          {ok && amount != null && (
            <View style={[s.sum, { backgroundColor: b.card, borderColor: b.cardBorder }]}>
              <Text style={[s.sumLabel, { color: b.muted }]}>{isEn ? 'Amount paid' : 'المبلغ'}</Text>
              <Text style={[s.sumValue, { color: b.ink }]}>{money(amount)} {isEn ? 'EGP' : 'ج.م'}</Text>
            </View>
          )}

          {ok && !isSub && (
            <View style={[s.next, { backgroundColor: b.tint }]}>
              <Clock size={16} color={b.tintText} />
              <Text style={[s.nextText, { color: b.tintText }]}>
                {isEn ? "We'll assign the nearest driver and notify you as soon as they're on the way" : 'هنعيّن لك أقرب سواق، وهيوصلك إشعار أول ما يتحرك'}
              </Text>
            </View>
          )}

          <View style={s.actions}>
            {ok ? (
              <PrimaryButton
                title={isSub ? (isEn ? 'View my plan' : 'عرض باقتي') : (isEn ? 'Track your order' : 'تتبع طلبك')}
                leading={isSub ? <Crown size={18} color="#fff" /> : <MapPin size={18} color="#fff" />}
                onPress={openTarget}
              />
            ) : (
              <PrimaryButton
                title={isEn ? 'Try again' : 'حاول تاني'}
                leading={isSub ? <Crown size={18} color="#fff" /> : <ClipboardList size={18} color="#fff" />}
                onPress={openTarget}
              />
            )}
            <SecondaryButton title={isEn ? 'Home' : 'الرئيسية'} onPress={() => router.replace('/(tabs)/home')} />
          </View>
        </View>
      </View>
    )
  }

  return (
    <View style={[s.container, { backgroundColor: b.page }]}>
      {loading && (
        <View style={s.loader}>
          <ActivityIndicator size="large" color={b.primary} />
          <Text style={[s.loadingText, { color: b.muted }]}>{isEn ? 'Loading payment page...' : 'جاري تحميل صفحة الدفع...'}</Text>
        </View>
      )}
      {url && (
        <WebView
          key={attempt}
          source={{ uri: url }}
          style={s.webview}
          onLoadEnd={() => setLoading(false)}
          onNavigationStateChange={handleNavigationChange}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={false}
          scalesPageToFit={true}
          allowsInlineMediaPlayback={true}
          mixedContentMode="compatibility"
          originWhitelist={['*']}
        />
      )}
      <TouchableOpacity style={[s.cancelBar, { backgroundColor: b.card, borderTopColor: b.divider, paddingBottom: insets.bottom + 14 }]} onPress={() => router.back()}>
        <Text style={[s.cancelText, { color: b.dangerText }]}>{isEn ? 'Cancel Payment' : 'إلغاء الدفع'}</Text>
      </TouchableOpacity>
    </View>
  )
}

function ResultBadge({ ok }: { ok: boolean }) {
  const pop = useSharedValue(0.6)
  const ring = useSharedValue(0)
  useEffect(() => {
    pop.value = withSpring(1, { damping: 9, stiffness: 140 })
    ring.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1, false)
  }, [])
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }))
  const ringStyle = useAnimatedStyle(() => ({ opacity: 0.45 * (1 - ring.value), transform: [{ scale: 0.85 + 0.45 * ring.value }] }))
  const c = ok ? '#10B981' : '#EF4444'
  return (
    <View style={s.badgeWrap}>
      <Animated.View style={[s.ring, { borderColor: c }, ringStyle]} />
      <Animated.View style={badgeStyle}>
        <LinearGradient colors={ok ? ['#34D399', '#059669'] : ['#F87171', '#DC2626']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.badge}>
          {ok ? <Check size={46} color="#fff" /> : <X size={46} color="#fff" />}
        </LinearGradient>
      </Animated.View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1 },
  loader: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  loadingText: { marginTop: 12, fontSize: 14, fontFamily: F.medium },
  cancelBar: { paddingTop: 14, alignItems: 'center', borderTopWidth: 1 },
  cancelText: { fontSize: 14, fontFamily: F.bold },

  resultWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  badgeWrap: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  ring: { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 2 },
  badge: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontFamily: F.display, textAlign: 'center' },
  sub: { fontSize: 13.5, fontFamily: F.regular, textAlign: 'center', marginTop: 4, lineHeight: 22 },
  sum: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, height: SIZE.M + 4, marginTop: 18 },
  sumLabel: { fontSize: 12.5, fontFamily: F.medium },
  sumValue: { fontSize: 15, fontFamily: F.display },
  next: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, padding: 12, marginTop: 10 },
  nextText: { flex: 1, fontSize: 12.5, fontFamily: F.bold, lineHeight: 20 },
  actions: { alignSelf: 'stretch', gap: 8, marginTop: 20 },
})
