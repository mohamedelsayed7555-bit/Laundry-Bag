import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
  KeyboardAvoidingView, Platform, ScrollView, Image, Animated,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../src/contexts/AuthContext'
import { colors } from '../../src/theme'

export default function LoginScreen() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState('')
  const { signInWithPassword, signUp, signInWithBiometric, biometricEnabled, biometricAvailable } = useAuth()
  const router = useRouter()
  const [bioLoading, setBioLoading] = useState(false)

  function clearError(field: string) {
    setErrors(prev => { const n = { ...prev }; delete n[field]; return n })
    setServerError('')
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (isSignUp) {
      if (!name.trim()) e.name = 'الاسم مطلوب'
      if (!phone.trim()) e.phone = 'رقم التليفون مطلوب'
      else if (!/^01[0-9]{9}$/.test(phone.trim())) e.phone = 'رقم تليفون غير صحيح'
    }
    if (!email.trim()) e.email = 'البريد الإلكتروني مطلوب'
    else if (!email.includes('@') || !email.includes('.')) e.email = 'بريد إلكتروني غير صحيح'
    if (!password) e.password = 'كلمة المرور مطلوبة'
    else if (password.length < 6) e.password = 'كلمة المرور 6 أحرف على الأقل'
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
    else router.replace('/(tabs)/home')
  }

  const handleSignUp = async () => {
    if (!validate()) return
    setLoading(true)
    setServerError('')
    const { error } = await signUp(email, password, name.trim(), phone.trim())
    setLoading(false)
    if (error) {
      setServerError(error)
    } else {
      Alert.alert('تم', 'تم إنشاء حسابك بنجاح! يمكنك تسجيل الدخول الآن', [
        { text: 'حسناً', onPress: () => { setIsSignUp(false); setErrors({}); setServerError('') } },
      ])
    }
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.logoBox}>
          <Image source={require('../../assets/logo.jpg')} style={s.logoImage} resizeMode="contain" />
          <Text style={s.logoText}>Laundry Bag</Text>
          <Text style={s.tagline}>غسيلك في شنطة</Text>
          <Text style={s.taglineSub}>خدمة غسيل وكي الملابس{'\n'}توصيل سريع وذكي</Text>
        </View>

        {/* Tabs */}
        <View style={s.tabs}>
          <TouchableOpacity style={[s.tab, !isSignUp && s.tabActive]} onPress={() => { setIsSignUp(false); setErrors({}); setServerError('') }}>
            <Text style={[s.tabText, !isSignUp && s.tabTextActive]}>تسجيل دخول</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tab, isSignUp && s.tabActive]} onPress={() => { setIsSignUp(true); setErrors({}); setServerError('') }}>
            <Text style={[s.tabText, isSignUp && s.tabTextActive]}>حساب جديد</Text>
          </TouchableOpacity>
        </View>

        {serverError ? (
          <View style={s.serverErrorBox}>
            <Text style={s.serverErrorText}>{serverError}</Text>
          </View>
        ) : null}

        <View style={s.form}>
          {isSignUp && (
            <>
              <Text style={s.label}>الاسم الكامل</Text>
              <TextInput
                style={[s.input, errors.name ? s.inputError : null]}
                placeholder="محمد أحمد"
                placeholderTextColor={colors.navy[300]}
                value={name}
                onChangeText={v => { setName(v); clearError('name') }}
                textAlign="right"
              />
              {errors.name ? <Text style={s.errorText}>{errors.name}</Text> : null}

              <Text style={s.label}>رقم التليفون</Text>
              <TextInput
                style={[s.input, errors.phone ? s.inputError : null]}
                placeholder="01xxxxxxxxx"
                placeholderTextColor={colors.navy[300]}
                value={phone}
                onChangeText={v => { setPhone(v); clearError('phone') }}
                keyboardType="phone-pad"
                textAlign="left"
              />
              {errors.phone ? <Text style={s.errorText}>{errors.phone}</Text> : null}
            </>
          )}

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

          <TouchableOpacity
            style={[s.button, loading && s.buttonDisabled]}
            onPress={isSignUp ? handleSignUp : handleLogin}
            disabled={loading}
          >
            <Text style={s.buttonText}>
              {loading ? 'جاري التحميل...' : isSignUp ? 'إنشاء حساب' : 'تسجيل دخول'}
            </Text>
          </TouchableOpacity>

          {!isSignUp && biometricEnabled && (
            <TouchableOpacity
              style={[s.bioButton, bioLoading && s.buttonDisabled]}
              onPress={async () => {
                setBioLoading(true)
                setServerError('')
                const { error } = await signInWithBiometric()
                setBioLoading(false)
                if (error) setServerError(error)
                else router.replace('/(tabs)/home')
              }}
              disabled={bioLoading}
            >
              <Text style={s.bioButtonText}>
                {bioLoading ? 'جاري التحقق...' : '🔐 تسجيل دخول بالبصمة'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={() => { setIsSignUp(!isSignUp); setErrors({}); setServerError('') }}>
            <Text style={s.switchText}>
              {isSignUp ? 'عندك حساب؟ سجّل دخول' : 'مستخدم جديد؟ أنشئ حساب'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900] },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  logoBox: { alignItems: 'center', marginBottom: 36 },
  logoImage: { width: 120, height: 120, marginBottom: 16 },
  logoText: { fontSize: 36, fontWeight: '800', color: '#fff', letterSpacing: 2 },
  tagline: { fontSize: 16, color: colors.gray[300], marginTop: 8 },
  taglineSub: { fontSize: 13, color: colors.navy[300], marginTop: 4, textAlign: 'center', lineHeight: 20 },

  tabs: {
    flexDirection: 'row', backgroundColor: colors.navy[800], borderRadius: 14,
    padding: 4, marginBottom: 24,
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 15, fontWeight: '600', color: colors.navy[300] },
  tabTextActive: { color: '#fff' },

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
    marginTop: 8, shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  switchText: {
    color: colors.accent, fontSize: 14, textAlign: 'center', marginTop: 8,
    textDecorationLine: 'underline',
  },
  bioButton: {
    borderWidth: 1.5, borderColor: colors.primary, borderRadius: 14, padding: 16,
    alignItems: 'center', marginTop: 8,
  },
  bioButtonText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
})
