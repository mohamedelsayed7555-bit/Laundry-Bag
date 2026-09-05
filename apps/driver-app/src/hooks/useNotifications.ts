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
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: 'new_order.wav',
      bypassDnd: true,
    })
    await Notifications.setNotificationChannelAsync('order-updates', {
      name: 'تحديثات الطلبات',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00af5f',
      sound: 'order_update.wav',
    })
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'الرسائل',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 300, 150, 300],
      lightColor: '#00af5f',
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: 'new_order.wav',
      bypassDnd: true,
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

export async function sendLocalNotification(title: string, body: string, channelId = 'order-updates') {
  const soundFile = channelId === 'new-order' || channelId === 'messages' ? 'new_order.wav' : 'order_update.wav'
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: Platform.OS === 'android' ? soundFile : true,
      priority: Notifications.AndroidNotificationPriority.MAX,
    },
    trigger: null,
    ...(Platform.OS === 'android' ? { channelId } : {}),
  })
}

const soundFiles: Record<string, any> = {
  'new-order': require('../../assets/sounds/new_order.wav'),
  'order-update': require('../../assets/sounds/order_update.wav'),
}

export async function playNotificationSound(type: 'new-order' | 'order-update' = 'new-order') {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    })
    const { sound } = await Audio.Sound.createAsync(soundFiles[type], { volume: 1.0 })
    await sound.playAsync()
    sound.setOnPlaybackStatusUpdate((status) => {
      if ('didJustFinish' in status && status.didJustFinish) {
        sound.unloadAsync()
      }
    })
  } catch {}
}
