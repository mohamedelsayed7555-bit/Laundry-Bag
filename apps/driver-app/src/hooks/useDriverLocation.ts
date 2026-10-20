import { useEffect, useRef } from 'react'
import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import * as SecureStore from 'expo-secure-store'
import { Alert, AppState } from 'react-native'
import { supabase } from '../lib/supabase'

const DISCLOSURE_KEY = 'bg_location_disclosure_v1'

// Google Play requires a prominent disclosure shown BEFORE the background-location
// prompt: it must say what is collected, that collection continues while the app is
// closed, and why. Submitting with ACCESS_BACKGROUND_LOCATION and no such screen is
// one of the most common rejection reasons. Answering "no" here leaves foreground
// tracking working — the driver can still use the app.
async function acceptedBackgroundDisclosure(): Promise<boolean> {
  try {
    if (await SecureStore.getItemAsync(DISCLOSURE_KEY) === 'yes') return true
  } catch {}

  const accepted = await new Promise<boolean>(resolve => {
    Alert.alert(
      'تتبّع الموقع أثناء التوصيل',
      'يجمع هذا التطبيق بيانات موقعك لعرض موقعك المباشر للعميل أثناء توصيل طلبه، '
      + 'وذلك حتى عندما يكون التطبيق مغلقًا أو غير مستخدم.\n\n'
      + 'لا يتم تتبّع موقعك إلا أثناء وجود طلب نشط لديك، ويتوقف التتبّع تلقائيًا بعد تسليم الطلب.',
      [
        { text: 'لا أوافق', style: 'cancel', onPress: () => resolve(false) },
        { text: 'أوافق', onPress: () => resolve(true) },
      ],
      { cancelable: false },
    )
  })

  if (accepted) {
    try { await SecureStore.setItemAsync(DISCLOSURE_KEY, 'yes') } catch {}
  }
  return accepted
}

const INTERVAL_MS = 15_000
const BG_TASK = 'driver-location-bg'

let _driverId: string | null = null

TaskManager.defineTask(BG_TASK, async ({ data, error }: any) => {
  if (error || !data?.locations?.length) return
  // Android may restart this task without the app UI (module state lost): use the saved session.
  let driverId = _driverId
  if (!driverId) {
    try { driverId = (await supabase.auth.getSession()).data.session?.user.id ?? null } catch {}
  }
  if (!driverId) return
  const loc = data.locations[data.locations.length - 1]
  try {
    await supabase.from('driver_locations').upsert({
      driver_id: driverId,
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

      // Disclosure first, then the OS prompt — never the other way round.
      if (!(await acceptedBackgroundDisclosure()) || !mounted) return

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
