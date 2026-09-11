import { useState, useCallback } from 'react'
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native'
import { WebView } from 'react-native-webview'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTheme } from '../src/contexts/ThemeContext'
import { useLanguage } from '../src/contexts/LanguageContext'

type PaymentResult = 'pending' | 'success' | 'failed'

export default function PaymentScreen() {
  const { url } = useLocalSearchParams<{ url: string }>()
  const router = useRouter()
  const { colors } = useTheme()
  const { locale } = useLanguage()
  const isEn = locale === 'en'

  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<PaymentResult>('pending')

  const handleNavigationChange = useCallback((navState: { url: string }) => {
    const u = navState.url.toLowerCase()
    if (u.includes('success=true')) {
      setResult('success')
    } else if (u.includes('success=false')) {
      setResult('failed')
    }
  }, [])

  if (result === 'success') {
    return (
      <View style={[s.resultContainer, { backgroundColor: colors.navy[900] }]}>
        <View style={[s.resultCard, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }]}>
          <Text style={s.resultIcon}>✅</Text>
          <Text style={[s.resultTitle, { color: colors.text }]}>{isEn ? 'Payment Successful!' : 'تم الدفع بنجاح!'}</Text>
          <Text style={[s.resultDesc, { color: colors.navy[300] }]}>{isEn ? 'Your order is being processed' : 'جاري تجهيز طلبك'}</Text>
          <TouchableOpacity style={[s.resultBtn, { backgroundColor: colors.primary }]} onPress={() => router.replace('/(tabs)/orders')}>
            <Text style={s.resultBtnText}>{isEn ? 'View My Orders' : 'عرض طلباتي'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  if (result === 'failed') {
    return (
      <View style={[s.resultContainer, { backgroundColor: colors.navy[900] }]}>
        <View style={[s.resultCard, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }]}>
          <Text style={s.resultIcon}>❌</Text>
          <Text style={[s.resultTitle, { color: colors.text }]}>{isEn ? 'Payment Failed' : 'فشل الدفع'}</Text>
          <Text style={[s.resultDesc, { color: colors.navy[300] }]}>{isEn ? 'Please check your card details and try again' : 'تأكد من بيانات البطاقة وحاول مرة أخرى'}</Text>
          <TouchableOpacity style={[s.resultBtn, { backgroundColor: colors.primary }]} onPress={() => router.back()}>
            <Text style={s.resultBtnText}>{isEn ? 'Try Again' : 'حاول مرة أخرى'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.secondaryBtn} onPress={() => router.replace('/(tabs)/orders')}>
            <Text style={[s.secondaryBtnText, { color: colors.navy[300] }]}>{isEn ? 'Go to Orders' : 'الذهاب للطلبات'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={[s.container, { backgroundColor: colors.navy[900] }]}>
      {loading && (
        <View style={s.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[s.loadingText, { color: colors.navy[300] }]}>{isEn ? 'Loading payment page...' : 'جاري تحميل صفحة الدفع...'}</Text>
        </View>
      )}
      {url && (
        <WebView
          source={{ uri: url }}
          style={s.webview}
          onLoadEnd={() => setLoading(false)}
          onNavigationStateChange={handleNavigationChange}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={false}
          scalesPageToFit={true}
          allowsInlineMediaPlayback={true}
          mixedContentMode="compatibility"
          originWhitelist={['*']}
        />
      )}
      <TouchableOpacity style={[s.cancelBar, { backgroundColor: colors.navy[800] }]} onPress={() => router.back()}>
        <Text style={[s.cancelText, { color: colors.danger }]}>{isEn ? 'Cancel Payment' : 'إلغاء الدفع'}</Text>
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  loader: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 10, gap: 12 },
  loadingText: { fontSize: 14, marginTop: 8 },
  webview: { flex: 1 },
  cancelBar: { paddingVertical: 16, alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  cancelText: { fontSize: 15, fontWeight: '600' },
  resultContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  resultCard: { width: '100%', borderRadius: 24, padding: 32, alignItems: 'center', borderWidth: 1 },
  resultIcon: { fontSize: 56, marginBottom: 16 },
  resultTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  resultDesc: { fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  resultBtn: { width: '100%', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  resultBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { marginTop: 16, paddingVertical: 8 },
  secondaryBtnText: { fontSize: 14, fontWeight: '600' },
})
