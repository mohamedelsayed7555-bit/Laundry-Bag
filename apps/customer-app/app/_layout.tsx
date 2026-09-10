import { Component, type ReactNode } from 'react'
import { Slot } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { I18nManager, View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { AuthProvider, useAuth } from '../src/contexts/AuthContext'
import { CartProvider } from '../src/contexts/CartContext'
import { ThemeProvider, useTheme } from '../src/contexts/ThemeContext'
import { LanguageProvider } from '../src/contexts/LanguageContext'
import { useNotifications } from '../src/hooks/useNotifications'
import { colors } from '../src/theme'

I18nManager.allowRTL(true)
I18nManager.forceRTL(true)

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
  container: { flex: 1, backgroundColor: colors.navy[900], justifyContent: 'center', alignItems: 'center', padding: 40 },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 8 },
  message: { fontSize: 14, color: colors.navy[300], marginBottom: 24 },
  btn: { backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})

function NotificationSetup() {
  const { profile } = useAuth()
  useNotifications(profile?.id)
  return null
}

function ThemedStatusBar() {
  const { isDark } = useTheme()
  return <StatusBar style={isDark ? 'light' : 'dark'} />
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <CartProvider>
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
