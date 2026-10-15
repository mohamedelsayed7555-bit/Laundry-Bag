import { useEffect, useRef, useState } from 'react'
import {
  View, Text, Image, ScrollView, KeyboardAvoidingView, Platform, Pressable, TouchableOpacity, Animated as RNAnimated,
  StyleSheet,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { StatusBar } from 'expo-status-bar'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { Fingerprint, KeyRound, Lock, ShieldCheck, Check, User } from 'lucide-react-native'
import { useAuth } from '../../src/contexts/AuthContext'
import { useLanguage } from '../../src/contexts/LanguageContext'
import { loadLastUser } from '../../src/lib/lastUser'
import { F, HERO, useAuthTheme, AuthField, PrimaryButton, ErrorLine, RoundButton, BackArrow, LangButton } from '../../src/components/auth/ui'

function initialsOf(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('')
}

export default function SignInScreen() {
  const th = useAuthTheme()
  const { t, isRTL } = useLanguage()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { phone = '' } = useLocalSearchParams<{ phone: string }>()
  const { signInWithPassword, signInWithBiometric, biometricEnabled, biometricAvailable, biometricEmail } = useAuth()

  const [knownName, setKnownName] = useState<string | null>(null)
  const [bioOk, setBioOk] = useState(false)
  const [usePassword, setUsePassword] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const shake = useRef(new RNAnimated.Value(0)).current
  const pulse = useRef(new RNAnimated.Value(0)).current

  useEffect(() => {
    let alive = true
    Promise.all([loadLastUser(), biometricEmail()]).then(([last, bioMail]) => {
      if (!alive) return
      const known = last && last.phone === phone ? last : null
      setKnownName(known?.name ?? null)
      setBioOk(!!(biometricEnabled && known && known.email && bioMail && bioMail.toLowerCase() === known.email.toLowerCase()))
    })
    return () => { alive = false }
  }, [phone, biometricEnabled])

  const bioMode = bioOk && !usePassword

  useEffect(() => {
    if (!bioMode) return
    const loop = RNAnimated.loop(RNAnimated.timing(pulse, { toValue: 1, duration: 2000, useNativeDriver: true }))
    loop.start()
    return () => loop.stop()
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
  const shakeX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] })
  const align = { textAlign: (isRTL ? 'right' : 'left') as 'right' | 'left' }

  return (
    <View style={[s.root, { backgroundColor: th.sheet }]}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false} showsVerticalScrollIndicator={false}>
          <View style={{ height: 250 + insets.top }}>
            <Image source={HERO} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
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
            <View style={[s.avatar, { backgroundColor: th.primary, borderColor: th.sheet }]}>
              {knownName ? <Text style={s.avatarText}>{initialsOf(knownName)}</Text> : <User size={30} color="#fff" />}
              {knownName ? (
                <View style={[s.tick, { borderColor: th.sheet }]}>
                  <Check size={12} color="#fff" />
                </View>
              ) : null}
            </View>

            <View style={s.idRow}>
              <Text style={[s.idPhone, { color: th.ink2 }]}>{`+20 ${phone.slice(1)}`}</Text>
              <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityRole="button">
                <Text style={[s.link, { color: th.primary }]}>{t('authNotYou')}</Text>
              </TouchableOpacity>
            </View>

            {bioMode ? (
              <View style={{ alignItems: 'center' }}>
                <Pressable onPress={handleBiometric} disabled={loading} accessibilityRole="button" accessibilityLabel={t('authBioCta')} style={s.bioWrap}>
                  <RNAnimated.View style={[s.bioPulse, { borderColor: th.primary, opacity: ringOpacity, transform: [{ scale: ringScale }] }]} />
                  <View style={[s.bioRing, { borderColor: th.ring }]} />
                  <View style={[s.bioCore, { backgroundColor: th.primary, shadowColor: th.primary }]}>
                    <Fingerprint size={46} color="#fff" />
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
                <TouchableOpacity onPress={() => { setUsePassword(true); setError(null) }} style={s.textLink} accessibilityRole="button">
                  <KeyRound size={16} color={th.primary} />
                  <Text style={[s.link, { color: th.primary }]}>{t('authUsePassword')}</Text>
                </TouchableOpacity>
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
                <View style={[s.forgotRow, { justifyContent: 'flex-end' }]}>
                  <TouchableOpacity onPress={() => router.push({ pathname: '/(auth)/forgot', params: { phone } })} hitSlop={8} accessibilityRole="button">
                    <Text style={[s.link, { color: th.primary }]}>{t('authForgot')}</Text>
                  </TouchableOpacity>
                </View>
                <PrimaryButton title={t('authSignIn')} onPress={handlePassword} loading={loading} style={{ marginTop: 14 }} />

                {bioOk ? (
                  <TouchableOpacity onPress={() => { setUsePassword(false); setError(null) }} style={s.textLink} accessibilityRole="button">
                    <Fingerprint size={16} color={th.primary} />
                    <Text style={[s.link, { color: th.primary }]}>{t('authBioCta')}</Text>
                  </TouchableOpacity>
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
              <Text style={[s.secureText, { color: th.faint }]}>{t('authSecure')}</Text>
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
  tick: { position: 'absolute', bottom: -2, start: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: '#16A34A', borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  idRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  idPhone: { fontSize: 13, fontFamily: F.medium, writingDirection: 'ltr' },
  link: { fontSize: 13, fontFamily: F.semibold },
  bioWrap: { width: 140, height: 140, marginTop: 18, alignItems: 'center', justifyContent: 'center' },
  bioPulse: { position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 1.5 },
  bioRing: { position: 'absolute', width: 112, height: 112, borderRadius: 56, borderWidth: 1.5 },
  bioCore: { width: 86, height: 86, borderRadius: 43, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
  bioTitle: { fontSize: 17, fontFamily: F.bold, marginTop: 12 },
  bioSub: { fontSize: 12.5, fontFamily: F.regular, marginTop: 2, textAlign: 'center' },
  textLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, minHeight: 44 },
  forgotRow: { flexDirection: 'row', marginTop: 10 },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, padding: 12, borderRadius: 13 },
  tipText: { flex: 1, fontSize: 12, lineHeight: 19, fontFamily: F.regular },
  secure: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 24 },
  secureText: { fontSize: 11, fontFamily: F.regular },
})
