import { useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, Image, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, StyleSheet, type TextInput,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { User, Mail, Lock, CircleCheck, Circle, Check, Sparkles } from 'lucide-react-native'
import { useAuth } from '../../src/contexts/AuthContext'
import { useLanguage } from '../../src/contexts/LanguageContext'
import { supabase } from '../../src/lib/supabase'
import { openLegalPage } from '../../src/lib/legal'
import { suggestEmail } from '../../src/lib/emailTypo'
import { F, useAuthTheme, AuthField, PrimaryButton, ErrorLine, RoundButton, BackArrow, TintBackground, ForwardArrow, GoogleButton, AppleButton, SocialRow, OrDivider } from '../../src/components/auth/ui'

const GIFT_IMAGE = require('../../assets/auth/gift.webp')
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function SignUpScreen() {
  const th = useAuthTheme()
  const { t, locale, isRTL } = useLanguage()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { phone = '' } = useLocalSearchParams<{ phone: string }>()
  const { signUp, signInWithGoogle, googleAvailable, signInWithApple, appleAvailable } = useAuth()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; agree?: string; server?: string }>({})
  const [loading, setLoading] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [appleBusy, setAppleBusy] = useState(false)
  const [giftEnabled, setGiftEnabled] = useState(false)
  // A mistyped domain is silent until the day he needs to recover the account.
  const emailSuggestion = useMemo(() => suggestEmail(email), [email])
  const emailRef = useRef<TextInput>(null)
  const passwordRef = useRef<TextInput>(null)

  useEffect(() => {
    supabase.from('settings').select('value').eq('key', 'welcome_gift_enabled').maybeSingle()
      .then(({ data }) => setGiftEnabled(!data || String(data.value) === 'true'))
  }, [])

  const rules = useMemo(() => [
    { key: 'len', ok: password.length >= 8, label: t('authRuleLength') },
    { key: 'case', ok: /[a-z]/.test(password) && /[A-Z]/.test(password), label: t('authRuleCase') },
    { key: 'digit', ok: /[0-9]/.test(password), label: t('authRuleDigit') },
    { key: 'symbol', ok: /[^A-Za-z0-9]/.test(password), label: t('authRuleSymbol') },
  ], [password, t])
  const passed = rules.filter(r => r.ok).length
  const meterColor = passed <= 1 ? th.danger : passed < 4 ? '#F59E0B' : th.ok

  async function handleGoogle() {
    setGoogleBusy(true)
    const { error, cancelled, needsProfile } = await signInWithGoogle()
    setGoogleBusy(false)
    if (cancelled) return
    if (error) {
      setErrors({ server: error })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
      return
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    router.replace(needsProfile ? '/(auth)/complete-profile' : '/(tabs)/home')
  }

  async function handleApple() {
    setAppleBusy(true)
    const { error, cancelled, needsProfile } = await signInWithApple()
    setAppleBusy(false)
    if (cancelled) return
    if (error) {
      setErrors({ server: error })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
      return
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    router.replace(needsProfile ? '/(auth)/complete-profile' : '/(tabs)/home')
  }

  async function handleCreate() {
    const next: typeof errors = {}
    if (name.trim().length < 2) next.name = t('authNameRequired')
    // Required: a password account with no inbox can only be reset by us, and the
    // whole point is that the customer never has to depend on that.
    if (!email.trim()) next.email = t('authEmailRequired')
    else if (!EMAIL_RE.test(email.trim())) next.email = t('authEmailInvalid')
    if (passed < rules.length) next.password = t('authPasswordWeak')
    if (!agreed) next.agree = t('authAgreeRequired')
    setErrors(next)
    if (Object.keys(next).length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
      return
    }
    setLoading(true)
    const { error } = await signUp(email.trim(), password, name.trim(), phone)
    setLoading(false)
    if (error) {
      setErrors({ server: error })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
      return
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    // Send new customers through a one-time location step to set their first delivery
    // address (skippable). It finishes on the home screen, so the welcome-gift popup
    // there never overlaps with it.
    router.replace({ pathname: '/addresses', params: { onboarding: '1' } })
  }

  const align = { textAlign: (isRTL ? 'right' : 'left') as 'right' | 'left' }

  return (
    <View style={[s.root, { backgroundColor: th.bg }]}>
      <StatusBar style={th.isDark ? 'light' : 'dark'} />
      <TintBackground />
      <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 20 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.nav}>
            <RoundButton onPress={() => router.back()} label="Back">
              <BackArrow color={th.ink} />
            </RoundButton>
            <View style={s.steps}>
              <View style={[s.stepBar, { backgroundColor: th.primary }]} />
              <View style={[s.stepBar, { backgroundColor: th.primary }]} />
            </View>
          </View>

          <Animated.View entering={FadeInDown.duration(500)}>
            <Text style={[s.h, { color: th.ink }, align]}>{t('authSignupTitle')}</Text>
            <Text style={[s.p, { color: th.muted }, align]}>{t('authSignupSub')}</Text>

            <View style={[s.verified, { backgroundColor: th.okBg, borderColor: th.isDark ? 'rgba(34,197,94,0.3)' : '#C3EED3' }]}>
              <CircleCheck size={14} color={th.ok} />
              <Text style={[s.verifiedText, { color: th.isDark ? '#86EFAC' : '#166534' }]}>{`+20 ${phone.slice(1)}`}</Text>
              <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityRole="button">
                <Text style={[s.link, { color: th.primary }]}>{t('authEdit')}</Text>
              </TouchableOpacity>
            </View>

            {googleAvailable ? (
              <>
                {appleAvailable ? (
                  <SocialRow>
                    <GoogleButton title={t('authContinueGoogle')} onPress={handleGoogle} loading={googleBusy} disabled={loading || appleBusy} compact style={{ marginTop: 16 }} />
                    <AppleButton title={t('authContinueApple')} onPress={handleApple} loading={appleBusy} disabled={loading || googleBusy} compact style={{ marginTop: 16 }} />
                  </SocialRow>
                ) : (
                  <GoogleButton title={t('authContinueGoogle')} onPress={handleGoogle} loading={googleBusy} disabled={loading} style={{ marginTop: 16 }} />
                )}
                <OrDivider label={t('authOr')} />
              </>
            ) : null}

            <View style={{ gap: 10, marginTop: googleAvailable ? 0 : 14 }}>
              <AuthField
                label={t('authFullName')}
                icon={User}
                value={name}
                onChangeText={v => { setName(v); if (errors.name) setErrors(e => ({ ...e, name: undefined })) }}
                placeholder={t('authFullNamePh')}
                autoComplete="name"
                textContentType="name"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                valid={name.trim().length >= 2}
                error={errors.name}
              />
              <AuthField
                ref={emailRef}
                label={t('authEmailLabel')}
                hint={t('authEmailWhy')}
                icon={Mail}
                ltr
                value={email}
                onChangeText={v => { setEmail(v); if (errors.email || errors.server) setErrors(e => ({ ...e, email: undefined, server: undefined })) }}
                placeholder="name@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                valid={!!email.trim() && EMAIL_RE.test(email.trim())}
                error={errors.email}
              />
              {emailSuggestion && !errors.email ? (
                <TouchableOpacity
                  onPress={() => setEmail(emailSuggestion)}
                  accessibilityRole="button"
                  hitSlop={6}
                  style={{ marginTop: -4, paddingHorizontal: 2 }}
                >
                  <Text style={[s.typo, { color: th.primary }, align]} maxFontSizeMultiplier={1.3}>
                    {t('authEmailTypo', { email: emailSuggestion })}
                  </Text>
                </TouchableOpacity>
              ) : null}
              <AuthField
                ref={passwordRef}
                label={t('authPassword')}
                icon={Lock}
                secure
                ltr
                value={password}
                onChangeText={v => { setPassword(v); if (errors.password) setErrors(e => ({ ...e, password: undefined })) }}
                placeholder="••••••••"
                autoCapitalize="none"
                autoComplete="password-new"
                textContentType="newPassword"
                returnKeyType="done"
                error={errors.password}
              />
            </View>

            <View style={s.meter}>
              {rules.map((r, i) => (
                <View key={r.key} style={[s.meterBar, { backgroundColor: i < passed ? meterColor : th.line }]} />
              ))}
            </View>
            <View style={s.rules}>
              {rules.map(r => (
                <View key={r.key} style={s.rule}>
                  {r.ok ? <CircleCheck size={13} color={th.ok} /> : <Circle size={13} color={th.faint} />}
                  <Text style={[s.ruleText, { color: r.ok ? th.ok : th.muted }]}>{r.label}</Text>
                </View>
              ))}
            </View>

            {giftEnabled ? (
              <View style={[s.gift, { backgroundColor: th.isDark ? '#121C31' : '#FFFFFF', borderColor: th.isDark ? 'rgba(242,201,125,0.45)' : '#F2D9A8' }]}>
                <Image source={GIFT_IMAGE} style={s.giftImg} />
                <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                  <View style={[s.giftChip, { backgroundColor: th.isDark ? 'rgba(217,119,6,0.2)' : '#FFF3DC' }]}>
                    <Sparkles size={11} color={th.isDark ? '#FCD34D' : '#9A5B12'} />
                    <Text style={[s.giftChipText, { color: th.isDark ? '#FCD34D' : '#9A5B12' }]}>{t('authGiftChip')}</Text>
                  </View>
                  <Text style={[s.giftTitle, { color: th.ink }, align]}>{t('authGiftTitle')}</Text>
                  <Text style={[s.giftSub, { color: th.muted }, align]}>{t('authGiftSub')}</Text>
                </View>
              </View>
            ) : null}

            <TouchableOpacity
              style={s.agree}
              onPress={() => { setAgreed(a => !a); if (errors.agree) setErrors(e => ({ ...e, agree: undefined })) }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: agreed }}
              activeOpacity={0.8}
            >
              <View style={[s.box, { backgroundColor: agreed ? th.primary : 'transparent', borderColor: errors.agree ? th.danger : agreed ? th.primary : th.faint }]}>
                {agreed ? <Check size={14} color="#fff" /> : null}
              </View>
              <Text style={[s.agreeText, { color: th.ink2 }, align]}>
                {t('authAgreePrefix')}{' '}
                <Text style={[s.agreeLink, { color: th.primary }]} onPress={() => openLegalPage('terms', locale)}>{t('legalTerms')}</Text>
                {t('legalAnd')}
                <Text style={[s.agreeLink, { color: th.primary }]} onPress={() => openLegalPage('privacy', locale)}>{t('legalPrivacy')}</Text>
              </Text>
            </TouchableOpacity>
            <ErrorLine message={errors.agree} />
            <ErrorLine message={errors.server} />

            <PrimaryButton
              title={t('authCreate')}
              onPress={handleCreate}
              loading={loading}
              trailing={<ForwardArrow />}
              style={{ marginTop: 16 }}
            />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const s = StyleSheet.create({
  typo: { fontSize: 12, lineHeight: 18, fontFamily: F.semibold },
  root: { flex: 1 },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  steps: { flexDirection: 'row', gap: 4, direction: 'ltr' },
  stepBar: { width: 18, height: 4, borderRadius: 2 },
  h: { fontSize: 22, lineHeight: 32, fontFamily: F.display },
  p: { fontSize: 13, marginTop: 2, fontFamily: F.regular },
  verified: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, height: 30, paddingHorizontal: 10, borderRadius: 15, borderWidth: 1, marginTop: 10 },
  verifiedText: { fontSize: 12, fontFamily: F.semibold, writingDirection: 'ltr' },
  link: { fontSize: 12.5, fontFamily: F.semibold },
  meter: { flexDirection: 'row', gap: 4, marginTop: 10, direction: 'ltr' },
  meterBar: { flex: 1, height: 4, borderRadius: 2 },
  rules: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4, marginTop: 7 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ruleText: { fontSize: 11, fontFamily: F.medium },
  gift: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, padding: 8, borderRadius: 16, borderWidth: 1 },
  giftImg: { width: 58, height: 58, borderRadius: 13 },
  giftChip: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 20, paddingHorizontal: 7, borderRadius: 10 },
  giftChipText: { fontSize: 10.5, fontFamily: F.semibold },
  giftTitle: { fontSize: 13, fontFamily: F.semibold, marginTop: 3 },
  giftSub: { fontSize: 11, fontFamily: F.regular },
  agree: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 14, minHeight: 44, paddingTop: 2 },
  box: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  agreeText: { flex: 1, fontSize: 12.5, lineHeight: 20, fontFamily: F.regular },
  agreeLink: { fontFamily: F.semibold, textDecorationLine: 'underline' },
})
