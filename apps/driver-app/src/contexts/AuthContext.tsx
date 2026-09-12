import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Alert, Platform } from 'react-native'
import { supabase } from '../lib/supabase'
import * as SecureStore from 'expo-secure-store'
import * as LocalAuthentication from 'expo-local-authentication'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import type { Session } from '@supabase/supabase-js'
import type { User } from '../shared/types'

const BIO_CREDS_KEY = 'bio_credentials_driver'

interface AuthState {
  session: Session | null
  profile: User | null
  loading: boolean
  biometricEnabled: boolean
  biometricAvailable: boolean
}

interface AuthContextType extends AuthState {
  signInWithOtp: (email: string) => Promise<{ error: string | null }>
  verifyOtp: (email: string, token: string) => Promise<{ error: string | null }>
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  toggleBiometric: (enable: boolean, email?: string, password?: string) => Promise<boolean>
  signInWithBiometric: () => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
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
      const saved = await SecureStore.getItemAsync(BIO_CREDS_KEY)
      setState(s => ({
        ...s,
        biometricAvailable: compatible && enrolled,
        biometricEnabled: !!(compatible && enrolled && saved),
      }))
    } catch {
      setState(s => ({ ...s, biometricAvailable: false, biometricEnabled: false }))
    }
  }

  async function fetchProfile(session: Session, checkDeactivation = true) {
    const { data } = await supabase
      .from('users')
      .select('id, name, phone, email, role, is_active, avatar_url, vehicle_type, vehicle_number, fcm_token')
      .eq('id', session.user.id)
      .single()

    if (checkDeactivation) {
      if (!data || data.role !== 'driver' || data.is_active === false) {
        await supabase.auth.signOut()
        setState(s => ({ ...s, session: null, profile: null, loading: false }))
        return
      }
    }

    setState(s => ({
      ...s,
      session,
      profile: data as User,
      loading: false,
    }))

    if (data) registerPushToken(data.id)
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
        projectId: '9f91156d-9d01-4151-ac7c-31ad246b5aae',
      })
      const token = tokenData.data
      await supabase.from('users').update({ fcm_token: token }).eq('id', userId)
    } catch {}
  }

  async function signInWithOtp(email: string) {
    const { error } = await supabase.auth.signInWithOtp({ email })
    return { error: error?.message ?? null }
  }

  async function verifyOtp(email: string, token: string) {
    const { error, data } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
    if (error) return { error: error.message }

    if (data.user) {
      const { data: profile } = await supabase.from('users').select('is_active, role').eq('id', data.user.id).single()
      if (profile && profile.role !== 'driver') {
        await supabase.auth.signOut()
        return { error: 'هذا الحساب غير مسجل كسائق' }
      }
      if (profile && profile.is_active === false) {
        await supabase.auth.signOut()
        return { error: 'تم تعطيل حسابك — تواصل مع الإدارة' }
      }
    }

    return { error: null }
  }

  async function signInWithPassword(identifier: string, password: string) {
    const isPhone = /^01[0-9]{9}$/.test(identifier.trim())
    let loginEmail = identifier
    if (isPhone) {
      const { data: user } = await supabase.from('users').select('email').eq('phone', identifier.trim()).single()
      if (!user?.email) return { error: 'رقم التليفون غير مسجل' }
      loginEmail = user.email
    }
    const { error, data } = await supabase.auth.signInWithPassword({ email: loginEmail, password })
    if (error) return { error: error.message }

    if (data.user) {
      const { data: profile } = await supabase.from('users').select('is_active, role').eq('id', data.user.id).single()
      if (profile && profile.role !== 'driver') {
        await supabase.auth.signOut()
        return { error: 'هذا الحساب غير مسجل كسائق' }
      }
      if (profile && profile.is_active === false) {
        await supabase.auth.signOut()
        return { error: 'تم تعطيل حسابك — تواصل مع الإدارة' }
      }
    }

    return { error: null }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setState(s => ({ ...s, session: null, profile: null, loading: false }))
  }

  async function refreshProfile() {
    if (state.session) {
      await fetchProfile(state.session, false)
    }
  }

  async function toggleBiometric(enable: boolean, email?: string, password?: string): Promise<boolean> {
    if (enable) {
      if (!email || !password) return false
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) return false
        await SecureStore.setItemAsync(BIO_CREDS_KEY, JSON.stringify({ email, password }))
        setState(s => ({ ...s, biometricEnabled: true }))
        return true
      } catch {
        return false
      }
    } else {
      try {
        await SecureStore.deleteItemAsync(BIO_CREDS_KEY)
        setState(s => ({ ...s, biometricEnabled: false }))
        return true
      } catch {
        return false
      }
    }
  }

  async function signInWithBiometric(): Promise<{ error: string | null }> {
    try {
      const savedRaw = await SecureStore.getItemAsync(BIO_CREDS_KEY)
      if (!savedRaw) return { error: 'البصمة غير مفعّلة' }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'سجّل دخول بالبصمة',
        cancelLabel: 'إلغاء',
        disableDeviceFallback: false,
      })

      if (!result.success) return { error: 'فشل التحقق بالبصمة' }

      const { email, password } = JSON.parse(savedRaw)
      return signInWithPassword(email, password)
    } catch {
      return { error: 'حدث خطأ أثناء التحقق بالبصمة' }
    }
  }

  return (
    <AuthContext.Provider value={{
      ...state, signInWithOtp, verifyOtp, signInWithPassword,
      signOut, refreshProfile, toggleBiometric, signInWithBiometric,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
