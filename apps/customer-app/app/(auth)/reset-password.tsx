import { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { useRouter } from 'expo-router'
import * as Linking from 'expo-linking'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { Lock, CircleCheck, Circle, ShieldCheck } from 'lucide-react-native'
import { useLanguage } from '../../src/contexts/LanguageContext'
import { supabase } from '../../src/lib/supabase'
import { takeIncomingUrl, onIncomingUrl } from '../../src/lib/incomingUrl'
import {
  F, useAuthTheme, AuthField, PrimaryButton, SecondaryButton, ErrorLine, TintBackground,
} from '../../src/components/auth/ui'

/**
 * Opened by the recovery link in the customer's own inbox.
 *
 * Supabase sends the tokens in the URL fragment, which expo-router does not surface as
 * params, so the raw URL is read and parsed here. The tokens stand in for the password
 * he cannot remember: once the session is set he can choose a new one, and nobody at
 * Laundry Bag was part of any of it.
 */
/**
 * Pulls one value out of a "a=1&b=2" string.
 *
 * React Native ships an incomplete URLSearchParams: constructing one from a fragment
 * and calling .get() returns nothing, so the tokens Supabase had already issued looked
 * absent and a perfectly valid link was reported as expired.
 */
function readParam(serialised: string, name: string): string | null {
  for (const pair of serialised.split('&')) {
    const eq = pair.indexOf('=')
    if (eq < 0) continue
    if (decodeURIComponent(pair.slice(0, eq)) !== name) continue
    const value = decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, ' '))
    return value.length > 0 ? value : null
  }
  return null
}

export default function ResetPasswordScreen() {
  const th = useAuthTheme()
  const { t, isRTL } = useLanguage()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const url = Linking.useURL()

  const [ready, setReady] = useState(false)
  const [linkValid, setLinkValid] = useState(false)
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ password?: string; server?: string }>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let alive = true
    let settled = false
    // The link may still be on its way when this screen mounts, so a late arrival
    // restarts the check rather than being missed.
    const stopWaiting = onIncomingUrl(() => { if (alive && !settled) openLink() })

    function finish(valid: boolean) {
      if (!alive || settled) return
      settled = true
      setLinkValid(valid)
      setReady(true)
    }

    async function openLink() {
      // The link may arrive as a fragment (#access_token=…) or as ?code=… depending on
      // the flow, and useURL() can be null when the app was already running — so the
      // initial URL is checked too.
      const incoming = url ?? takeIncomingUrl() ?? (await Linking.getInitialURL())

      if (incoming) {
        const fragment = incoming.split('#')[1] ?? ''
        const access_token = readParam(fragment, 'access_token')
        const refresh_token = readParam(fragment, 'refresh_token')

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token })
          finish(!error)
          return
        }

        const query = incoming.split('?')[1]?.split('#')[0] ?? ''
        const code = readParam(query, 'code')
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          finish(!error)
          return
        }
      }

      // Already holding a recovery session (e.g. the screen was re-mounted).
      const { data } = await supabase.auth.getSession()
      finish(!!data.session)
    }

    openLink()
    // Whatever happens, the screen must stop spinning and say something.
    const bail = setTimeout(() => finish(false), 8000)
    return () => { alive = false; stopWaiting(); clearTimeout(bail) }
  }, [url])

  const rules = useMemo(() => [
    { key: 'len', ok: password.length >= 8, label: t('authRuleLength') },
    { key: 'case', ok: /[a-z]/.test(password) && /[A-Z]/.test(password), label: t('authRuleCase') },
    { key: 'digit', ok: /[0-9]/.test(password), label: t('authRuleDigit') },
    { key: 'symbol', ok: /[^A-Za-z0-9]/.test(password), label: t('authRuleSymbol') },
  ], [password, t])
  const passed = rules.filter(r => r.ok).length
  const meterColor = passed <= 1 ? th.danger : passed < 4 ? '#F59E0B' : th.ok

  async function handleSave() {
    if (passed < rules.length) {
      setErrors({ password: t('authPasswordWeak') })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      setErrors({ server: error.message })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
      return
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    // The recovery session is already a signed-in session, so go straight in.
    router.replace('/(tabs)/home')
  }

  const align = { textAlign: (isRTL ? 'right' : 'left') as 'right' | 'left' }

  if (!ready) {
    return (
      <View style={[s.root, s.center, { backgroundColor: th.bg }]}>
        <ActivityIndicator size="large" color={th.primary} />
      </View>
    )
  }

  if (!linkValid) {
    return (
      <View style={[s.root, { backgroundColor: th.bg }]}>
        <StatusBar style={th.isDark ? 'light' : 'dark'} />
        <TintBackground />
        <View style={[s.center, { flex: 1, paddingHorizontal: 24 }]}>
          <Text style={[s.h, { color: th.ink, textAlign: 'center' }]}>{t('authLinkExpired')}</Text>
          <Text style={[s.p, { color: th.muted, textAlign: 'center' }]}>{t('authLinkExpiredSub')}</Text>
          <SecondaryButton
            title={t('authBackToSignIn')}
            onPress={() => router.replace('/(auth)/welcome')}
            style={{ marginTop: 18, alignSelf: 'stretch' }}
          />
        </View>
      </View>
    )
  }

  return (
    <View style={[s.root, { backgroundColor: th.bg }]}>
      <StatusBar style={th.isDark ? 'light' : 'dark'} />
      <TintBackground />
      <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24, paddingHorizontal: 20 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(500)}>
            <Text style={[s.h, { color: th.ink }, align]}>{t('authNewPassword')}</Text>
            <Text style={[s.p, { color: th.muted }, align]}>{t('authCodeSub')}</Text>

            <AuthField
              label={t('authNewPassword')}
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
              onSubmitEditing={handleSave}
              error={errors.password}
              style={{ marginTop: 18 }}
            />

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

            <ErrorLine message={errors.server} />

            <PrimaryButton
              title={t('authNewPassword')}
              onPress={handleSave}
              loading={loading}
              leading={<ShieldCheck size={18} color="#fff" />}
              style={{ marginTop: 16 }}
            />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  h: { fontSize: 23, lineHeight: 33, fontFamily: F.display },
  p: { fontSize: 13.5, lineHeight: 22, fontFamily: F.regular, marginTop: 4 },
  meter: { flexDirection: 'row', gap: 5, marginTop: 12 },
  meterBar: { flex: 1, height: 4, borderRadius: 2 },
  rules: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ruleText: { fontSize: 11.5, fontFamily: F.medium },
})
