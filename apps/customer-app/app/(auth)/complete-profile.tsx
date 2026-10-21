import { useEffect, useState } from 'react'
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, StyleSheet } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { User, ShieldCheck } from 'lucide-react-native'
import { useAuth } from '../../src/contexts/AuthContext'
import { useLanguage } from '../../src/contexts/LanguageContext'
import { supabase } from '../../src/lib/supabase'
import {
  F, PHONE_RE, useAuthTheme, AuthField, PhoneField, PrimaryButton, ErrorLine, TintBackground, ForwardArrow,
} from '../../src/components/auth/ui'

// What handle_new_user writes when the provider gave no name — not a real name.
const PLACEHOLDER_NAME = 'مستخدم جديد'

/**
 * Google gives us an e-mail and a name but never a phone number, and the phone is how
 * an order reaches a customer. So a Google sign-in lands here once, and only once:
 * the screen is skipped for good as soon as the number is saved.
 */
export default function CompleteProfileScreen() {
  const th = useAuthTheme()
  const { t, isRTL } = useLanguage()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { session, profile, refreshProfile, signOut } = useAuth()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [errors, setErrors] = useState<{ name?: string; phone?: string; server?: string }>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const meta: any = session?.user.user_metadata ?? {}
    const stored = profile?.name?.trim()
    setName(stored && stored !== PLACEHOLDER_NAME ? stored : (meta.name || meta.full_name || '').trim())
  }, [profile?.name, session?.user.id])

  // Nothing to complete (or signed out in another tab): don't strand the customer here.
  useEffect(() => {
    if (!session) router.replace('/(auth)/welcome')
    else if (profile?.phone) router.replace('/(tabs)/home')
  }, [session, profile?.phone])

  async function handleSave() {
    const next: typeof errors = {}
    if (name.trim().length < 2) next.name = t('authNameRequired')
    if (!PHONE_RE.test(phone)) next.phone = t('authPhoneInvalid')
    setErrors(next)
    if (Object.keys(next).length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
      return
    }

    setLoading(true)
    // The number identifies the account, so it may not be taken. Claiming someone
    // else's number here would be an account takeover, not a sign-up.
    const { data: taken } = await supabase.rpc('is_phone_registered', { p_phone: phone.trim() })
    if (taken) {
      setLoading(false)
      setErrors({ phone: t('authPhoneTaken') })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
      return
    }

    const { error } = await supabase
      .from('users')
      .update({ name: name.trim(), phone: phone.trim() })
      .eq('id', session!.user.id)

    if (error) {
      setLoading(false)
      // A race on the unique index lands here: another account claimed it meanwhile.
      setErrors({ server: /duplicate|unique/i.test(error.message) ? t('authPhoneTaken') : error.message })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
      return
    }

    await refreshProfile()
    setLoading(false)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    // Same one-time location step the password sign-up ends with.
    router.replace({ pathname: '/addresses', params: { onboarding: '1' } })
  }

  const align = { textAlign: (isRTL ? 'right' : 'left') as 'right' | 'left' }

  return (
    <View style={[s.root, { backgroundColor: th.bg }]}>
      <StatusBar style={th.isDark ? 'light' : 'dark'} />
      <TintBackground />
      <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, paddingHorizontal: 20 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(500)}>
            <Text style={[s.h, { color: th.ink }, align]}>{t('authCompleteTitle')}</Text>
            <Text style={[s.p, { color: th.muted }, align]}>{t('authCompleteSub')}</Text>

            {session?.user.email ? (
              <View style={[s.verified, { backgroundColor: th.okBg, borderColor: th.isDark ? 'rgba(34,197,94,0.3)' : '#C3EED3' }]}>
                <ShieldCheck size={14} color={th.ok} />
                <Text style={[s.verifiedText, { color: th.isDark ? '#86EFAC' : '#166534' }]} numberOfLines={1}>
                  {session.user.email}
                </Text>
              </View>
            ) : null}

            <View style={{ gap: 10, marginTop: 14 }}>
              <AuthField
                label={t('authFullName')}
                icon={User}
                value={name}
                onChangeText={v => { setName(v); if (errors.name) setErrors(e => ({ ...e, name: undefined })) }}
                placeholder={t('authFullNamePh')}
                autoComplete="name"
                textContentType="name"
                returnKeyType="next"
                valid={name.trim().length >= 2}
                error={errors.name}
              />
              <PhoneField
                value={phone}
                onChangeText={v => { setPhone(v); if (errors.phone) setErrors(e => ({ ...e, phone: undefined })) }}
                error={errors.phone}
                onSubmitEditing={handleSave}
              />
            </View>

            <ErrorLine message={errors.server} />

            <PrimaryButton
              title={t('authCompleteCta')}
              onPress={handleSave}
              loading={loading}
              trailing={<ForwardArrow />}
              style={{ marginTop: 18 }}
            />

            <TouchableOpacity
              onPress={() => { signOut(); router.replace('/(auth)/welcome') }}
              hitSlop={10}
              accessibilityRole="button"
              style={{ marginTop: 16, alignSelf: 'center' }}
            >
              <Text style={[s.link, { color: th.muted }]}>{t('authBackToSignIn')}</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  h: { fontSize: 24, lineHeight: 34, fontFamily: F.display },
  p: { fontSize: 13.5, lineHeight: 22, fontFamily: F.regular, marginTop: 4 },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', marginTop: 12, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, maxWidth: '100%' },
  verifiedText: { fontSize: 12, fontFamily: F.semibold, flexShrink: 1 },
  link: { fontSize: 13, fontFamily: F.semibold },
})
