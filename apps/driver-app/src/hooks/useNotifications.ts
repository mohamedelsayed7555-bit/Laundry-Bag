import { useEffect, useRef, useState } from 'react'
import { Platform, AppState } from 'react-native'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Audio } from 'expo-av'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'

// Android fixes a channel's sound when it is first created, so the channels with the new sounds use
// new ids (the old ones are removed). The database triggers send to these ids.
export const CHANNELS = {
  'new-order': 'new-order-v2',
  'order-updates': 'order-updates-v2',
  'messages': 'messages-v2',
} as const
type ChannelKey = keyof typeof CHANNELS

const CHANNEL_SOUND: Record<ChannelKey, string> = {
  'new-order': 'new_order.wav',
  'order-updates': 'order_update.wav',
  'messages': 'message.wav',
}

// ── De-duplication: the same event can arrive by realtime and by push ──
const seen = new Map<string, number>()
export function gate(key: string, windowMs: number) {
  const now = Date.now()
  const last = seen.get(key)
  if (last != null && now - last < windowMs) return false
  seen.set(key, now)
  if (seen.size > 300) for (const [k, v] of seen) if (now - v > 10 * 60_000) seen.delete(k)
  return true
}
export const ASSIGN_WINDOW = 10 * 60_000
const CHAT_WINDOW = 3_000

// In-app new-order banner (NewOrderAlert registers itself here)
type AssignHandler = (orderId: string, phase: 'pickup' | 'delivery') => void
let assignHandler: AssignHandler | null = null
export function setAssignHandler(h: AssignHandler | null) { assignHandler = h }

// Chat screen currently open (its messages only get a soft sound)
let activeChatOrderId: string | null = null
export function setActiveChat(orderId: string | null) { activeChatOrderId = orderId }

const HIDE = { shouldShowAlert: false, shouldPlaySound: false, shouldSetBadge: false }
const SHOW = { shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true }

Notifications.setNotificationHandler({
  handleNotification: async (n) => {
    const d: any = n.request.content.data ?? {}
    if (!d.local) {
      // App is open: show our own in-app banner instead of the system one.
      // Only swallow the push for our own banner when the app is really in front:
      // with the screen locked (or the app in the background) the driver must see the notification.
      if (d.type === 'new_order' && d.order_id && assignHandler && AppState.currentState === 'active') {
        assignHandler(d.order_id, d.phase === 'delivery' ? 'delivery' : 'pickup')
        return HIDE
      }
      if ((d.type === 'message' || d.type === 'chat') && d.order_id && AppState.currentState === 'active' && (activeChatOrderId === d.order_id || !gate(`chat:${d.order_id}`, CHAT_WINDOW))) return HIDE
    }
    return SHOW
  },
})

function openFromNotification(d: any) {
  if (!d?.order_id) return
  if (d.type === 'message' || d.type === 'chat') router.push(`/chat/${d.order_id}`)
  else router.push('/(tabs)/orders')
}

export function useNotifications(userId?: string) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null)
  const responseListener = useRef<Notifications.Subscription>()

  useEffect(() => {
    registerForPushNotifications().then(token => {
      if (token) {
        setExpoPushToken(token)
        if (userId) {
          // Also removes this device's token from any other account that signed in here before.
          supabase.rpc('claim_push_token', { p_token: token })
            .then(({ error }) => { if (error) console.warn('Token save failed:', error.message) })
        }
      }
    })

    if (!userId) return

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      openFromNotification(response.notification.request.content.data)
    })

    const coldStart = setTimeout(() => {
      Notifications.getLastNotificationResponseAsync().then(response => {
        if (response && Date.now() - response.notification.date < 2 * 60_000 && gate(`open:${response.notification.request.identifier}`, ASSIGN_WINDOW)) {
          openFromNotification(response.notification.request.content.data)
        }
      }).catch(() => {})
    }, 800)

    return () => {
      clearTimeout(coldStart)
      if (responseListener.current) Notifications.removeNotificationSubscription(responseListener.current)
    }
  }, [userId])

  return { expoPushToken }
}

async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null
  if (!Device.isDevice) return null

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== 'granted') return null

  if (Platform.OS === 'android') {
    for (const old of ['new-order', 'order-updates', 'messages']) {
      await Notifications.deleteNotificationChannelAsync(old).catch(() => {})
    }
    await Notifications.setNotificationChannelAsync(CHANNELS['new-order'], {
      name: 'طلبات جديدة',
      importance: Notifications.AndroidImportance.MAX,
      sound: CHANNEL_SOUND['new-order'],
      vibrationPattern: [0, 500, 200, 500, 200, 500],
      lightColor: '#00af5f',
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
    })
    await Notifications.setNotificationChannelAsync(CHANNELS['order-updates'], {
      name: 'تحديثات الطلبات',
      importance: Notifications.AndroidImportance.HIGH,
      sound: CHANNEL_SOUND['order-updates'],
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00af5f',
    })
    await Notifications.setNotificationChannelAsync(CHANNELS['messages'], {
      name: 'الرسائل',
      importance: Notifications.AndroidImportance.HIGH,
      sound: CHANNEL_SOUND['messages'],
      vibrationPattern: [0, 180, 120, 180],
      lightColor: '#00af5f',
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    })
    await Notifications.setNotificationChannelAsync('default', {
      name: 'CLEANO Driver',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00af5f',
    })
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: '9f91156d-9d01-4151-ac7c-31ad246b5aae',
  })
  return tokenData.data
}

export async function sendLocalNotification(title: string, body: string, channel: ChannelKey = 'order-updates', data: Record<string, unknown> = {}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: CHANNEL_SOUND[channel],
      priority: Notifications.AndroidNotificationPriority.MAX,
      data: { ...data, local: true },
    },
    trigger: Platform.OS === 'android' ? { channelId: CHANNELS[channel] } : null,
  })
}

/** New chat message (messages tab + chat screen both call this; shown once). */
export function notifyMessage(msg: { id: string; order_id: string; body?: string | null }) {
  if (!gate(`msg:${msg.id}`, ASSIGN_WINDOW)) return
  if (activeChatOrderId === msg.order_id) {
    seen.set(`chat:${msg.order_id}`, Date.now())
    playNotificationSound('message', 0.5)
    return
  }
  if (!gate(`chat:${msg.order_id}`, CHAT_WINDOW)) return
  sendLocalNotification('رسالة جديدة 💬', msg.body ?? '', 'messages', { type: 'message', order_id: msg.order_id }).catch(() => {})
}

const soundFiles: Record<string, any> = {
  'new-order': require('../../assets/sounds/new_order.wav'),
  'order-update': require('../../assets/sounds/order_update.wav'),
  'message': require('../../assets/sounds/message.wav'),
}

export async function playNotificationSound(type: 'new-order' | 'order-update' | 'message' = 'new-order', volume = 1.0) {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
    })
    const { sound } = await Audio.Sound.createAsync(soundFiles[type], { volume })
    await sound.playAsync()
    sound.setOnPlaybackStatusUpdate((status) => {
      if ('didJustFinish' in status && status.didJustFinish) {
        sound.unloadAsync().catch(() => {})
      }
    })
    setTimeout(() => { sound.unloadAsync().catch(() => {}) }, 10000)
  } catch {}
}
