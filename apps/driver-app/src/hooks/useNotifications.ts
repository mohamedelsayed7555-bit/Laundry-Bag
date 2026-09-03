import { useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
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

    notificationListener.current = Notifications.addNotificationReceivedListener(() => {})
    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {})

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
    await Notifications.setNotificationChannelAsync('new-order', {
      name: 'طلبات جديدة',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 200, 400, 200, 400],
      lightColor: '#00af5f',
      sound: 'new_order.wav',
    })
    await Notifications.setNotificationChannelAsync('order-updates', {
      name: 'تحديثات الطلبات',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00af5f',
      sound: 'order_update.wav',
    })
    await Notifications.setNotificationChannelAsync('default', {
      name: 'CLEANO Driver',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00af5f',
    })
  }

  const tokenData = await Notifications.getExpoPushTokenAsync()
  return tokenData.data
}

export async function sendLocalNotification(title: string, body: string, channelId = 'order-updates') {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true, ...(Platform.OS === 'android' ? {} : {}) },
    trigger: null,
    ...(Platform.OS === 'android' ? { channelId } : {}),
  })
}

const soundFiles: Record<string, any> = {
  'new-order': require('../../assets/sounds/new-order.wav'),
  'order-update': require('../../assets/sounds/order-update.wav'),
}

export async function playNotificationSound(type: 'new-order' | 'order-update' = 'new-order') {
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
