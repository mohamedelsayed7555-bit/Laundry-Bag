import { useEffect, useRef, useState } from 'react'
import {
  View, Text, Image, ScrollView, KeyboardAvoidingView, Platform, Keyboard, StyleSheet, useWindowDimensions,
  TouchableOpacity, Linking, Animated as RNAnimated, Easing, AccessibilityInfo,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { StatusBar } from 'expo-status-bar'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { Truck, WashingMachine, House, ShieldCheck, MessageCircle, Sparkles } from 'lucide-react-native'
import { useLanguage } from '../../src/contexts/LanguageContext'
import { supabase } from '../../src/lib/supabase'
import { openLegalPage } from '../../src/lib/legal'
import { F, HeroImage, LOGO, PHONE_RE, useAuthTheme, PhoneField, PrimaryButton, ForwardArrow, LangButton, SheetBackdrop, tapHaptic } from '../../src/components/auth/ui'

const SUPPORT_WHATSAPP_INTL = '201002438847'

const STEP_IMAGES = {
  pickup: require('../../assets/auth/step-pickup.webp'),
  wash: require('../../assets/auth/step-wash.webp'),
  ret: require('../../assets/auth/step-return.webp'),
}

export default function WelcomeScreen() {
  const th = useAuthTheme()
  const { t, locale, isRTL } = useLanguage()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const [stepsW, setStepsW] = useState(0)
  const travel = useRef(new RNAnimated.Value(0)).current

  // A small dot that walks along the dashed line between the three steps.
  useEffect(() => {
    if (!stepsW || keyboardOpen) return
    let loop: RNAnimated.CompositeAnimation | undefined
    let cancelled = false
    AccessibilityInfo.isReduceMotionEnabled().then(reduce => {
      if (reduce || cancelled) return
      loop = RNAnimated.loop(RNAnimated.sequence([
        RNAnimated.timing(travel, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        RNAnimated.timing(travel, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]))
      loop.start()
    }).catch(() => {})
    return () => { cancelled = true; loop?.stop() }
  }, [stepsW, keyboardOpen])

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    // No LayoutAnimation here: on Android (old architecture) it can leave the unmounted steps row
    // drawn on screen, overlapping the keyboard title.
    const a = Keyboard.addListener(showEvt, () => setKeyboardOpen(true))
    const b = Keyboard.addListener(hideEvt, () => setKeyboardOpen(false))
    return () => { a.remove(); b.remove() }
  }, [])

  async function handleContinue() {
    const value = phone.trim()
    if (!PHONE_RE.test(value)) {
      setError(t('authPhoneInvalid'))
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
      return
    }
    setError(null)
    setLoading(true)
    const { data, error: rpcError } = await supabase.rpc('is_phone_registered', { p_phone: value })
    setLoading(false)
    if (rpcError) {
      setError(t('authNetworkError'))
      return
    }
    Keyboard.dismiss()
    router.push({ pathname: data ? '/(auth)/sign-in' : '/(auth)/sign-up', params: { phone: value } })
  }

  const heroHeight = keyboardOpen ? 150 + insets.top : Math.max(300, Math.round(height * 0.5))
  // The dashed line runs from 17% to 83% of the row, so the dot travels ±33% around the centre.
  const dotX = travel.interpolate({ inputRange: [0, 1], outputRange: [-stepsW * 0.33, stepsW * 0.33] })

  function openWhatsapp() {
    tapHaptic()
    Linking.openURL(`https://wa.me/${SUPPORT_WHATSAPP_INTL}`).catch(() => {})
  }
  const steps = [
    { img: STEP_IMAGES.pickup, Icon: Truck, label: t('authStepPickup') },
    { img: STEP_IMAGES.wash, Icon: WashingMachine, label: t('authStepWash') },
    { img: STEP_IMAGES.ret, Icon: House, label: t('authStepReturn') },
  ]

  return (
    <View style={[s.root, { backgroundColor: th.sheet }]}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false} showsVerticalScrollIndicator={false}>
          <View style={{ height: heroHeight, overflow: 'hidden' }}>
            <HeroImage height={heroHeight} />
            <LinearGradient
              colors={['rgba(3,9,22,0.55)', 'rgba(3,9,22,0)', 'rgba(3,9,22,0)', 'rgba(3,9,22,0.78)']}
              locations={[0, 0.28, 0.45, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={[s.topBar, { top: insets.top + 8 }]}>
              <View />
              <LangButton glass />
            </View>
            {!keyboardOpen && (
              <Animated.View entering={FadeInUp.duration(600).delay(150)} style={s.headline}>
                <Text style={[s.h1, { textAlign: isRTL ? 'right' : 'left' }]} maxFontSizeMultiplier={1.2}>
                  {t('authHeadline1')}{'\n'}{t('authHeadline2')} <Text style={{ color: th.sky }}>{t('authHeadlineAccent')}</Text>
                </Text>
                <Text style={[s.sub, { textAlign: isRTL ? 'right' : 'left' }]} maxFontSizeMultiplier={1.3}>{t('authSub')}</Text>
              </Animated.View>
            )}
          </View>

          <Animated.View
            entering={FadeInDown.duration(600)}
            style={[s.sheet, { backgroundColor: th.sheet, paddingTop: keyboardOpen ? 22 : 60, paddingBottom: insets.bottom + 20 }]}
          >
            <SheetBackdrop />
            {!keyboardOpen && (
              <View style={[s.logoGlow, { backgroundColor: th.ring }]}>
                <View style={[s.logoBadge, { backgroundColor: th.isDark ? th.sheet : '#fff', borderColor: th.isDark ? 'rgba(56,189,248,0.45)' : '#CFE8FA', shadowColor: th.primary }]}>
                  <Image source={LOGO} style={s.logoImg} resizeMode="cover" accessibilityLabel="Laundry Bag" />
                </View>
              </View>
            )}

            {keyboardOpen ? (
              <View style={{ marginBottom: 4 }}>
                <Text style={[s.kbTitle, { color: th.ink, textAlign: isRTL ? 'right' : 'left' }]}>{t('authKbTitle')}</Text>
                <Text style={[s.kbSub, { color: th.muted, textAlign: isRTL ? 'right' : 'left' }]}>{t('authKbSub')}</Text>
              </View>
            ) : (
              <View style={s.steps} onLayout={e => setStepsW(e.nativeEvent.layout.width)}>
                <View style={[s.stepsLine, { borderColor: th.isDark ? '#2C3D5C' : '#C9D7EA' }]} />
                {stepsW ? (
                  <RNAnimated.View
                    pointerEvents="none"
                    style={[s.stepsDot, { backgroundColor: th.primary, borderColor: th.ring, transform: [{ translateX: dotX }] }]}
                  />
                ) : null}
                {steps.map(({ img, Icon, label }, i) => (
                  <Animated.View key={label} entering={FadeInDown.duration(450).delay(300 + i * 100)} style={s.step}>
                    <View style={[s.stepRing, { borderColor: th.isDark ? '#2A3B5A' : '#BFDDF7', backgroundColor: th.sheet }]}>
                      <Image source={img} style={s.stepImg} />
                      <View style={[s.stepBadge, { backgroundColor: th.primary, borderColor: th.sheet }]}>
                        <Icon size={12} color="#fff" />
                      </View>
                    </View>
                    <Text style={[s.stepLabel, { color: th.ink2 }]} numberOfLines={2} maxFontSizeMultiplier={1.3}>{label}</Text>
                  </Animated.View>
                ))}
              </View>
            )}

            {!keyboardOpen && (
              <View style={s.trust}>
                <TouchableOpacity
                  onPress={() => openLegalPage('terms', locale)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  style={[s.chip, { backgroundColor: th.isDark ? 'rgba(56,189,248,0.10)' : '#EEF7FE', borderColor: th.isDark ? 'rgba(56,189,248,0.28)' : '#D3EAFB' }]}
                >
                  <ShieldCheck size={13} color={th.primary} />
                  <Text style={[s.chipText, { color: th.isDark ? '#9FD3FA' : '#1D5F95' }]} maxFontSizeMultiplier={1.2}>{t('authTrustComp')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={openWhatsapp}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  style={[s.chip, { backgroundColor: th.isDark ? 'rgba(56,189,248,0.10)' : '#EEF7FE', borderColor: th.isDark ? 'rgba(56,189,248,0.28)' : '#D3EAFB' }]}
                >
                  <MessageCircle size={13} color={th.ok} />
                  <Text style={[s.chipText, { color: th.isDark ? '#9FD3FA' : '#1D5F95' }]} maxFontSizeMultiplier={1.2}>{t('authTrustWa')}</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={[s.label, { color: th.ink2, textAlign: isRTL ? 'right' : 'left' }]}>{t('authPhoneLabel')}</Text>
            <PhoneField
              value={phone}
              onChangeText={v => { setPhone(v); if (error) setError(null) }}
              error={error}
              onSubmitEditing={handleContinue}
            />
            {!error ? (
              <View style={s.hint}>
                <Sparkles size={13} color="#E0A020" />
                <Text style={[s.hintText, { color: th.muted }]} maxFontSizeMultiplier={1.3}>{t('authFirstTime')}</Text>
              </View>
            ) : null}

            <PrimaryButton
              title={t('authContinue')}
              loadingTitle={t('authOneMoment')}
              onPress={handleContinue}
              loading={loading}
              disabled={phone.length !== 11}
              trailing={<ForwardArrow />}
              style={{ marginTop: 10 }}
            />

            <Text style={[s.legal, { color: th.faint }]}>
              {t('authContinueAgree')}{' '}
              <Text style={[s.legalLink, { color: th.ink2 }]} onPress={() => openLegalPage('terms', locale)}>{t('legalTerms')}</Text>
              {t('legalAnd')}
              <Text style={[s.legalLink, { color: th.ink2 }]} onPress={() => openLegalPage('privacy', locale)}>{t('legalPrivacy')}</Text>
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  topBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  // Clears the sheet overlap (26) + the logo badge rising above it (48) + breathing room.
  headline: { position: 'absolute', left: 22, right: 22, bottom: 90 },
  h1: { color: '#fff', fontSize: 28, lineHeight: 38, fontFamily: F.display },
  sub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4, fontFamily: F.regular },
  sheet: { flexGrow: 1, marginTop: -26, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20 },
  // A soft brand-coloured ring (the 6px padding) around the logo tile.
  logoGlow: { position: 'absolute', top: -48, alignSelf: 'center', width: 96, height: 96, borderRadius: 30, padding: 6 },
  logoBadge: {
    flex: 1, borderRadius: 24, padding: 3, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
    elevation: 10, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 10 },
  },
  // Fixed size (84 - 2*1.5 border - 2*3 padding): percentage sizes + scale inside a clipped view rendered blank on Android.
  logoImg: { width: 75, height: 75, borderRadius: 20, backgroundColor: '#F1F3F6' },
  steps: { flexDirection: 'row' },
  stepsLine: { position: 'absolute', top: 26, left: '17%', right: '17%', borderTopWidth: 1.5, borderStyle: 'dashed' },
  // Centred on the line and drawn under the step photos, so it shows only between them. Symmetric, so RTL doesn't matter.
  stepsDot: { position: 'absolute', top: 21, left: '50%', marginLeft: -5.5, width: 11, height: 11, borderRadius: 6, borderWidth: 3 },
  trust: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 26, paddingHorizontal: 10, borderRadius: 13, borderWidth: 1 },
  chipText: { fontSize: 11, fontFamily: F.semibold },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, marginHorizontal: 3 },
  hintText: { flex: 1, fontSize: 11.5, fontFamily: F.regular },
  step: { flex: 1, alignItems: 'center', gap: 7, paddingHorizontal: 2 },
  stepRing: { width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, padding: 2 },
  stepImg: { width: '100%', height: '100%', borderRadius: 24 },
  stepBadge: { position: 'absolute', bottom: -4, start: -4, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5 },
  stepLabel: { fontSize: 11.5, lineHeight: 16, fontFamily: F.semibold, textAlign: 'center' },
  kbTitle: { fontSize: 20, fontFamily: F.display },
  kbSub: { fontSize: 12.5, marginTop: 2, fontFamily: F.regular },
  label: { fontSize: 12.5, fontFamily: F.semibold, marginTop: 12, marginBottom: 7, marginHorizontal: 2 },
  legal: { fontSize: 11, lineHeight: 18, textAlign: 'center', marginTop: 12, fontFamily: F.regular },
  legalLink: { fontFamily: F.semibold, textDecorationLine: 'underline' },
})
