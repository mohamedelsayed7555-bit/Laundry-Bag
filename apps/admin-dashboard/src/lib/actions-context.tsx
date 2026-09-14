'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

interface ActionCounts {
  pendingPayments: number
  pendingRefunds: number
  unassignedOrders: number
  pendingSubPayments: number
  total: number
}

const defaultCounts: ActionCounts = { pendingPayments: 0, pendingRefunds: 0, unassignedOrders: 0, pendingSubPayments: 0, total: 0 }

const ActionsContext = createContext<{ counts: ActionCounts; refresh: () => void }>({ counts: defaultCounts, refresh: () => {} })

export function ActionsProvider({ children }: { children: ReactNode }) {
  const [counts, setCounts] = useState<ActionCounts>(defaultCounts)

  const refresh = useCallback(async () => {
    const { data } = await supabase.rpc('get_pending_actions')
    if (data) {
      const d = data as any
      const c: ActionCounts = {
        pendingPayments: Number(d.pending_payments) || 0,
        pendingRefunds: Number(d.pending_refunds) || 0,
        unassignedOrders: Number(d.unassigned_orders) || 0,
        pendingSubPayments: Number(d.pending_sub_payments) || 0,
        total: 0,
      }
      c.total = c.pendingPayments + c.pendingRefunds + c.unassignedOrders + c.pendingSubPayments
      setCounts(c)
    }
  }, [])

  useEffect(() => {
    refresh()
    const ch = supabase.channel('actions-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, () => refresh())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [refresh])

  return <ActionsContext.Provider value={{ counts, refresh }}>{children}</ActionsContext.Provider>
}

export function useActions() { return useContext(ActionsContext) }
