import { createContext, useContext, useEffect, useState, useMemo, useCallback, type ReactNode } from 'react'
import { Alert, Platform } from 'react-native'
import { supabase } from '../lib/supabase'
import * as SecureStore from 'expo-secure-store'
import * as LocalAuthentication from 'expo-local-authentication'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import type { Session } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { saveLastUser } from '../lib/lastUser'
import { clearGoogleSession, googleConfigured, signInWithGoogleNative, signInWithGoogleSilently } from '../lib/googleAuth'
import { appleAuthAvailable, signInWithAppleNative } from '../lib/appleAuth'
import type { User } from '../shared/types'

async function isEn() {
  try { return (await AsyncStorage.getItem('@app_language')) === 'en' } catch { return false }
}

// Old format (e-mail + password readable without a fingerprint); removed on start, the customer turns it on again.
const BIO_CREDS_KEY = 'bio_credentials'
// Which account the fingerprint belongs to (not secret).
const BIO_EMAIL_KEY = 'bio_email'
// The password, encrypted by a hardware key that only opens after a successful fingerprint/face check.
// Google accounts have no password, so for them this holds a marker instead and the
// fingerprint only gates a silent re-authentication with Google.
const BIO_SECRET_KEY = 'bio_secret'
// 'password' | 'google' — which way the fingerprint signs this account back in.
const BIO_METHOD_KEY = 'bio_method'
const GOOGLE_BIO_MARKER = 'google'
function bioSecretOptions(en: boolean): SecureStore.SecureStoreOptions {
  return {
    requireAuthentication: true,
    authenticationPrompt: en ? 'Sign in with biometric' : 'سجّل دخول بالبصمة',
    keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
  }
}

interface AuthState {
  session: Session | null
  profile: User | null
  loading: boolean
  biometricEnabled: boolean
  biometricAvailable: boolean
}

interface AuthContextType extends AuthState {
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, name: string, phone: string) => Promise<{ error: string | null }>
  signInWithGoogle: () => Promise<{ error: string | null; cancelled?: boolean; needsProfile?: boolean }>
  googleAvailable: boolean
  signInWithApple: () => Promise<{ error: string | null; cancelled?: boolean; needsProfile?: boolean }>
  appleAvailable: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  toggleBiometric: (enable: boolean, email?: string, password?: string) => Promise<boolean>
  signInWithBiometric: () => Promise<{ error: string | null }>
  biometricEmail: () => Promise<string | null>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // iOS only, and only where the OS actually offers it.
  const [appleAvailable, setAppleAvailable] = useState(false)
  useEffect(() => { appleAuthAvailable().then(setAppleAvailable) }, [])

  const [state, setState] = useState<AuthState>({
    session: null,
    profile: null,
    loading: true,
    biometricEnabled: false,
    biometricAvailable: false,
  })

  useEffect(() => {
    checkBiometricStatus()

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchProfile(session)
      } else {
        setState(s => ({ ...s, loading: false }))
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchProfile(session)
      } else {
        setState(s => ({ ...s, session: null, profile: null, loading: false }))
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!state.profile?.id) return
    const channel = supabase
      .channel(`user-active-${state.profile.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'users',
        filter: `id=eq.${state.profile.id}`,
      }, (payload) => {
        if (payload.new.is_active === false) {
          Alert.alert('تم تعطيل حسابك', 'تواصل مع الإدارة لمزيد من المعلومات', [{ text: 'حسناً' }])
          supabase.auth.signOut()
          setState(s => ({ ...s, session: null, profile: null, loading: false }))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [state.profile?.id])

  async function checkBiometricStatus() {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync()
      const enrolled = compatible ? await LocalAuthentication.isEnrolledAsync() : false
      if (await SecureStore.getItemAsync(BIO_CREDS_KEY)) await SecureStore.deleteItemAsync(BIO_CREDS_KEY)
      const secure = SecureStore.canUseBiometricAuthentication()
      const saved = secure ? await SecureStore.getItemAsync(BIO_EMAIL_KEY) : null
      setState(s => ({
        ...s,
        biometricAvailable: compatible && enrolled && secure,
        biometricEnabled: !!(compatible && enrolled && saved),
      }))
    } catch {
      setState(s => ({ ...s, biometricAvailable: false, biometricEnabled: false }))
    }
  }

  async function fetchProfile(session: Session) {
    const COLUMNS = 'id, name, phone, email, role, customer_code, tier, points, is_active, avatar_url, fcm_token'
    let { data } = await supabase
      .from('users')
      .select(COLUMNS)
      .eq('id', session.user.id)
      .single()

    // A Google sign-in creates the auth user without going through our sign-up, so the
    // profile row may not exist yet. Seed it from what Google gave us instead of
    // signing the customer straight back out; the phone is collected on the next screen.
    if (!data) {
      const meta: any = session.user.user_metadata ?? {}
      const seeded = await supabase
        .from('users')
        .upsert({
          id: session.user.id,
          email: session.user.email ?? null,
          name: (meta.name || meta.full_name || '').trim() || null,
          avatar_url: meta.avatar_url || meta.picture || null,
          role: 'customer',
          is_active: true,
        }, { onConflict: 'id' })
        .select(COLUMNS)
        .single()
      data = seeded.data
    }

    if (!data || data.is_active === false || data.role !== 'customer') {
      await supabase.auth.signOut()
      setState(s => ({ ...s, session: null, profile: null, loading: false }))
      return
    }

    setState(s => ({
      ...s,
      session,
      profile: data as User,
      loading: false,
    }))

    if (data.name && data.phone) saveLastUser({ name: data.name, phone: data.phone, email: data.email ?? '', avatarUrl: data.avatar_url ?? null })
    registerPushToken(data.id)
  }

  async function registerPushToken(userId: string) {
    try {
      if (!Device.isDevice) return
      const { status: existing } = await Notifications.getPermissionsAsync()
      let finalStatus = existing
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync()
        finalStatus = status
      }
      if (finalStatus !== 'granted') return
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: '178256af-c74c-4880-9722-8d30ba1e3e8b',
      })
      const token = tokenData.data
      await supabase.from('users').update({ fcm_token: token }).eq('id', userId)
    } catch {}
  }

  async function signInWithPassword(identifier: string, password: string) {
    const en = await isEn()
    const isPhone = /^01[0-9]{9}$/.test(identifier.trim())
    let loginEmail = identifier
    if (isPhone) {
      const { data: phoneEmail } = await supabase.rpc('login_email_for_phone', { p_phone: identifier.trim(), p_app: 'customer' })
      if (!phoneEmail) return { error: en ? 'Phone number not registered' : 'رقم التليفون غير مسجل' }
      loginEmail = phoneEmail as string
    }
    const { error, data } = await supabase.auth.signInWithPassword({ email: loginEmail, password })
    if (error) {
      let msg = error.message
      if (msg.includes('Invalid login'))
        msg = en ? 'Incorrect email or password' : 'البريد الإلكتروني أو كلمة المرور غلط'
      else if (msg.includes('Email not confirmed'))
        msg = en ? 'Account not confirmed — check your email' : 'الحساب لم يتم تأكيده — تحقق من بريدك الإلكتروني'
      return { error: msg }
    }

    if (data.user) {
      const { data: profile } = await supabase.from('users').select('is_active').eq('id', data.user.id).single()
      if (profile && profile.is_active === false) {
        await supabase.auth.signOut()
        return { error: en ? 'Your account has been deactivated — contact support' : 'تم تعطيل حسابك — تواصل مع الإدارة' }
      }
    }

    return { error: null }
  }

  async function signUp(email: string, password: string, name: string, phone: string) {
    const en = await isEn()
    const { data: phoneTaken } = await supabase.rpc('is_phone_registered', { p_phone: phone.trim() })
    if (phoneTaken) return { error: en ? 'Phone number already registered' : 'رقم الموبايل مسجل بالفعل' }

    // A password account must have a real inbox: it is the only way the customer can
    // reset it himself. Whoever does not want to give one signs in with Google instead,
    // and that account has no password to forget.
    const authEmail = email.trim().toLowerCase()
    if (!authEmail) return { error: en ? 'Email is required to recover your account' : 'البريد الإلكتروني مطلوب عشان تقدر ترجّع حسابك' }

    // Pass name/phone as sign-up metadata so the handle_new_user trigger writes the
    // real values into public.users at creation time. Otherwise the row is created
    // with defaults ("مستخدم جديد", no phone), fetchProfile loads those first, and the
    // correct values only show after a re-login. The upsert below stays as a backstop.
    const { error, data } = await supabase.auth.signUp({
      email: authEmail,
      password,
      options: { data: { name: name.trim(), phone: phone.trim() } },
    })
    if (error) {
      let msg = error.message
      if (msg.includes('Password should contain'))
        msg = en ? 'Password must contain uppercase, lowercase, numbers and symbols' : 'كلمة المرور لازم تحتوي على حروف كبيرة وصغيرة وأرقام ورموز'
      else if (msg.includes('already registered'))
        msg = en ? 'Email already registered' : 'البريد الإلكتروني مسجل بالفعل'
      else if (msg.includes('valid email'))
        msg = en ? 'Invalid email address' : 'البريد الإلكتروني غير صالح'
      else if (msg.includes('at least'))
        msg = en ? 'Password must be at least 6 characters' : 'كلمة المرور لازم تكون 6 حروف على الأقل'
      return { error: msg }
    }

    if (data.user) {
      await supabase.from('users').upsert({
        id: data.user.id,
        email: authEmail,
        name,
        phone,
        role: 'customer',
        is_active: true,
      })
    }

    return { error: null }
  }

  /**
   * Google is the identity for these accounts: no password is created, so there is
   * nothing for the customer to forget and nothing for us to reset on his behalf.
   * Returns needsProfile when the phone is still missing (Google never gives one).
   */
  async function signInWithGoogle(): Promise<{ error: string | null; cancelled?: boolean; needsProfile?: boolean }> {
    const en = await isEn()
    const res = await signInWithGoogleNative(en)
    if (res.cancelled) return { error: null, cancelled: true }
    if (res.error || !res.idToken) return { error: res.error ?? (en ? 'Google sign-in failed' : 'تعذّر الدخول بجوجل') }

    const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: res.idToken })
    if (error || !data.user) {
      await clearGoogleSession()
      // The e-mail is unique across accounts: this Gmail already has a password account.
      if (/already|exists|duplicate|unique/i.test(error?.message ?? '')) {
        return {
          error: en
            ? 'This email already has an account. Sign in with your password instead.'
            : 'الإيميل ده عليه حساب بالفعل. ادخل بكلمة السر بدل كده.',
        }
      }
      return { error: en ? 'Could not sign in with this account' : 'تعذّر الدخول بالحساب ده' }
    }

    const { data: row } = await supabase
      .from('users')
      .select('phone, is_active, role')
      .eq('id', data.user.id)
      .maybeSingle()

    if (row && (row.is_active === false || row.role !== 'customer')) {
      await supabase.auth.signOut()
      await clearGoogleSession()
      return { error: en ? 'This account cannot sign in here' : 'الحساب ده مش مسموح له بالدخول من هنا' }
    }

    return { error: null, needsProfile: !row?.phone }
  }

  /**
   * Apple requires this next to Google (guideline 4.8). Like Google it creates an
   * account with no password, and the phone number is still collected on the next
   * screen because Apple does not supply one either.
   */
  async function signInWithApple(): Promise<{ error: string | null; cancelled?: boolean; needsProfile?: boolean }> {
    const en = await isEn()
    const res = await signInWithAppleNative(en)
    if (res.cancelled) return { error: null, cancelled: true }
    if (res.error || !res.idToken) return { error: res.error ?? (en ? 'Apple sign-in failed' : 'تعذّر الدخول بـ Apple') }

    const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: res.idToken })
    if (error || !data.user) {
      if (/already|exists|duplicate|unique/i.test(error?.message ?? '')) {
        return {
          error: en
            ? 'This email already has an account. Sign in with your password instead.'
            : 'الإيميل ده عليه حساب بالفعل. ادخل بكلمة السر بدل كده.',
        }
      }
      return { error: en ? 'Could not sign in with this account' : 'تعذّر الدخول بالحساب ده' }
    }

    // Apple hands over the name once, on the first authorisation only. If we do not
    // store it now it is gone for good, and the customer has to type it himself.
    if (res.fullName) {
      await supabase.from('users')
        .update({ name: res.fullName })
        .eq('id', data.user.id)
        .is('name', null)
        .then(() => {}, () => {})
    }

    const { data: row } = await supabase
      .from('users')
      .select('phone, is_active, role')
      .eq('id', data.user.id)
      .maybeSingle()

    if (row && (row.is_active === false || row.role !== 'customer')) {
      await supabase.auth.signOut()
      return { error: en ? 'This account cannot sign in here' : 'الحساب ده مش مسموح له بالدخول من هنا' }
    }

    return { error: null, needsProfile: !row?.phone }
  }

  async function signOut() {
    // The Google account stays cached on purpose: the fingerprint shortcut re-signs in
    // silently with it. A manual "Continue with Google" always shows the picker anyway,
    // because signInWithGoogleNative clears the cache right before it opens.
    // This device must stop receiving this account's notifications.
    const uid = state.session?.user.id
    if (uid) {
      try { await supabase.from('users').update({ fcm_token: null }).eq('id', uid) } catch {}
    }
    await supabase.auth.signOut()
    setState(s => ({ ...s, session: null, profile: null, loading: false }))
  }

  async function refreshProfile() {
    if (state.session) {
      await fetchProfile(state.session)
    }
  }

  async function toggleBiometric(enable: boolean, email?: string, password?: string): Promise<boolean> {
    if (enable) {
      // A Google account has no password to protect, so the fingerprint instead gates a
      // silent re-authentication with Google. Nothing secret is written to the device.
      const isGoogle = state.session?.user.app_metadata?.provider === 'google'
      if (isGoogle) {
        const mail = email || state.session?.user.email
        if (!mail) return false
        try {
          await SecureStore.setItemAsync(BIO_SECRET_KEY, GOOGLE_BIO_MARKER, bioSecretOptions(await isEn()))
          await SecureStore.setItemAsync(BIO_EMAIL_KEY, mail)
          await SecureStore.setItemAsync(BIO_METHOD_KEY, GOOGLE_BIO_MARKER)
          setState(s => ({ ...s, biometricEnabled: true }))
          return true
        } catch {
          await SecureStore.deleteItemAsync(BIO_SECRET_KEY).catch(() => {})
          await SecureStore.deleteItemAsync(BIO_EMAIL_KEY).catch(() => {})
          await SecureStore.deleteItemAsync(BIO_METHOD_KEY).catch(() => {})
          return false
        }
      }
      if (!email || !password) return false
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) return false
        await SecureStore.setItemAsync(BIO_SECRET_KEY, password, bioSecretOptions(await isEn()))
        await SecureStore.setItemAsync(BIO_EMAIL_KEY, email)
        await SecureStore.setItemAsync(BIO_METHOD_KEY, 'password')
        setState(s => ({ ...s, biometricEnabled: true }))
        return true
      } catch {
        await SecureStore.deleteItemAsync(BIO_SECRET_KEY).catch(() => {})
        await SecureStore.deleteItemAsync(BIO_EMAIL_KEY).catch(() => {})
        return false
      }
    } else {
      try {
        await SecureStore.deleteItemAsync(BIO_SECRET_KEY)
        await SecureStore.deleteItemAsync(BIO_EMAIL_KEY)
        await SecureStore.deleteItemAsync(BIO_METHOD_KEY).catch(() => {})
        await SecureStore.deleteItemAsync(BIO_CREDS_KEY).catch(() => {})
        setState(s => ({ ...s, biometricEnabled: false }))
        return true
      } catch {
        return false
      }
    }
  }

  async function signInWithBiometric(): Promise<{ error: string | null }> {
    try {
      const en = await isEn()
      const email = await SecureStore.getItemAsync(BIO_EMAIL_KEY)
      if (!email) return { error: en ? 'Biometric not enabled' : 'البصمة غير مفعّلة' }

      // The OS shows the fingerprint/face prompt; the password can only be decrypted after it succeeds.
      let password: string | null = null
      try {
        password = await SecureStore.getItemAsync(BIO_SECRET_KEY, bioSecretOptions(en))
      } catch {
        return { error: en ? 'Biometric verification failed' : 'فشل التحقق بالبصمة' }
      }
      if (!password) {
        // The key was invalidated (e.g. a new fingerprint was added): sign in with the password and turn it on again.
        await SecureStore.deleteItemAsync(BIO_EMAIL_KEY).catch(() => {})
        await SecureStore.deleteItemAsync(BIO_SECRET_KEY).catch(() => {})
        await SecureStore.deleteItemAsync(BIO_METHOD_KEY).catch(() => {})
        setState(s => ({ ...s, biometricEnabled: false }))
        return { error: en ? 'Please sign in with your password, then turn on biometric again' : 'ادخل بكلمة السر وفعّل البصمة تاني' }
      }

      // Google account: the fingerprint has just been verified, so ask Google for a
      // fresh token without showing the picker. No password exists to replay.
      if (password === GOOGLE_BIO_MARKER) {
        const res = await signInWithGoogleSilently(en)
        if (res.error || !res.idToken) {
          return { error: res.error ?? (en ? 'Sign in with Google again' : 'ادخل بجوجل تاني') }
        }
        const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: res.idToken })
        if (error) return { error: en ? 'Sign in with Google again' : 'ادخل بجوجل تاني' }
        return { error: null }
      }

      return signInWithPassword(email, password)
    } catch {
      const en = await isEn()
      return { error: en ? 'An error occurred during biometric verification' : 'حدث خطأ أثناء التحقق بالبصمة' }
    }
  }

  // Which account the saved fingerprint credentials belong to, so the UI only offers
  // fingerprint sign-in to that same person.
  async function biometricEmail(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(BIO_EMAIL_KEY)
    } catch {
      return null
    }
  }

  const value = useMemo(() => ({
    ...state, signInWithPassword, signUp, signInWithGoogle, googleAvailable: googleConfigured,
    signInWithApple, appleAvailable,
    signOut, refreshProfile, toggleBiometric, signInWithBiometric, biometricEmail,
  }), [state, appleAvailable])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
