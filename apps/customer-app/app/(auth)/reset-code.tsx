import { useMemo, useRef, useState } from 'react'
import {
  View, Text, ScrollView, KeyboardAvoidingView, Platform, StyleSheet, type TextInput,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { KeyRound, Lock, CircleCheck, Circle, ShieldCheck } from 'lucide-react-native'
import { useLanguage } from '../../src/contexts/LanguageContext'
import { supabase } from '../../src/lib/supabase'
import {
  F, PHONE_RE, useAuthTheme, AuthField, PhoneField, PrimaryButton, ErrorLine, RoundButton, BackArrow, TintBackground,
} from '../../src/components/auth/ui'

/**
 * Redeeming a recovery code. Support can hand out the code but never learns the result:
 * the password is typed here and sent straight to an edge function that sets it and
 * signs every other device out.
 */
export default function ResetCodeScreen() {
  const th = useAuthTheme()
  const { t, isRTL } = useLanguage()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { phone: initialPhone = '' } = useLocalSearchParams<{ phone: string }>()

  const [phone, setPhone] = useState(initialPhone)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ phone?: string; code?: string; password?: string; server?: string }>({})
  const [loading, setLoading] = useState(false)
  const passwordRef = useRef<TextInput>(null)

  const rules = useMemo(() => [
    { key: 'len', ok: password.length >= 8, label: t('authRuleLength') },
    { key: 'case', ok: /[a-z]/.test(password) && /[A-Z]/.test(password), label: t('authRuleCase') },
    { key: 'digit', ok: /[0-9]/.test(password), label: t('authRuleDigit') },
    { key: 'symbol', ok: /[^A-Za-z0-9]/.test(password), label: t('authRuleSymbol') },
  ], [password, t])
  const passed = rules.filter(r => r.ok).length
  const meterColor = passed <= 1 ? th.danger : passed < 4 ? '#F59E0B' : th.ok

  async function handleSubmit() {
    const next: typeof errors = {}
    if (!PHONE_RE.test(phone.trim())) next.phone = t('authPhoneInvalid')
    if (!/^[0-9]{6}$/.test(code.trim())) next.code = t('authCodeInvalid')
    if (passed < rules.length) next.password = t('authPasswordWeak')
    setErrors(next)
    if (Object.keys(next).length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
      return
    }

    setLoading(true)
    const { data, error } = await supabase.functions.invoke('redeem-reset-code', {
      body: { phone: phone.trim(), code: code.trim(), password },
    })
    setLoading(false)

    // The function answers the same way for a wrong code and an unknown number, so
    // nothing here reveals whether an account exists.
    const failure = error ? t('authNetworkError') : (data as any)?.error
    if (failure || !(data as any)?.success) {
      setErrors({ server: failure || t('authNetworkError') })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
      return
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    router.replace({ pathname: '/(auth)/sign-in', params: { phone: phone.trim(), reset: '1' } })
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
          </View>

          <Animated.View entering={FadeInDown.duration(500)}>
            <Text style={[s.h, { color: th.ink }, align]}>{t('authCodeTitle')}</Text>
            <Text style={[s.p, { color: th.muted }, align]}>{t('authCodeSub')}</Text>

            <View style={{ gap: 10, marginTop: 16 }}>
              <PhoneField
                value={phone}
                onChangeText={v => { setPhone(v); if (errors.phone) setErrors(e => ({ ...e, phone: undefined })) }}
                error={errors.phone}
              />
              <AuthField
                label={t('authCodeLabel')}
                icon={KeyRound}
                ltr
                value={code}
                onChangeText={v => {
                  setCode(v.replace(/[^0-9]/g, '').slice(0, 6))
                  if (errors.code || errors.server) setErrors(e => ({ ...e, code: undefined, server: undefined }))
                }}
                placeholder="000000"
                keyboardType="number-pad"
                maxLength={6}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                valid={/^[0-9]{6}$/.test(code)}
                error={errors.code}
              />
              <AuthField
                ref={passwordRef}
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
                onSubmitEditing={handleSubmit}
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

            <ErrorLine message={errors.server} />

            <PrimaryButton
              title={t('authCodeTitle')}
              onPress={handleSubmit}
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
  nav: { flexDirection: 'row', marginBottom: 6 },
  h: { fontSize: 23, lineHeight: 33, fontFamily: F.display },
  p: { fontSize: 13.5, lineHeight: 22, fontFamily: F.regular, marginTop: 4 },
  meter: { flexDirection: 'row', gap: 5, marginTop: 12 },
  meterBar: { flex: 1, height: 4, borderRadius: 2 },
  rules: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ruleText: { fontSize: 11.5, fontFamily: F.medium },
})
