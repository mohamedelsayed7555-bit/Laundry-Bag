import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Image,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useAuth } from '../../src/contexts/AuthContext'
import { useCustomAlert } from '../../src/components/CustomAlert'
import { colors } from '../../src/theme'

export default function LoginScreen() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState('')
  const { signInWithPassword, signUp, signInWithBiometric, biometricEnabled, biometricAvailable } = useAuth()
  const router = useRouter()
  const { showAlert, AlertComponent } = useCustomAlert()
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
      if (!email.trim()) e.email = 'البريد الإلكتروني مطلوب'
      else if (!email.includes('@') || !email.includes('.')) e.email = 'بريد إلكتروني غير صحيح'
    } else {
      if (!email.trim()) e.email = 'البريد الإلكتروني أو رقم التليفون مطلوب'
      else {
        const isPhone = /^01[0-9]{9}$/.test(email.trim())
        const isEmail = email.includes('@') && email.includes('.')
        if (!isPhone && !isEmail) e.email = 'ادخل بريد إلكتروني صحيح أو رقم تليفون (01xxxxxxxxx)'
      }
    }
    if (!password) e.password = 'كلمة المرور مطلوبة'
    else if (password.length < 6) e.password = 'كلمة المرور لازم 6 أحرف على الأقل (حروف إنجليزي وأرقام)'
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
      showAlert({ title: 'تم', message: 'تم إنشاء حسابك بنجاح! يمكنك تسجيل الدخول الآن', type: 'success', buttons: [
        { text: 'حسناً', onPress: () => { setIsSignUp(false); setErrors({}); setServerError('') } },
      ] })
    }
  }

  return (
    <>
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {/* Logo Section */}
        <View style={s.logoSection}>
          <View style={s.logoGlowWrap}>
            <View style={s.logoGlow} />
            <Image source={require('../../assets/logo.jpg')} style={s.logoImage} resizeMode="contain" />
          </View>
          <Text style={s.brandName}>Laundry Bag</Text>
          <Text style={s.tagline}>غسيلك في شنطة</Text>
          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>خدمة غسيل وكي احترافية</Text>
            <View style={s.dividerLine} />
          </View>
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
              <InputField
                label="الاسم الكامل"
                icon="👤"
                placeholder="محمد أحمد"
                value={name}
                onChangeText={v => { setName(v); clearError('name') }}
                error={errors.name}
                textAlign="right"
              />
              <InputField
                label="رقم التليفون"
                icon="📱"
                placeholder="01xxxxxxxxx"
                value={phone}
                onChangeText={v => { setPhone(v); clearError('phone') }}
                error={errors.phone}
                keyboardType="phone-pad"
                textAlign="left"
              />
            </>
          )}

          <InputField
            label={isSignUp ? "البريد الإلكتروني" : "البريد الإلكتروني أو رقم التليفون"}
            icon={isSignUp ? "✉️" : "👤"}
            placeholder={isSignUp ? "example@email.com" : "example@email.com أو 01xxxxxxxxx"}
            value={email}
            onChangeText={v => { setEmail(v); clearError('email') }}
            error={errors.email}
            keyboardType={isSignUp ? "email-address" : "default"}
            autoCapitalize="none"
            textAlign="left"
          />

          <View>
            <Text style={s.label}>🔒  كلمة المرور</Text>
            <View style={[s.inputWrap, errors.password ? s.inputError : null]}>
              <TextInput
                style={s.passwordInput}
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
            {isSignUp && !errors.password && (
              <Text style={s.hintText}>6 أحرف على الأقل - حروف إنجليزي وأرقام</Text>
            )}
          </View>

          <TouchableOpacity
            style={[s.button, loading && s.buttonDisabled]}
            onPress={isSignUp ? handleSignUp : handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.buttonGradient}
            >
              <Text style={s.buttonText}>
                {loading ? 'جاري التحميل...' : isSignUp ? 'إنشاء حساب' : 'تسجيل دخول'}
              </Text>
            </LinearGradient>
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
              activeOpacity={0.7}
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
    {AlertComponent}
    </>
  )
}

function InputField({ label, icon, error, ...inputProps }: any) {
  return (
    <View>
      <Text style={s.label}>{icon}  {label}</Text>
      <View style={[s.inputWrap, error ? s.inputError : null]}>
        <TextInput
          style={s.input}
          placeholderTextColor={colors.navy[400]}
          {...inputProps}
        />
      </View>
      {error ? <Text style={s.errorText}>{error}</Text> : null}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900] },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },

  logoSection: { alignItems: 'center', marginBottom: 32 },
  logoGlowWrap: { position: 'relative', marginBottom: 16 },
  logoGlow: {
    position: 'absolute', top: -10, left: -10, right: -10, bottom: -10,
    borderRadius: 70, backgroundColor: colors.primaryGlow,
  },
  logoImage: { width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: colors.primary },
  brandName: {
    fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: 1.5,
  },
  tagline: { fontSize: 16, color: colors.primary, marginTop: 4, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 12, width: '100%' },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.navy[600] },
  dividerText: { fontSize: 12, color: colors.navy[300] },

  tabs: {
    flexDirection: 'row', backgroundColor: colors.navy[800], borderRadius: 16,
    padding: 4, marginBottom: 24, borderWidth: 1, borderColor: colors.navy[700],
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 14 },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 15, fontWeight: '600', color: colors.navy[400] },
  tabTextActive: { color: '#fff' },

  form: { gap: 16 },
  label: { fontSize: 13, fontWeight: '600', color: colors.navy[100], textAlign: 'right', marginBottom: 6 },
  inputWrap: {
    borderWidth: 1.5, borderColor: colors.navy[600], borderRadius: 14,
    backgroundColor: colors.navy[800], overflow: 'hidden',
  },
  input: {
    padding: 16, fontSize: 16, color: '#fff',
  },
  passwordInput: {
    flex: 1, padding: 16, fontSize: 16, color: '#fff',
  },
  eyeBtn: { paddingHorizontal: 16, justifyContent: 'center' },
  eyeIcon: { fontSize: 20 },
  inputError: {
    borderColor: colors.danger, backgroundColor: colors.dangerGlow,
  },
  errorText: {
    fontSize: 11, color: colors.danger, textAlign: 'right', marginTop: 4, fontWeight: '600',
  },
  hintText: {
    fontSize: 11, color: colors.navy[400], textAlign: 'right', marginTop: 4,
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
  buttonGradient: {
    padding: 16, alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  switchText: {
    color: colors.accent, fontSize: 14, textAlign: 'center', marginTop: 4,
    fontWeight: '600',
  },
  bioButton: {
    borderWidth: 1.5, borderColor: colors.primary, borderRadius: 16, padding: 16,
    alignItems: 'center', backgroundColor: colors.primaryGlow,
  },
  bioButtonText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
})
