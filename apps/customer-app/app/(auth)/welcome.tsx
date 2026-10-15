import { useEffect, useState } from 'react'
import {
  View, Text, Image, ScrollView, KeyboardAvoidingView, Platform, Keyboard, LayoutAnimation, UIManager,
  StyleSheet, useWindowDimensions,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { StatusBar } from 'expo-status-bar'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { Truck, WashingMachine, House } from 'lucide-react-native'
import { useLanguage } from '../../src/contexts/LanguageContext'
import { supabase } from '../../src/lib/supabase'
import { openLegalPage } from '../../src/lib/legal'
import { F, HERO, LOGO, PHONE_RE, useAuthTheme, PhoneField, PrimaryButton, ForwardArrow, LangButton } from '../../src/components/auth/ui'

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true)
}

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

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const a = Keyboard.addListener(showEvt, () => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setKeyboardOpen(true) })
    const b = Keyboard.addListener(hideEvt, () => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setKeyboardOpen(false) })
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
          <View style={{ height: heroHeight }}>
            <Image source={HERO} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
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
            style={[s.sheet, { backgroundColor: th.sheet, paddingTop: keyboardOpen ? 22 : 54, paddingBottom: insets.bottom + 20 }]}
          >
            {!keyboardOpen && (
              <View style={[s.logoBadge, { borderColor: th.sheet }]}>
                <View style={s.logoClip}>
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
              <View style={s.steps}>
                <View style={[s.stepsLine, { borderColor: th.isDark ? '#2C3D5C' : '#C9D7EA' }]} />
                {steps.map(({ img, Icon, label }, i) => (
                  <Animated.View key={label} entering={FadeInDown.duration(450).delay(300 + i * 100)} style={s.step}>
                    <View style={[s.stepRing, { borderColor: th.isDark ? '#2A3B5A' : '#D5E3F8', backgroundColor: th.sheet }]}>
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

            <Text style={[s.label, { color: th.ink2, textAlign: isRTL ? 'right' : 'left' }]}>{t('authPhoneLabel')}</Text>
            <PhoneField
              value={phone}
              onChangeText={v => { setPhone(v); if (error) setError(null) }}
              error={error}
              onSubmitEditing={handleContinue}
            />

            <PrimaryButton
              title={t('authContinue')}
              loadingTitle={t('authOneMoment')}
              onPress={handleContinue}
              loading={loading}
              disabled={phone.length !== 11}
              trailing={<ForwardArrow />}
              style={{ marginTop: 12 }}
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
  // Clears the sheet overlap (26) + the logo badge rising above it (42) + breathing room.
  headline: { position: 'absolute', left: 22, right: 22, bottom: 84 },
  h1: { color: '#fff', fontSize: 28, lineHeight: 38, fontFamily: F.display },
  sub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4, fontFamily: F.regular },
  sheet: { flexGrow: 1, marginTop: -26, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20 },
  logoBadge: {
    position: 'absolute', top: -42, alignSelf: 'center', width: 84, height: 84, borderRadius: 24, backgroundColor: '#fff',
    padding: 3, borderWidth: 4, elevation: 8, shadowColor: '#0A1E46', shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 8 },
  },
  logoClip: { flex: 1, borderRadius: 18, overflow: 'hidden', backgroundColor: '#F1F3F6' },
  logoImg: { width: '100%', height: '100%', transform: [{ scale: 1.2 }] },
  steps: { flexDirection: 'row' },
  stepsLine: { position: 'absolute', top: 26, left: '17%', right: '17%', borderTopWidth: 1.5, borderStyle: 'dashed' },
  step: { flex: 1, alignItems: 'center', gap: 7, paddingHorizontal: 2 },
  stepRing: { width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, padding: 2 },
  stepImg: { width: '100%', height: '100%', borderRadius: 24 },
  stepBadge: { position: 'absolute', bottom: -4, start: -4, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5 },
  stepLabel: { fontSize: 11.5, lineHeight: 16, fontFamily: F.semibold, textAlign: 'center' },
  kbTitle: { fontSize: 20, fontFamily: F.display },
  kbSub: { fontSize: 12.5, marginTop: 2, fontFamily: F.regular },
  label: { fontSize: 12.5, fontFamily: F.semibold, marginTop: 14, marginBottom: 7, marginHorizontal: 2 },
  legal: { fontSize: 11, lineHeight: 18, textAlign: 'center', marginTop: 12, fontFamily: F.regular },
  legalLink: { fontFamily: F.semibold, textDecorationLine: 'underline' },
})
