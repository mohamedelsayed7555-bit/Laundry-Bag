import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useRealtimeDriverOrders(driverId: string | undefined, onUpdate: () => void) {
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  const stableOnUpdate = useCallback(() => onUpdateRef.current(), [])

  useEffect(() => {
    if (!driverId) return

    const channel = supabase
      .channel('driver-orders')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          const isMyOrder = payload.new.driver_id === driverId
          const wasAssignedToMe = payload.new.driver_id === driverId && payload.old?.driver_id !== driverId

          // Sound / banner for new and delivery orders: NewOrderAlert (one place, no duplicates)
          const wasMine = payload.old?.driver_id === driverId
          if (wasAssignedToMe || (wasMine && !isMyOrder)) {
            stableOnUpdate()
            return
          }

          if (isMyOrder) {
            stableOnUpdate()
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          if (payload.new.driver_id === driverId) stableOnUpdate()
        }
      )
      .subscribe((status, err) => {
        if (err) console.warn('driver-orders realtime error:', err.message)
      })

    return () => { supabase.removeChannel(channel) }
  }, [driverId, stableOnUpdate])
}
