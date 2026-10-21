import { Component, useEffect, type ReactNode } from 'react'
import { Slot } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { I18nManager, View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { AuthProvider, useAuth } from '../src/contexts/AuthContext'
import { CartProvider } from '../src/contexts/CartContext'
import { ThemeProvider, useTheme } from '../src/contexts/ThemeContext'
import { LanguageProvider, useLanguage } from '../src/contexts/LanguageContext'
import { supabase } from '../src/lib/supabase'
import { useNotifications } from '../src/hooks/useNotifications'
import { colors } from '../src/theme'
import AsyncStorage from '@react-native-async-storage/async-storage'
import RNRestart from 'react-native-restart'
import { useFonts } from 'expo-font'
import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
} from '@expo-google-fonts/ibm-plex-sans-arabic'
import { Alexandria_600SemiBold, Alexandria_700Bold } from '@expo-google-fonts/alexandria'
import * as SplashScreen from 'expo-splash-screen'

// Keep the native splash up until fonts and the auth session are ready (index.tsx hides it),
// so the customer sees one screen instead of a flash of blank and placeholder screens.
SplashScreen.preventAutoHideAsync().catch(() => {})
SplashScreen.setOptions?.({ duration: 350, fade: true })
setTimeout(() => { SplashScreen.hideAsync().catch(() => {}) }, 5000)

AsyncStorage.getItem('@app_language').then(async saved => {
  const shouldBeRTL = saved !== 'en'
  I18nManager.allowRTL(shouldBeRTL)
  if (I18nManager.isRTL === shouldBeRTL) return

  // forceRTL only takes effect once the Activity is recreated, and this runs after the
  // first render — so the very first launch after install showed Arabic text inside a
  // left-to-right layout until the customer killed the app and reopened it.
  I18nManager.forceRTL(shouldBeRTL)

  // A device that refuses to persist the flag would otherwise restart for ever, so the
  // restart is attempted once per direction. If it does not take, the app simply carries
  // on as it did before — one wrong-looking launch, never a loop.
  const key = `@rtl_restart_${shouldBeRTL ? 'rtl' : 'ltr'}`
  const alreadyTried = await AsyncStorage.getItem(key).catch(() => '1')
  if (alreadyTried || __DEV__) return
  await AsyncStorage.setItem(key, '1').catch(() => {})
  RNRestart.restart()
}).catch(() => {
  I18nManager.allowRTL(true)
  I18nManager.forceRTL(true)
})

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false, errorMsg: '' }
  static getDerivedStateFromError(error: Error) { return { hasError: true, errorMsg: error?.message || 'Unknown error' } }
  componentDidCatch(error: Error, info: any) { console.error('ErrorBoundary caught:', error?.message, info?.componentStack) }
  render() {
    if (this.state.hasError) {
      return (
        <View style={ebStyles.container}>
          <Text style={ebStyles.icon}>⚠️</Text>
          <Text style={ebStyles.title}>حدث خطأ غير متوقع</Text>
          <Text style={ebStyles.message}>{this.state.errorMsg}</Text>
          <TouchableOpacity style={ebStyles.btn} onPress={() => this.setState({ hasError: false })}>
            <Text style={ebStyles.btnText}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      )
    }
    return this.props.children
  }
}

const ebStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A1222', justifyContent: 'center', alignItems: 'center', padding: 40 },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 8 },
  message: { fontSize: 14, color: '#8A9BB4', marginBottom: 24 },
  btn: { backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})

function NotificationSetup() {
  const { profile } = useAuth()
  const { locale } = useLanguage()
  useNotifications(profile?.id)

  // Server-sent notifications use this language. Debounced: the saved language loads a moment after start.
  useEffect(() => {
    if (!profile?.id) return
    const id = setTimeout(() => {
      supabase.from('users').update({ preferred_language: locale }).eq('id', profile.id).then(() => {})
    }, 1500)
    return () => clearTimeout(id)
  }, [profile?.id, locale])
  return null
}

function SplashGate() {
  const { loading } = useAuth()
  useEffect(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => {})
  }, [loading])
  return null
}

function ThemedStatusBar() {
  const { isDark } = useTheme()
  return <StatusBar style={isDark ? 'light' : 'dark'} />
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
    Alexandria_600SemiBold,
    Alexandria_700Bold,
  })

  // The native splash is still showing here. If fonts fail, the app still opens with system fonts.
  if (!fontsLoaded && !fontError) {
    return null
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <CartProvider>
                <SplashGate />
                <NotificationSetup />
                <ThemedStatusBar />
                <Slot />
              </CartProvider>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  )
}
