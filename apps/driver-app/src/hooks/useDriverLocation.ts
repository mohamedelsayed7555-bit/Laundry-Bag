import { useEffect, useRef } from 'react'
import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import { AppState } from 'react-native'
import { supabase } from '../lib/supabase'

const INTERVAL_MS = 15_000
const BG_TASK = 'driver-location-bg'

let _driverId: string | null = null

TaskManager.defineTask(BG_TASK, async ({ data, error }: any) => {
  if (error || !data?.locations?.length || !_driverId) return
  const loc = data.locations[data.locations.length - 1]
  try {
    await supabase.from('driver_locations').upsert({
      driver_id: _driverId,
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      heading: loc.coords.heading ?? null,
      updated_at: new Date().toISOString(),
    })
  } catch {}
})

export function useDriverLocation(driverId: string | undefined, hasActiveOrders: boolean) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!driverId || !hasActiveOrders) {
      stop()
      _driverId = null
      stopBackground()
      return
    }

    _driverId = driverId
    let mounted = true

    async function start() {
      const { status: fg } = await Location.requestForegroundPermissionsAsync()
      if (fg !== 'granted' || !mounted) return

      sendLocation(driverId!)
      intervalRef.current = setInterval(() => {
        if (AppState.currentState === 'active') {
          sendLocation(driverId!)
        }
      }, INTERVAL_MS)

      const { status: bg } = await Location.requestBackgroundPermissionsAsync()
      if (bg === 'granted') {
        const isRunning = await Location.hasStartedLocationUpdatesAsync(BG_TASK).catch(() => false)
        if (!isRunning) {
          await Location.startLocationUpdatesAsync(BG_TASK, {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: INTERVAL_MS,
            distanceInterval: 50,
            showsBackgroundLocationIndicator: true,
            foregroundService: {
              notificationTitle: 'Cleano — تتبع الموقع',
              notificationBody: 'جاري تحديث موقعك للعملاء',
              notificationColor: '#6366f1',
            },
          }).catch(() => {})
        }
      }
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

async function stopBackground() {
  const isRunning = await Location.hasStartedLocationUpdatesAsync(BG_TASK).catch(() => false)
  if (isRunning) {
    await Location.stopLocationUpdatesAsync(BG_TASK).catch(() => {})
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
