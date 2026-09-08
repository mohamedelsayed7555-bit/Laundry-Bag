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
  'customers.view', 'customers.create', 'customers.edit', 'customers.delete',
  'drivers.view', 'drivers.create', 'drivers.edit', 'drivers.delete',
  'prices.view', 'prices.create', 'prices.edit', 'prices.delete',
  'plans.view', 'plans.create', 'plans.edit', 'plans.delete',
  'subscriptions.view', 'subscriptions.create', 'subscriptions.edit', 'subscriptions.delete',
  'branches.view', 'branches.create', 'branches.edit', 'branches.delete',
  'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.delete',
  'finance.view', 'finance.edit', 'finance.export',
  'reports.view', 'reports.export',
  'settings.view', 'settings.edit',
  'users.view', 'users.create', 'users.edit', 'users.delete',
  'notifications.view', 'notifications.create', 'notifications.delete',
  'ratings.view', 'ratings.delete',
  'audit.view',
]

const PERMISSION_IMPLIES: Record<string, string[]> = {
  'plans.manage': ['plans.view', 'plans.create', 'plans.edit', 'plans.delete', 'subscriptions.view', 'subscriptions.create', 'subscriptions.edit', 'subscriptions.delete'],
  'users.manage': ['users.view', 'users.create', 'users.edit', 'users.delete'],
  'finance.view': ['prices.view'],
  'finance.edit': ['prices.edit', 'prices.create', 'prices.delete'],
  'settings.view': ['branches.view', 'inventory.view'],
  'settings.edit': ['branches.create', 'branches.edit', 'branches.delete', 'inventory.create', 'inventory.edit', 'inventory.delete'],
  'customers.view': ['notifications.view'],
  'customers.edit': ['notifications.create', 'notifications.delete'],
  'orders.view': ['ratings.view'],
  'orders.delete': ['ratings.delete'],
}

const ROLE_DEFAULTS: Record<string, string[]> = {
  super_admin: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS,
  manager: [
    'orders.view', 'orders.create', 'orders.edit', 'orders.assign',
    'customers.view', 'customers.create', 'customers.edit',
    'drivers.view', 'drivers.create', 'drivers.edit',
    'prices.view',
    'branches.view',
    'inventory.view',
    'subscriptions.view',
    'notifications.view', 'notifications.create',
    'ratings.view',
    'reports.view',
    'finance.view',
  ],
  accountant: [
    'orders.view',
    'customers.view',
    'finance.view', 'finance.edit', 'finance.export',
    'prices.view', 'prices.edit',
    'reports.view', 'reports.export',
    'subscriptions.view',
  ],
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
    if (user.permissions.includes(permission)) return true
    for (const [legacy, implied] of Object.entries(PERMISSION_IMPLIES)) {
      if (user.permissions.includes(legacy) && implied.includes(permission)) return true
    }
    return false
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
  '/branches': 'branches.view',
  '/prices': 'prices.view',
  '/plans': 'plans.view',
  '/subscriptions': 'subscriptions.view',
  '/finance': 'finance.view',
  '/inventory': 'inventory.view',
  '/reports': 'reports.view',
  '/audit': 'audit.view',
  '/settings': 'settings.view',
  '/notifications': 'notifications.view',
  '/ratings': 'ratings.view',
}
