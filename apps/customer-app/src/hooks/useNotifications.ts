import { useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Audio } from 'expo-av'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'

// Android fixes a channel's sound when the channel is first created, so the channels that carry the
// custom sounds use new ids (the old silent-default ones are removed). Push senders must use these ids.
export const CHANNELS = {
  'order-updates': 'order-updates-v2',
  'order-placed': 'order-placed-v2',
  'messages': 'messages-v2',
  'offers': 'offers-v1',
} as const
type ChannelKey = keyof typeof CHANNELS

const CHANNEL_SOUND: Record<ChannelKey, string> = {
  'order-updates': 'order_update.wav',
  'order-placed': 'order_placed.wav',
  'messages': 'message.wav',
  'offers': 'offer.wav',
}

// ── De-duplication ──
// The same event can reach us several times: realtime listeners on more than one mounted screen,
// plus the push sent by the dashboard/driver. Only the first one within the window is shown.
const seen = new Map<string, number>()
function gate(key: string, windowMs: number) {
  const now = Date.now()
  const last = seen.get(key)
  if (last != null && now - last < windowMs) return false
  seen.set(key, now)
  if (seen.size > 300) for (const [k, v] of seen) if (now - v > 10 * 60_000) seen.delete(k)
  return true
}
const ORDER_WINDOW = 10 * 60_000
const CHAT_WINDOW = 3_000

// The chat screen currently open (its messages only get a soft in-chat sound, no banner).
let activeChatOrderId: string | null = null
export function setActiveChat(orderId: string | null) {
  activeChatOrderId = orderId
}

const HIDE = { shouldShowAlert: false, shouldPlaySound: false, shouldSetBadge: false }
const SHOW = { shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true }

Notifications.setNotificationHandler({
  handleNotification: async (n) => {
    const d: any = n.request.content.data ?? {}
    if (!d.local) {
      // A push that arrives while the app is open: realtime has usually notified already.
      if (d.type === 'order_update' && d.order_id && d.status && !gate(`order:${d.order_id}:${d.status}`, ORDER_WINDOW)) return HIDE
      if (d.type === 'chat' && d.order_id && (activeChatOrderId === d.order_id || !gate(`chat:${d.order_id}`, CHAT_WINDOW))) return HIDE
    }
    return SHOW
  },
})

function openFromNotification(d: any) {
  if (d?.type === 'broadcast') { router.push('/notifications'); return }
  if (d?.type === 'subscription') { router.push('/plans'); return }
  if (!d?.order_id) return
  if (d.type === 'chat') router.push(`/chat/${d.order_id}`)
  else router.push(`/order/${d.order_id}`)
}

export function useNotifications(userId?: string) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null)
  const responseListener = useRef<Notifications.Subscription>()

  useEffect(() => {
    registerForPushNotifications().then(token => {
      if (token) {
        setExpoPushToken(token)
        if (userId) {
          supabase.from('users').update({ fcm_token: token }).eq('id', userId)
            .then(({ error }) => { if (error) console.warn('Token save failed:', error.message) })
        }
      }
    })

    if (!userId) return

    // Tapping a notification opens the order / chat it is about.
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      openFromNotification(response.notification.request.content.data)
    })

    // App launched from a notification tap (only a recent one, so an old tap is never replayed).
    const coldStart = setTimeout(() => {
      Notifications.getLastNotificationResponseAsync().then(response => {
        if (response && Date.now() - response.notification.date < 2 * 60_000 && gate(`open:${response.notification.request.identifier}`, ORDER_WINDOW)) {
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
    for (const old of ['order-updates', 'order-placed', 'messages']) {
      await Notifications.deleteNotificationChannelAsync(old).catch(() => {})
    }
    await Notifications.setNotificationChannelAsync(CHANNELS['order-updates'], {
      name: 'تحديثات الطلبات',
      importance: Notifications.AndroidImportance.MAX,
      sound: CHANNEL_SOUND['order-updates'],
      vibrationPattern: [0, 300, 150, 300],
      lightColor: '#0ea5e9',
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    })
    await Notifications.setNotificationChannelAsync(CHANNELS['order-placed'], {
      name: 'تأكيد الطلب',
      importance: Notifications.AndroidImportance.HIGH,
      sound: CHANNEL_SOUND['order-placed'],
      vibrationPattern: [0, 200, 100, 200],
      lightColor: '#0ea5e9',
    })
    await Notifications.setNotificationChannelAsync(CHANNELS['messages'], {
      name: 'الرسائل',
      importance: Notifications.AndroidImportance.MAX,
      sound: CHANNEL_SOUND['messages'],
      vibrationPattern: [0, 180, 120, 180],
      lightColor: '#0ea5e9',
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    })
    // Offers/announcements from the dashboard: own channel so customers can mute them without muting their orders.
    await Notifications.setNotificationChannelAsync(CHANNELS['offers'], {
      name: 'العروض والإعلانات',
      importance: Notifications.AndroidImportance.HIGH,
      sound: CHANNEL_SOUND['offers'],
      vibrationPattern: [0, 150, 100, 150],
      lightColor: '#0ea5e9',
      showBadge: true,
    })
    await Notifications.setNotificationChannelAsync('default', {
      name: 'CLEANO',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0ea5e9',
    })
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: '278296f6-7a0c-4237-97ae-326fab30b0c6',
  })
  return tokenData.data
}

export async function sendLocalNotification(title: string, body: string, channel: ChannelKey = 'order-updates', data: Record<string, unknown> = {}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: CHANNEL_SOUND[channel],          // iOS; on Android the channel plays it
      data: { ...data, local: true },
    },
    trigger: Platform.OS === 'android' ? { channelId: CHANNELS[channel] } : null,
  })
}

/** Order status changed (called by every realtime listener; shown once). */
export function notifyOrderStatus(orderId: string, status: string, title: string, body: string) {
  if (!gate(`order:${orderId}:${status}`, ORDER_WINDOW)) return
  sendLocalNotification(title, body, 'order-updates', { type: 'order_update', order_id: orderId, status }).catch(() => {})
}

/** New chat message for the customer (called from the messages tab and the chat screen; shown once). */
export function notifyMessage(msg: { id: string; order_id: string; body?: string | null }, title: string) {
  if (!gate(`msg:${msg.id}`, ORDER_WINDOW)) return
  if (activeChatOrderId === msg.order_id) {
    // Already looking at this conversation: just a soft "pop", like WhatsApp.
    seen.set(`chat:${msg.order_id}`, Date.now())
    playNotificationSound('message', 0.5)
    return
  }
  if (!gate(`chat:${msg.order_id}`, CHAT_WINDOW)) return
  sendLocalNotification(title, msg.body ?? '', 'messages', { type: 'chat', order_id: msg.order_id }).catch(() => {})
}

const soundFiles: Record<string, any> = {
  'order-update': require('../../assets/sounds/order_update.wav'),
  'order-placed': require('../../assets/sounds/order_placed.wav'),
  'message': require('../../assets/sounds/message.wav'),
}

/** In-app sound only (no notification), e.g. after placing an order. */
export async function playNotificationSound(type: 'order-update' | 'order-placed' | 'message' = 'order-update', volume = 1.0) {
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
