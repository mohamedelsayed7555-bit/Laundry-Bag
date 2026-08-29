import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Image } from 'react-native'
import { useAuth } from '../../src/contexts/AuthContext'
import { colors } from '../../src/theme'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState('')
  const { signInWithPassword } = useAuth()

  function clearError(field: string) {
    setErrors(prev => { const n = { ...prev }; delete n[field]; return n })
    setServerError('')
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!email.trim()) e.email = 'البريد الإلكتروني مطلوب'
    else if (!email.includes('@') || !email.includes('.')) e.email = 'بريد إلكتروني غير صحيح'
    if (!password) e.password = 'كلمة المرور مطلوبة'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleLogin = async () => {
    if (!validate()) return
    setLoading(true)
    setServerError('')
    const { error } = await signInWithPassword(email, password)
    setLoading(false)
    if (error) setServerError(error)
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.content}>
        <View style={s.header}>
          <Image source={require('../../assets/logo.jpg')} style={s.logoImage} resizeMode="contain" />
          <Text style={s.logo}>Laundry Bag</Text>
          <View style={s.badge}>
            <Text style={s.badgeText}>تطبيق السائق</Text>
          </View>
        </View>

        {serverError ? (
          <View style={s.serverErrorBox}>
            <Text style={s.serverErrorText}>{serverError}</Text>
          </View>
        ) : null}

        <View style={s.form}>
          <Text style={s.label}>البريد الإلكتروني</Text>
          <TextInput
            style={[s.input, errors.email ? s.inputError : null]}
            placeholder="example@email.com"
            placeholderTextColor={colors.navy[300]}
            value={email}
            onChangeText={v => { setEmail(v); clearError('email') }}
            keyboardType="email-address"
            autoCapitalize="none"
            textAlign="left"
          />
          {errors.email ? <Text style={s.errorText}>{errors.email}</Text> : null}

          <Text style={s.label}>كلمة المرور</Text>
          <TextInput
            style={[s.input, errors.password ? s.inputError : null]}
            placeholder="••••••••"
            placeholderTextColor={colors.navy[300]}
            value={password}
            onChangeText={v => { setPassword(v); clearError('password') }}
            secureTextEntry
            textAlign="left"
          />
          {errors.password ? <Text style={s.errorText}>{errors.password}</Text> : null}

          <TouchableOpacity style={[s.button, loading && s.buttonDisabled]} onPress={handleLogin} disabled={loading}>
            <Text style={s.buttonText}>{loading ? 'جاري الدخول...' : 'تسجيل دخول'}</Text>
          </TouchableOpacity>

          <Text style={s.hint}>يتم إنشاء حسابك بواسطة الإدارة فقط</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900] },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  header: { alignItems: 'center', marginBottom: 48 },
  logoImage: { width: 120, height: 120, marginBottom: 16 },
  logo: { fontSize: 36, fontWeight: '800', color: '#fff', letterSpacing: 2 },
  badge: {
    backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 4, borderRadius: 12, marginTop: 10,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  form: { gap: 12 },
  label: { fontSize: 14, fontWeight: '600', color: colors.navy[100], textAlign: 'right' },
  input: {
    borderWidth: 1.5, borderColor: colors.navy[500], borderRadius: 14,
    padding: 16, fontSize: 18, backgroundColor: colors.navy[800], color: '#fff',
  },
  inputError: {
    borderColor: '#ef4444', backgroundColor: '#ef444410',
  },
  errorText: {
    fontSize: 12, color: '#ef4444', textAlign: 'right', marginTop: 4, fontWeight: '500',
  },
  serverErrorBox: {
    backgroundColor: '#ef444415', borderWidth: 1, borderColor: '#ef444440',
    borderRadius: 12, padding: 12, marginBottom: 16,
  },
  serverErrorText: {
    color: '#ef4444', fontSize: 13, textAlign: 'center', fontWeight: '600',
  },
  button: {
    backgroundColor: colors.primary, borderRadius: 14, padding: 16, alignItems: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  hint: { fontSize: 12, color: colors.navy[400], textAlign: 'center', marginTop: 4 },
})
