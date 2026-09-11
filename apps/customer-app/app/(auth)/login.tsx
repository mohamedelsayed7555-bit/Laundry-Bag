import { useState, useEffect, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Image, Animated,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useAuth } from '../../src/contexts/AuthContext'
import { useTheme } from '../../src/contexts/ThemeContext'
import { useLanguage } from '../../src/contexts/LanguageContext'
import { useCustomAlert } from '../../src/components/CustomAlert'

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
  const { signInWithPassword, signUp, signInWithBiometric, biometricEnabled } = useAuth()
  const { colors } = useTheme()
  const { t } = useLanguage()
  const router = useRouter()
  const { showAlert, AlertComponent } = useCustomAlert()
  const [bioLoading, setBioLoading] = useState(false)

  const glowAnim = useRef(new Animated.Value(0)).current
  const brandScale = useRef(new Animated.Value(0.8)).current
  const brandOpacity = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1500, useNativeDriver: false }),
      ])
    ).start()
    Animated.parallel([
      Animated.spring(brandScale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      Animated.timing(brandOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start()
  }, [])

  function clearError(field: string) {
    setErrors(prev => { const n = { ...prev }; delete n[field]; return n })
    setServerError('')
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (isSignUp) {
      if (!name.trim()) e.name = t('nameRequired')
      if (!phone.trim()) e.phone = t('phoneRequired')
      else if (!/^01[0-9]{9}$/.test(phone.trim())) e.phone = t('phoneInvalid')
      if (!email.trim()) e.email = t('emailRequired')
      else if (!email.includes('@') || !email.includes('.')) e.email = t('emailInvalid')
    } else {
      if (!email.trim()) e.email = t('emailOrPhoneRequired')
      else {
        const isPhone = /^01[0-9]{9}$/.test(email.trim())
        const isEmail = email.includes('@') && email.includes('.')
        if (!isPhone && !isEmail) e.email = t('emailOrPhoneInvalid')
      }
    }
    if (!password) e.password = t('passwordRequired')
    else if (password.length < 6) e.password = t('passwordMin')
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
      showAlert({ title: t('success'), message: t('signupSuccess'), type: 'success', buttons: [
        { text: t('ok'), onPress: () => { setIsSignUp(false); setErrors({}); setServerError('') } },
      ] })
    }
  }

  return (
    <>
    <View style={{ flex: 1, backgroundColor: colors.navy[900] }}>
    <KeyboardAvoidingView style={[s.container, { backgroundColor: colors.navy[900] }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={{ backgroundColor: colors.navy[900] }} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {/* Logo Section */}
        <View style={s.logoSection}>
          <View style={s.logoGlowWrap}>
            <Animated.View style={[s.logoGlow, {
              backgroundColor: colors.primary,
              opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.45] }),
              transform: [{ scale: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }],
              shadowColor: colors.primary,
              shadowOpacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] }) as any,
              shadowRadius: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 30] }) as any,
              shadowOffset: { width: 0, height: 0 },
              elevation: 15,
            }]} />
            <Image source={require('../../assets/logo.jpg')} style={[s.logoImage, { borderColor: colors.primary }]} resizeMode="contain" />
          </View>
          <Animated.View style={{ transform: [{ scale: brandScale }], opacity: brandOpacity }}>
            <Text style={s.brandName}>
              <Text style={{ color: colors.text }}>Laundry </Text>
              <Text style={{ color: colors.primary }}>Bag</Text>
            </Text>
          </Animated.View>
          <Text style={[s.tagline, { color: colors.primary }]}>{t('tagline')}</Text>
          <View style={s.divider}>
            <View style={[s.dividerLine, { backgroundColor: colors.navy[600] }]} />
            <Text style={[s.dividerText, { color: colors.navy[300] }]}>{t('professionalService')}</Text>
            <View style={[s.dividerLine, { backgroundColor: colors.navy[600] }]} />
          </View>
        </View>

        {/* Tabs */}
        <View style={[s.tabs, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }]}>
          <TouchableOpacity style={[s.tab, !isSignUp && s.tabActive]} onPress={() => { setIsSignUp(false); setErrors({}); setServerError('') }}>
            {!isSignUp ? (
              <LinearGradient colors={[colors.primary, colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.tabGradient}>
                <Text style={s.tabTextActive}>🔑 {t('login')}</Text>
              </LinearGradient>
            ) : (
              <Text style={[s.tabText, { color: colors.navy[400] }]}>{t('login')}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={[s.tab, isSignUp && s.tabActive]} onPress={() => { setIsSignUp(true); setErrors({}); setServerError('') }}>
            {isSignUp ? (
              <LinearGradient colors={[colors.primary, colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.tabGradient}>
                <Text style={s.tabTextActive}>✨ {t('signup')}</Text>
              </LinearGradient>
            ) : (
              <Text style={[s.tabText, { color: colors.navy[400] }]}>{t('signup')}</Text>
            )}
          </TouchableOpacity>
        </View>

        {serverError ? (
          <View style={[s.serverErrorBox, { backgroundColor: colors.dangerGlow, borderColor: '#ef444440' }]}>
            <Text style={[s.serverErrorText, { color: colors.danger }]}>{serverError}</Text>
          </View>
        ) : null}

        <View style={s.form}>
          {isSignUp && (
            <>
              <InputField
                colors={colors}
                label={`👤  ${t('fullName')}`}
                placeholder={t('namePlaceholder')}
                value={name}
                onChangeText={(v: string) => { setName(v); clearError('name') }}
                error={errors.name}
                textAlign="right"
              />
              <InputField
                colors={colors}
                label={`📱  ${t('phone')}`}
                placeholder={t('phonePlaceholder')}
                value={phone}
                onChangeText={(v: string) => { setPhone(v); clearError('phone') }}
                error={errors.phone}
                keyboardType="phone-pad"
                textAlign="right"
              />
            </>
          )}

          <InputField
            colors={colors}
            label={isSignUp ? `✉️  ${t('email')}` : `👤  ${t('emailOrPhone')}`}
            placeholder={isSignUp ? t('emailPlaceholder') : t('emailOrPhonePlaceholder')}
            value={email}
            onChangeText={(v: string) => { setEmail(v); clearError('email') }}
            error={errors.email}
            keyboardType={isSignUp ? "email-address" : "default"}
            autoCapitalize="none"
            textAlign="right"
          />

          <View>
            <Text style={[s.label, { color: colors.navy[100] }]}>🔒  {t('password')}</Text>
            <View style={[s.inputWrap, { borderColor: colors.inputBorder, backgroundColor: colors.inputBg }, errors.password ? { borderColor: colors.danger, backgroundColor: colors.dangerGlow } : null]}>
              <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                <Text style={s.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
              <TextInput
                style={[s.passwordInput, { color: colors.text }]}
                placeholder={t('passwordPlaceholder')}
                placeholderTextColor={colors.navy[400]}
                value={password}
                onChangeText={v => { setPassword(v); clearError('password') }}
                secureTextEntry={!showPassword}
                textAlign="right"
                autoComplete="off"
                selectionColor={colors.primary}
              />
            </View>
            {errors.password ? <Text style={[s.errorText, { color: colors.danger }]}>{errors.password}</Text> : null}
            {isSignUp && !errors.password && (
              <Text style={[s.hintText, { color: colors.navy[400] }]}>{t('passwordHint')}</Text>
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={s.buttonText}>
                  {loading ? t('loading') : isSignUp ? t('creatingAccount') : t('login')}
                </Text>
                {!loading && <Text style={{ color: '#fff', fontSize: 18 }}>→</Text>}
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {!isSignUp && biometricEnabled && (
            <TouchableOpacity
              style={[s.bioButton, { borderColor: colors.primary, backgroundColor: colors.primaryGlow }, bioLoading && s.buttonDisabled]}
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
              <Text style={[s.bioButtonText, { color: colors.primary }]}>
                {bioLoading ? t('verifying') : t('biometricLogin')}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={() => { setIsSignUp(!isSignUp); setErrors({}); setServerError('') }}>
            <Text style={[s.switchText, { color: colors.accent }]}>
              {isSignUp ? t('haveAccount') : t('newUser')}
            </Text>
          </TouchableOpacity>

          <View style={s.devBrand}>
            <View style={[s.devBrandLine, { backgroundColor: colors.navy[700] }]} />
            <Text style={[s.devBrandText, { color: colors.navy[500] }]}>MH</Text>
            <View style={[s.devBrandLine, { backgroundColor: colors.navy[700] }]} />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </View>
    {AlertComponent}
    </>
  )
}

function InputField({ label, error, colors, ...inputProps }: any) {
  return (
    <View>
      <Text style={[s.label, { color: colors.navy[100] }]}>{label}</Text>
      <View style={[s.inputWrap, { borderColor: colors.inputBorder, backgroundColor: colors.inputBg }, error ? { borderColor: colors.danger, backgroundColor: colors.dangerGlow } : null]}>
        <TextInput
          style={[s.input, { color: colors.text }]}
          placeholderTextColor={colors.navy[400]}
          autoComplete="off"
          selectionColor={colors.primary}
          {...inputProps}
        />
      </View>
      {error ? <Text style={[s.errorText, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },

  logoSection: { alignItems: 'center', marginBottom: 32 },
  logoGlowWrap: { position: 'relative', marginBottom: 16 },
  logoGlow: {
    position: 'absolute', top: -10, left: -10, right: -10, bottom: -10,
    borderRadius: 70,
  },
  logoImage: { width: 110, height: 110, borderRadius: 55, borderWidth: 3 },
  brandName: {
    fontSize: 32, fontWeight: '800', letterSpacing: 1.5,
  },
  tagline: { fontSize: 16, marginTop: 4, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 12, width: '100%' },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12 },

  tabs: {
    flexDirection: 'row', borderRadius: 16,
    padding: 4, marginBottom: 24, borderWidth: 1,
  },
  tab: { flex: 1, alignItems: 'center', borderRadius: 14, overflow: 'hidden' },
  tabActive: {},
  tabGradient: { width: '100%', paddingVertical: 12, alignItems: 'center', borderRadius: 14 },
  tabText: { fontSize: 15, fontWeight: '600', paddingVertical: 12 },
  tabTextActive: { color: '#fff', fontSize: 15, fontWeight: '700' },

  form: { gap: 16 },
  label: { fontSize: 13, fontWeight: '600', textAlign: 'right', marginBottom: 6 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderRadius: 14,
    overflow: 'hidden',
  },
  input: {
    flex: 1, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15,
  },
  passwordInput: {
    flex: 1, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15,
  },
  eyeBtn: { paddingHorizontal: 16, justifyContent: 'center' },
  eyeIcon: { fontSize: 20 },
  errorText: {
    fontSize: 11, textAlign: 'right', marginTop: 4, fontWeight: '600',
  },
  hintText: {
    fontSize: 11, textAlign: 'right', marginTop: 4,
  },
  serverErrorBox: {
    borderWidth: 1,
    borderRadius: 14, padding: 14, marginBottom: 8,
  },
  serverErrorText: {
    fontSize: 13, textAlign: 'center', fontWeight: '600',
  },
  button: {
    borderRadius: 16, overflow: 'hidden', marginTop: 4,
    shadowColor: '#0ea5e9', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 14, elevation: 10,
  },
  buttonGradient: {
    padding: 18, alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 19, fontWeight: '800', letterSpacing: 0.5 },
  switchText: {
    fontSize: 14, textAlign: 'center', marginTop: 4,
    fontWeight: '600',
  },
  bioButton: {
    borderWidth: 1.5, borderRadius: 16, padding: 16,
    alignItems: 'center',
  },
  bioButtonText: { fontSize: 16, fontWeight: '700' },
  devBrand: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 32, gap: 12,
  },
  devBrandLine: { flex: 1, height: 0.5, maxWidth: 60 },
  devBrandText: {
    fontSize: 18, fontWeight: '900', letterSpacing: 6,
  },
})
