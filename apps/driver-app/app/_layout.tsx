import { Slot } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { I18nManager } from 'react-native'
import { AuthProvider, useAuth } from '../src/contexts/AuthContext'
import { useNotifications } from '../src/hooks/useNotifications'

I18nManager.allowRTL(true)
I18nManager.forceRTL(true)

function NotificationSetup() {
  const { profile } = useAuth()
  useNotifications(profile?.id)
  return null
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <NotificationSetup />
      <StatusBar style="dark" />
      <Slot />
    </AuthProvider>
  )
}
