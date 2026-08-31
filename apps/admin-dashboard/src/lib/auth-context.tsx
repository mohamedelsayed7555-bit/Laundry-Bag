'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface UserProfile {
  id: string
  name: string
  email: string
  role: string
  permissions: string[]
  is_active: boolean
  avatar_url: string | null
}

interface AuthContextType {
  user: UserProfile | null
  loading: boolean
  hasPermission: (permission: string) => boolean
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  hasPermission: () => false,
  refreshUser: async () => {},
})

const ALL_PERMISSIONS = [
  'orders.view', 'orders.create', 'orders.edit', 'orders.delete', 'orders.assign',
  'customers.view', 'customers.edit',
  'drivers.view', 'drivers.edit',
  'finance.view', 'finance.edit',
  'reports.view',
  'settings.view', 'settings.edit',
  'users.manage',
  'plans.manage',
  'audit.view',
]

const ROLE_DEFAULTS: Record<string, string[]> = {
  super_admin: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS,
  manager: ['orders.view', 'orders.create', 'orders.edit', 'orders.assign', 'customers.view', 'customers.edit', 'drivers.view', 'drivers.edit', 'reports.view', 'finance.view'],
  accountant: ['orders.view', 'finance.view', 'finance.edit', 'reports.view', 'customers.view'],
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadUser() {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) { setUser(null); setLoading(false); return }

    const { data: profile } = await supabase
      .from('users')
      .select('id, name, email, role, permissions, is_active, avatar_url')
      .eq('id', authUser.id)
      .single()

    if (profile) {
      setUser({
        ...profile,
        permissions: profile.permissions ?? ROLE_DEFAULTS[profile.role] ?? [],
      })
    }
    setLoading(false)
  }

  useEffect(() => {
    loadUser()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadUser()
    })
    return () => subscription.unsubscribe()
  }, [])

  function hasPermission(permission: string): boolean {
    if (!user) return false
    if (user.role === 'super_admin' || user.role === 'admin') return true
    return user.permissions.includes(permission)
  }

  return (
    <AuthContext.Provider value={{ user, loading, hasPermission, refreshUser: loadUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

export const ROUTE_PERMISSIONS: Record<string, string> = {
  '/orders': 'orders.view',
  '/customers': 'customers.view',
  '/drivers': 'drivers.view',
  '/branches': 'settings.view',
  '/prices': 'finance.view',
  '/plans': 'plans.manage',
  '/subscriptions': 'plans.manage',
  '/finance': 'finance.view',
  '/inventory': 'settings.view',
  '/reports': 'reports.view',
  '/audit': 'audit.view',
  '/settings': 'settings.view',
  '/notifications': 'customers.view',
}
