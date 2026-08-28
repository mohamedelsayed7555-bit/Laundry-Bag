import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Session } from '@supabase/supabase-js'
import type { User } from '../shared/types'

interface AuthState {
  session: Session | null
  profile: User | null
  loading: boolean
}

interface AuthContextType extends AuthState {
  signInWithOtp: (email: string) => Promise<{ error: string | null }>
  verifyOtp: (email: string, token: string) => Promise<{ error: string | null }>
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, name: string, phone: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    profile: null,
    loading: true,
  })

  useEffect(() => {
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
        setState({ session: null, profile: null, loading: false })
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(session: Session) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (data && data.is_active === false) {
      await supabase.auth.signOut()
      setState({ session: null, profile: null, loading: false })
      return
    }

    setState({
      session,
      profile: data as User | null,
      loading: false,
    })
  }

  async function signInWithOtp(email: string) {
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
    return { error: error?.message ?? null }
  }

  async function verifyOtp(email: string, token: string) {
    const { error, data } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    })
    if (error) return { error: error.message }

    if (data.user) {
      const { data: profile } = await supabase.from('users').select('is_active').eq('id', data.user.id).single()
      if (profile && profile.is_active === false) {
        await supabase.auth.signOut()
        return { error: 'تم تعطيل حسابك — تواصل مع الإدارة' }
      }
    }

    return { error: null }
  }

  async function signInWithPassword(email: string, password: string) {
    const { error, data } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }

    if (data.user) {
      const { data: profile } = await supabase.from('users').select('is_active').eq('id', data.user.id).single()
      if (profile && profile.is_active === false) {
        await supabase.auth.signOut()
        return { error: 'تم تعطيل حسابك — تواصل مع الإدارة' }
      }
    }

    return { error: null }
  }

  async function signUp(email: string, password: string, name: string, phone: string) {
    const { error, data } = await supabase.auth.signUp({ email, password })
    if (error) return { error: error.message }

    if (data.user) {
      await supabase.from('users').upsert({
        id: data.user.id,
        email,
        name,
        phone,
        role: 'customer',
        is_active: true,
      })
    }

    return { error: null }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setState({ session: null, profile: null, loading: false })
  }

  async function refreshProfile() {
    if (state.session) {
      await fetchProfile(state.session)
    }
  }

  return (
    <AuthContext.Provider value={{ ...state, signInWithOtp, verifyOtp, signInWithPassword, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
