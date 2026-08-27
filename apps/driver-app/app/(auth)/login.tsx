import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../src/contexts/AuthContext'
import { colors } from '../../src/theme'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [usePassword, setUsePassword] = useState(false)
  const { signInWithOtp, signInWithPassword } = useAuth()
  const router = useRouter()

  const handleSendOtp = async () => {
    if (!email.includes('@')) { Alert.alert('خطأ', 'أدخل بريد إلكتروني صحيح'); return }
    setLoading(true)
    const { error } = await signInWithOtp(email)
    setLoading(false)
    if (error) { Alert.alert('خطأ', error); return }
    router.push({ pathname: '/(auth)/verify', params: { email } })
  }

  const handlePasswordLogin = async () => {
    if (!email.includes('@')) { Alert.alert('خطأ', 'أدخل بريد إلكتروني صحيح'); return }
    if (!password) { Alert.alert('خطأ', 'أدخل كلمة المرور'); return }
    setLoading(true)
    const { error } = await signInWithPassword(email, password)
    setLoading(false)
    if (error) { Alert.alert('خطأ', error) }
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.content}>
        <View style={s.header}>
          <View style={s.logoIcon}>
            <Text style={s.logoIconText}>C</Text>
          </View>
          <Text style={s.logo}>CLEANO</Text>
          <View style={s.badge}>
            <Text style={s.badgeText}>تطبيق السائق</Text>
          </View>
        </View>

        <View style={s.form}>
          <Text style={s.label}>البريد الإلكتروني</Text>
          <TextInput
            style={s.input}
            placeholder="example@email.com"
            placeholderTextColor={colors.navy[300]}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            textAlign="left"
          />

          {usePassword && (
            <>
              <Text style={s.label}>كلمة المرور</Text>
              <TextInput
                style={s.input}
                placeholder="********"
                placeholderTextColor={colors.navy[300]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textAlign="left"
              />
            </>
          )}

          <TouchableOpacity style={[s.button, loading && s.buttonDisabled]} onPress={usePassword ? handlePasswordLogin : handleSendOtp} disabled={loading}>
            <Text style={s.buttonText}>{loading ? 'جاري الدخول...' : 'دخول'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setUsePassword(!usePassword)}>
            <Text style={s.switchText}>{usePassword ? 'دخول بـ OTP' : 'دخول بكلمة مرور'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900] },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  header: { alignItems: 'center', marginBottom: 48 },
  logoIcon: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    marginBottom: 16, shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 12,
  },
  logoIconText: { fontSize: 32, fontWeight: '900', color: '#fff' },
  logo: { fontSize: 36, fontWeight: '800', color: '#fff', letterSpacing: 2 },
  badge: {
    backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 4, borderRadius: 12, marginTop: 10,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  form: { gap: 16 },
  label: { fontSize: 14, fontWeight: '600', color: colors.navy[100], textAlign: 'right' },
  input: {
    borderWidth: 1, borderColor: colors.navy[500], borderRadius: 14,
    padding: 16, fontSize: 18, backgroundColor: colors.navy[800], color: '#fff',
  },
  button: {
    backgroundColor: colors.primary, borderRadius: 14, padding: 16, alignItems: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  switchText: { color: colors.navy[200], fontSize: 14, textAlign: 'center' as const, marginTop: 8, textDecorationLine: 'underline' as const },
})
