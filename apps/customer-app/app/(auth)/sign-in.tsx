import { useEffect, useRef, useState } from 'react'
import {
  View, Text, Image, ScrollView, KeyboardAvoidingView, Platform, Pressable, TouchableOpacity, Animated as RNAnimated,
  StyleSheet, Easing,
} from 'react-native'
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg'
import { LinearGradient } from 'expo-linear-gradient'
import { StatusBar } from 'expo-status-bar'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { Fingerprint, KeyRound, Lock, ShieldCheck, Check, User, Phone } from 'lucide-react-native'
import { useAuth } from '../../src/contexts/AuthContext'
import { useLanguage } from '../../src/contexts/LanguageContext'
import { loadLastUser, loadLastLogin, markLastLogin } from '../../src/lib/lastUser'
import {
  F, HeroImage, useAuthTheme, AuthField, PrimaryButton, SecondaryButton, ErrorLine, RoundButton, BackArrow, LangButton, SheetBackdrop,
  GoogleButton, AppleButton, SocialRow, OrDivider,
} from '../../src/components/auth/ui'

function initialsOf(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('')
}

// "today 8:40 PM" / "النهارده 8:40 م", formatted by hand so it doesn't depend on Intl support in Hermes.
function formatLastLogin(at: number, t: (k: string) => string, en: boolean) {
  const d = new Date(at)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const h = d.getHours()
  const time = `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? (en ? 'AM' : 'ص') : (en ? 'PM' : 'م')}`
  if (at >= startOfToday) return `${t('authToday')} ${time}`
  if (at >= startOfToday - 86400000) return `${t('authYesterday')} ${time}`
  return `${d.getDate()}/${d.getMonth() + 1} ${time}`
}

const AVATAR_RING = 100
const RING_R = 47
const RING_C = 2 * Math.PI * RING_R

export default function SignInScreen() {
  const th = useAuthTheme()
  const { t, isRTL, locale } = useLanguage()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { phone = '' } = useLocalSearchParams<{ phone: string }>()
  const { signInWithPassword, signInWithBiometric, signInWithGoogle, googleAvailable, signInWithApple, appleAvailable, biometricEnabled, biometricAvailable, biometricEmail } = useAuth()

  const [knownName, setKnownName] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [lastLoginAt, setLastLoginAt] = useState<number | null>(null)
  const [bioOk, setBioOk] = useState(false)
  const [usePassword, setUsePassword] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [appleBusy, setAppleBusy] = useState(false)
  const shake = useRef(new RNAnimated.Value(0)).current
  const pulse = useRef(new RNAnimated.Value(0)).current
  const pulse2 = useRef(new RNAnimated.Value(0)).current
  const scan = useRef(new RNAnimated.Value(0)).current
  const spin = useRef(new RNAnimated.Value(0)).current

  useEffect(() => {
    let alive = true
    Promise.all([loadLastUser(), biometricEmail(), loadLastLogin(phone)]).then(([last, bioMail, loginAt]) => {
      if (!alive) return
      setLastLoginAt(loginAt)
      const known = last && last.phone === phone ? last : null
      setKnownName(known?.name ?? null)
      setAvatarUrl(known?.avatarUrl ?? null)
      setBioOk(!!(biometricEnabled && known && known.email && bioMail && bioMail.toLowerCase() === known.email.toLowerCase()))
    })
    return () => { alive = false }
  }, [phone, biometricEnabled])

  const bioMode = bioOk && !usePassword

  // The slow ring around the avatar.
  useEffect(() => {
    const loop = RNAnimated.loop(RNAnimated.timing(spin, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true }))
    loop.start()
    return () => loop.stop()
  }, [])

  useEffect(() => {
    if (!bioMode) return
    const rings = RNAnimated.loop(RNAnimated.timing(pulse, { toValue: 1, duration: 2200, useNativeDriver: true }))
    const rings2 = RNAnimated.loop(RNAnimated.sequence([
      RNAnimated.delay(700),
      RNAnimated.timing(pulse2, { toValue: 1, duration: 2200, useNativeDriver: true }),
      RNAnimated.timing(pulse2, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]))
    const scanning = RNAnimated.loop(RNAnimated.sequence([
      RNAnimated.timing(scan, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      RNAnimated.timing(scan, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]))
    rings.start(); rings2.start(); scanning.start()
    return () => { rings.stop(); rings2.stop(); scanning.stop() }
  }, [bioMode])

  function fail(message: string) {
    setError(message)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
    shake.setValue(0)
    RNAnimated.sequence([
      RNAnimated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      RNAnimated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
      RNAnimated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      RNAnimated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start()
  }

  function succeed() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    markLastLogin(phone)
    router.replace('/(tabs)/home')
  }

  async function handlePassword() {
    if (!password) { fail(t('authPasswordRequired')); return }
    setError(null)
    setLoading(true)
    const { error: err } = await signInWithPassword(phone, password)
    setLoading(false)
    if (err) {
      const wrong = err.includes('غلط') || err.toLowerCase().includes('incorrect')
      fail(wrong ? t('authWrongPassword') : err)
      return
    }
    succeed()
  }

  // Google decides for itself whether this is a new or a returning customer, so the
  // same button works here and on sign-up; we only route on what came back.
  async function handleGoogle() {
    setError(null)
    setGoogleBusy(true)
    const { error: err, cancelled, needsProfile } = await signInWithGoogle()
    setGoogleBusy(false)
    if (cancelled) return
    if (err) { fail(err); return }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    if (needsProfile) { router.replace('/(auth)/complete-profile'); return }
    succeed()
  }

  async function handleApple() {
    setError(null)
    setAppleBusy(true)
    const { error: err, cancelled, needsProfile } = await signInWithApple()
    setAppleBusy(false)
    if (cancelled) return
    if (err) { fail(err); return }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    if (needsProfile) { router.replace('/(auth)/complete-profile'); return }
    succeed()
  }

  async function handleBiometric() {
    setError(null)
    setLoading(true)
    const { error: err } = await signInWithBiometric()
    setLoading(false)
    if (err) { fail(err); return }
    succeed()
  }

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.12] })
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] })
  const ring2Scale = pulse2.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.12] })
  const ring2Opacity = pulse2.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] })
  const scanY = scan.interpolate({ inputRange: [0, 1], outputRange: [16, 68] })
  const spinDeg = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
  const shakeX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] })
  const footer = lastLoginAt
    ? `${t('authSecureShort')} · ${t('authLastLogin', { when: formatLastLogin(lastLoginAt, t, locale === 'en') })}`
    : t('authSecure')
  const align = { textAlign: (isRTL ? 'right' : 'left') as 'right' | 'left' }

  return (
    <View style={[s.root, { backgroundColor: th.sheet }]}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false} showsVerticalScrollIndicator={false}>
          <View style={{ height: 250 + insets.top, overflow: 'hidden' }}>
            <HeroImage height={250 + insets.top} />
            <LinearGradient
              colors={['rgba(3,9,22,0.55)', 'rgba(3,9,22,0.12)', 'rgba(3,9,22,0.72)']}
              locations={[0, 0.35, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={[s.topBar, { top: insets.top + 8 }]}>
              <RoundButton glass onPress={() => router.back()} label="Back">
                <BackArrow color="#fff" />
              </RoundButton>
              <LangButton glass />
            </View>
            <View style={s.greet}>
              {knownName ? <Text style={s.greetSmall} maxFontSizeMultiplier={1.3}>{t('authWelcomeBack')}</Text> : null}
              <Text style={s.greetName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1.2}>{knownName ?? t('authWelcomeBack')}</Text>
            </View>
          </View>

          <Animated.View entering={FadeInDown.duration(600)} style={[s.sheet, { backgroundColor: th.sheet, paddingBottom: insets.bottom + 20 }]}>
            <SheetBackdrop />
            <RNAnimated.View pointerEvents="none" style={[s.avatarRing, { transform: [{ rotate: spinDeg }] }]}>
              <Svg width={AVATAR_RING} height={AVATAR_RING}>
                <Defs>
                  <SvgGradient id="avatarRing" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor="#38BDF8" stopOpacity="1" />
                    <Stop offset="1" stopColor={th.primary} stopOpacity="0" />
                  </SvgGradient>
                </Defs>
                <Circle
                  cx={AVATAR_RING / 2}
                  cy={AVATAR_RING / 2}
                  r={RING_R}
                  stroke="url(#avatarRing)"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeDasharray={`${RING_C * 0.62} ${RING_C}`}
                  fill="none"
                />
              </Svg>
            </RNAnimated.View>
            <View style={[s.avatar, { backgroundColor: th.primary, borderColor: th.sheet }]}>
              <LinearGradient colors={['#38BDF8', '#0284C7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.avatarFill} />
              {knownName && avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={s.avatarImg} onError={() => setAvatarUrl(null)} />
              ) : knownName ? <Text style={s.avatarText}>{initialsOf(knownName)}</Text> : <User size={30} color="#fff" />}
              {knownName ? (
                <View style={[s.tick, { borderColor: th.sheet }]}>
                  <Check size={12} color="#fff" />
                </View>
              ) : null}
            </View>

            <View style={s.idRow}>
              <View style={[s.idChip, { backgroundColor: th.isDark ? 'rgba(56,189,248,0.10)' : '#EEF7FE', borderColor: th.isDark ? 'rgba(56,189,248,0.28)' : '#D3EAFB' }]}>
                <Phone size={13} color={th.primary} />
                <Text style={[s.idPhone, { color: th.ink }]}>{`+20 ${phone.slice(1)}`}</Text>
                <TouchableOpacity
                  onPress={() => router.back()}
                  hitSlop={8}
                  accessibilityRole="button"
                  style={[s.notYou, { backgroundColor: th.isDark ? 'rgba(14,165,233,0.2)' : '#DCEFFD' }]}
                >
                  <Text style={[s.notYouText, { color: th.isDark ? th.sky : '#0369A1' }]}>{t('authNotYou')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {bioMode ? (
              <View style={{ alignItems: 'center' }}>
                <Pressable onPress={handleBiometric} disabled={loading} accessibilityRole="button" accessibilityLabel={t('authBioCta')} style={s.bioWrap}>
                  <RNAnimated.View style={[s.bioPulse, { borderColor: th.primary, opacity: ringOpacity, transform: [{ scale: ringScale }] }]} />
                  <RNAnimated.View style={[s.bioRing, { borderColor: th.primary, opacity: ring2Opacity, transform: [{ scale: ring2Scale }] }]} />
                  <View style={[s.bioCore, { backgroundColor: th.primary, shadowColor: th.primary }]}>
                    <View style={s.bioClip}>
                      <LinearGradient colors={['#38BDF8', '#0284C7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                      <Fingerprint size={46} color="#fff" />
                      <RNAnimated.View style={[s.scanLine, { transform: [{ translateY: scanY }] }]} />
                    </View>
                  </View>
                </Pressable>
                <Text style={[s.bioTitle, { color: th.ink }]}>{t('authBioTitle')}</Text>
                <Text style={[s.bioSub, { color: th.muted }]}>{t('authBioSub')}</Text>
                <ErrorLine message={error} />
                <PrimaryButton
                  title={t('authBioCta')}
                  onPress={handleBiometric}
                  loading={loading}
                  leading={<Fingerprint size={18} color="#fff" />}
                  style={{ marginTop: 16, alignSelf: 'stretch' }}
                />
                <SecondaryButton
                  title={t('authUsePassword')}
                  icon={<KeyRound size={16} color={th.ink2} />}
                  onPress={() => { setUsePassword(true); setError(null) }}
                  style={{ marginTop: 10, alignSelf: 'stretch' }}
                />
              </View>
            ) : (
              <View>
                <RNAnimated.View style={{ marginTop: 20, transform: [{ translateX: shakeX }] }}>
                  <AuthField
                    label={t('authPassword')}
                    icon={Lock}
                    secure
                    ltr
                    value={password}
                    onChangeText={v => { setPassword(v); if (error) setError(null) }}
                    placeholder={t('authPasswordPh')}
                    autoCapitalize="none"
                    autoComplete="password"
                    textContentType="password"
                    returnKeyType="go"
                    onSubmitEditing={handlePassword}
                    error={error}
                  />
                </RNAnimated.View>
                {/* A customer whose account was created for him, or who was given a code on
                    WhatsApp, has no password to type — he needs this link, not the password box. */}
                <View style={[s.forgotRow, { justifyContent: 'space-between' }]}>
                  <TouchableOpacity onPress={() => router.push({ pathname: '/(auth)/reset-code', params: { phone } })} hitSlop={8} accessibilityRole="button">
                    <Text style={[s.link, { color: th.ink2 }]}>{t('authHaveCode')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => router.push({ pathname: '/(auth)/forgot', params: { phone } })} hitSlop={8} accessibilityRole="button">
                    <Text style={[s.link, { color: th.primary }]}>{t('authForgot')}</Text>
                  </TouchableOpacity>
                </View>
                <PrimaryButton title={t('authSignIn')} onPress={handlePassword} loading={loading} style={{ marginTop: 14 }} />

                {googleAvailable ? (
                  <>
                    <OrDivider label={t('authOr')} />
                    {appleAvailable ? (
                      <SocialRow>
                        <GoogleButton title={t('authContinueGoogle')} onPress={handleGoogle} loading={googleBusy} disabled={loading || appleBusy} compact />
                        <AppleButton title={t('authContinueApple')} onPress={handleApple} loading={appleBusy} disabled={loading || googleBusy} compact />
                      </SocialRow>
                    ) : (
                      <GoogleButton title={t('authContinueGoogle')} onPress={handleGoogle} loading={googleBusy} disabled={loading} />
                    )}
                  </>
                ) : null}

                {bioOk ? (
                  <SecondaryButton
                    title={t('authBioCta')}
                    icon={<Fingerprint size={16} color={th.ink2} />}
                    onPress={() => { setUsePassword(false); setError(null) }}
                    style={{ marginTop: 10 }}
                  />
                ) : biometricAvailable && !biometricEnabled ? (
                  <View style={[s.tip, { backgroundColor: th.soft }]}>
                    <Fingerprint size={22} color={th.primary} />
                    <Text style={[s.tipText, { color: th.ink2 }, align]}>{t('authBioTip')}</Text>
                  </View>
                ) : null}
              </View>
            )}

            <View style={s.secure}>
              <ShieldCheck size={13} color={th.ok} />
              <Text style={[s.secureText, { color: th.faint }]}>{footer}</Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  topBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  // Clears the sheet overlap (26) + the avatar rising above it (40) + breathing room.
  greet: { position: 'absolute', left: 20, right: 20, bottom: 80, alignItems: 'center' },
  greetSmall: { color: 'rgba(255,255,255,0.82)', fontSize: 13, fontFamily: F.medium },
  greetName: { color: '#fff', fontSize: 26, lineHeight: 36, fontFamily: F.display },
  sheet: { flexGrow: 1, marginTop: -26, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 50 },
  avatar: {
    position: 'absolute', top: -40, alignSelf: 'center', width: 80, height: 80, borderRadius: 40, borderWidth: 5,
    alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#1D4ED8', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 8 },
  },
  avatarText: { color: '#fff', fontSize: 25, fontFamily: F.displaySemi },
  avatarFill: { ...StyleSheet.absoluteFillObject, borderRadius: 35 },
  // Centred on the 80px avatar (top -40), 10px larger on every side.
  avatarRing: { position: 'absolute', top: -50, alignSelf: 'center', width: AVATAR_RING, height: AVATAR_RING },
  // 80 - 2 * 5 border; falls back to initials if the photo can't load.
  avatarImg: { width: 70, height: 70, borderRadius: 35 },
  tick: { position: 'absolute', bottom: -2, start: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: '#16A34A', borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  idRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 4 },
  idChip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 20, borderWidth: 1, paddingVertical: 4, paddingStart: 12, paddingEnd: 5 },
  idPhone: { fontSize: 13, fontFamily: F.semibold, writingDirection: 'ltr' },
  notYou: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 3 },
  notYouText: { fontSize: 12, fontFamily: F.semibold },
  link: { fontSize: 13, fontFamily: F.semibold },
  bioWrap: { width: 140, height: 140, marginTop: 18, alignItems: 'center', justifyContent: 'center' },
  bioPulse: { position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 1.5 },
  bioRing: { position: 'absolute', width: 112, height: 112, borderRadius: 56, borderWidth: 1.5 },
  bioCore: { width: 86, height: 86, borderRadius: 43, elevation: 8, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 10 } },
  bioClip: { flex: 1, borderRadius: 43, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  scanLine: { position: 'absolute', top: 0, left: 14, right: 14, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.85)' },
  bioTitle: { fontSize: 17, fontFamily: F.bold, marginTop: 12 },
  bioSub: { fontSize: 12.5, fontFamily: F.regular, marginTop: 2, textAlign: 'center' },
  textLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, minHeight: 44 },
  forgotRow: { flexDirection: 'row', marginTop: 10 },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, padding: 12, borderRadius: 13 },
  tipText: { flex: 1, fontSize: 12, lineHeight: 19, fontFamily: F.regular },
  secure: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 24 },
  secureText: { fontSize: 11, fontFamily: F.regular },
})
