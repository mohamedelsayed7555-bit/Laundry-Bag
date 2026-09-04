import { useEffect, useRef, useState } from 'react'
import { Platform, Alert } from 'react-native'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Audio } from 'expo-av'
import { supabase } from '../lib/supabase'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export function useNotifications(userId?: string) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null)
  const notificationListener = useRef<Notifications.Subscription>()
  const responseListener = useRef<Notifications.Subscription>()

  useEffect(() => {
    registerForPushNotifications().then(token => {
      if (token) {
        setExpoPushToken(token)
        if (userId) {
          supabase.from('users').update({ fcm_token: token }).eq('id', userId)
        }
      }
    })

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      // Notification received while app is in foreground
    })

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      // User tapped on notification
    })

    return () => {
      if (notificationListener.current) Notifications.removeNotificationSubscription(notificationListener.current)
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
    await Notifications.setNotificationChannelAsync('order-updates', {
      name: 'تحديثات الطلبات',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 300, 150, 300],
      lightColor: '#00af5f',
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    })
    await Notifications.setNotificationChannelAsync('order-placed', {
      name: 'تأكيد الطلب',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 100, 200],
      lightColor: '#00af5f',
    })
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'الرسائل',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 300, 150, 300],
      lightColor: '#00af5f',
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    })
    await Notifications.setNotificationChannelAsync('default', {
      name: 'CLEANO',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00af5f',
    })
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: '178256af-c74c-4880-9722-8d30ba1e3e8b',
  })
  return tokenData.data
}

export async function sendLocalNotification(title: string, body: string, channelId = 'order-updates') {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null,
    ...(Platform.OS === 'android' ? { channelId } : {}),
  })
}

const soundFiles: Record<string, any> = {
  'order-update': require('../../assets/sounds/order-update.wav'),
  'order-placed': require('../../assets/sounds/order-placed.wav'),
}

export async function playNotificationSound(type: 'order-update' | 'order-placed' = 'order-update') {
  try {
    const { sound } = await Audio.Sound.createAsync(soundFiles[type])
    await sound.playAsync()
    sound.setOnPlaybackStatusUpdate((status) => {
      if ('didJustFinish' in status && status.didJustFinish) {
        sound.unloadAsync()
      }
    })
  } catch {}
}
