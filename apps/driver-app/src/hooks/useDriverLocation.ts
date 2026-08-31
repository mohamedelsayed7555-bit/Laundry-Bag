import { useEffect, useRef } from 'react'
import * as Location from 'expo-location'
import { AppState } from 'react-native'
import { supabase } from '../lib/supabase'

const INTERVAL_MS = 15_000

export function useDriverLocation(driverId: string | undefined, hasActiveOrders: boolean) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!driverId || !hasActiveOrders) {
      stop()
      return
    }

    let mounted = true

    async function start() {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted' || !mounted) return

      sendLocation(driverId!)
      intervalRef.current = setInterval(() => {
        if (AppState.currentState === 'active') {
          sendLocation(driverId!)
        }
      }, INTERVAL_MS)
    }

    start()
    return () => { mounted = false; stop() }
  }, [driverId, hasActiveOrders])

  function stop() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }
}

async function sendLocation(driverId: string) {
  try {
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    })
    await supabase.from('driver_locations').upsert({
      driver_id: driverId,
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      heading: loc.coords.heading ?? null,
      updated_at: new Date().toISOString(),
    })
  } catch {}
}
