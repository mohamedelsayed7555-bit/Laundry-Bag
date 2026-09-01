import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Image, ScrollView } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useAuth } from '../../src/contexts/AuthContext'
import { colors } from '../../src/theme'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState('')
  const { signInWithPassword, signInWithBiometric, biometricEnabled } = useAuth()
  const router = useRouter()
  const [bioLoading, setBioLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

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
    else router.replace('/(tabs)/orders')
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {/* Logo Section */}
        <View style={s.logoSection}>
          <View style={s.logoGlowWrap}>
            <View style={s.logoGlow} />
            <Image source={require('../../assets/logo.jpg')} style={s.logoImage} resizeMode="contain" />
          </View>
          <Text style={s.brandName}>Laundry Bag</Text>
          <View style={s.driverBadge}>
            <Text style={s.driverBadgeText}>تطبيق السائق</Text>
          </View>
        </View>

        {serverError ? (
          <View style={s.serverErrorBox}>
            <Text style={s.serverErrorText}>{serverError}</Text>
          </View>
        ) : null}

        <View style={s.form}>
          <Text style={s.label}>✉️  البريد الإلكتروني</Text>
          <View style={[s.inputWrap, errors.email ? s.inputError : null]}>
            <TextInput
              style={s.input}
              placeholder="example@email.com"
              placeholderTextColor={colors.navy[400]}
              value={email}
              onChangeText={v => { setEmail(v); clearError('email') }}
              keyboardType="email-address"
              autoCapitalize="none"
              textAlign="left"
            />
          </View>
          {errors.email ? <Text style={s.errorText}>{errors.email}</Text> : null}

          <Text style={s.label}>🔒  كلمة المرور</Text>
          <View style={[s.inputWrap, errors.password ? s.inputError : null]}>
            <TextInput
              style={[s.input, { flex: 1 }]}
              placeholder="••••••••"
              placeholderTextColor={colors.navy[400]}
              value={password}
              onChangeText={v => { setPassword(v); clearError('password') }}
              secureTextEntry={!showPassword}
              textAlign="left"
            />
            <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
              <Text style={s.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>
          {errors.password ? <Text style={s.errorText}>{errors.password}</Text> : null}

          <TouchableOpacity
            style={[s.button, loading && s.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.buttonGradient}
            >
              <Text style={s.buttonText}>{loading ? 'جاري الدخول...' : 'تسجيل دخول'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          {biometricEnabled && (
            <TouchableOpacity
              style={[s.bioButton, bioLoading && s.buttonDisabled]}
              onPress={async () => {
                setBioLoading(true)
                setServerError('')
                const { error } = await signInWithBiometric()
                setBioLoading(false)
                if (error) setServerError(error)
                else router.replace('/(tabs)/orders')
              }}
              disabled={bioLoading}
              activeOpacity={0.7}
            >
              <Text style={s.bioButtonText}>
                {bioLoading ? 'جاري التحقق...' : '🔐 تسجيل دخول بالبصمة'}
              </Text>
            </TouchableOpacity>
          )}

          <Text style={s.hint}>يتم إنشاء حسابك بواسطة الإدارة فقط</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900] },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },

  logoSection: { alignItems: 'center', marginBottom: 36 },
  logoGlowWrap: { position: 'relative', marginBottom: 16 },
  logoGlow: {
    position: 'absolute', top: -10, left: -10, right: -10, bottom: -10,
    borderRadius: 70, backgroundColor: colors.accentGlow,
  },
  logoImage: { width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: colors.accent },
  brandName: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: 1.5 },
  driverBadge: {
    backgroundColor: colors.accentGlow, paddingHorizontal: 20, paddingVertical: 6,
    borderRadius: 14, marginTop: 10, borderWidth: 1, borderColor: colors.accent + '30',
  },
  driverBadgeText: { color: colors.accent, fontSize: 13, fontWeight: '700' },

  form: { gap: 16 },
  label: { fontSize: 13, fontWeight: '600', color: colors.navy[100], textAlign: 'right', marginBottom: 4 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.navy[600], borderRadius: 14,
    backgroundColor: colors.navy[800],
  },
  input: {
    padding: 16, fontSize: 16, color: '#fff', flex: 1,
  },
  eyeBtn: { paddingHorizontal: 16 },
  eyeIcon: { fontSize: 20 },
  inputError: {
    borderColor: colors.danger, backgroundColor: colors.dangerGlow,
  },
  errorText: {
    fontSize: 11, color: colors.danger, textAlign: 'right', marginTop: 2, fontWeight: '600',
  },
  serverErrorBox: {
    backgroundColor: colors.dangerGlow, borderWidth: 1, borderColor: '#ef444440',
    borderRadius: 14, padding: 14, marginBottom: 8,
  },
  serverErrorText: {
    color: colors.danger, fontSize: 13, textAlign: 'center', fontWeight: '600',
  },
  button: {
    borderRadius: 16, overflow: 'hidden', marginTop: 4,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 14, elevation: 10,
  },
  buttonGradient: { padding: 16, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  hint: { fontSize: 12, color: colors.navy[400], textAlign: 'center', marginTop: 4 },
  bioButton: {
    borderWidth: 1.5, borderColor: colors.primary, borderRadius: 16, padding: 16,
    alignItems: 'center', backgroundColor: colors.primaryGlow,
  },
  bioButtonText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
})
