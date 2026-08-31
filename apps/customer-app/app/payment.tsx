import { useEffect, useState } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { WebView } from 'react-native-webview'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { colors } from '../src/theme'

export default function PaymentScreen() {
  const { url } = useLocalSearchParams<{ url: string }>()
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  const handleNavigationChange = (navState: { url: string }) => {
    if (navState.url.includes('success=true')) {
      router.replace('/(tabs)/orders')
    } else if (navState.url.includes('success=false')) {
      router.back()
    }
  }

  return (
    <View style={s.container}>
      {loading && (
        <View style={s.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
      {url && (
        <WebView
          source={{ uri: url }}
          style={s.webview}
          onLoadEnd={() => setLoading(false)}
          onNavigationStateChange={handleNavigationChange}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900] },
  loader: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  webview: { flex: 1 },
})
