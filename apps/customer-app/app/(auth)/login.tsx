import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../src/contexts/AuthContext'
import { colors } from '../../src/theme'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const { signInWithOtp } = useAuth()
  const router = useRouter()

  const handleSendOtp = async () => {
    if (!email.includes('@')) { Alert.alert('خطأ', 'أدخل بريد إلكتروني صحيح'); return }
    setLoading(true)
    const { error } = await signInWithOtp(email)
    setLoading(false)
    if (error) { Alert.alert('خطأ', error); return }
    router.push({ pathname: '/(auth)/verify', params: { email } })
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.content}>
        <View style={s.logoBox}>
          <View style={s.logoIcon}>
            <Text style={s.logoIconText}>C</Text>
          </View>
          <Text style={s.logoText}>CLEANO</Text>
          <Text style={s.tagline}>غسيلك أسهل مع كلينو</Text>
          <Text style={s.taglineSub}>خدمة غسيل وكي الملابس{'\n'}توصيل سريع وذكي</Text>
        </View>

        <View style={s.form}>
          <Text style={s.label}>البريد الإلكتروني</Text>
          <TextInput
            style={s.input}
            placeholder="example@email.com"
            placeholderTextColor={colors.navy[300]}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            textAlign="left"
            dir="ltr"
          />

          <TouchableOpacity
            style={[s.button, loading && s.buttonDisabled]}
            onPress={handleSendOtp}
            disabled={loading}
          >
            <Text style={s.buttonText}>{loading ? 'جاري الإرسال...' : 'تسجيل دخول'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.secondaryBtn}>
            <Text style={s.secondaryBtnText}>إنشاء حساب</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900] },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  logoBox: { alignItems: 'center', marginBottom: 48 },
  logoIcon: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center',
    marginBottom: 16, shadowColor: colors.accent, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 12,
  },
  logoIconText: { fontSize: 32, fontWeight: '900', color: '#fff' },
  logoText: { fontSize: 36, fontWeight: '800', color: '#fff', letterSpacing: 2 },
  tagline: { fontSize: 16, color: colors.gray[300], marginTop: 8 },
  taglineSub: { fontSize: 13, color: colors.navy[300], marginTop: 4, textAlign: 'center', lineHeight: 20 },
  form: { gap: 16 },
  label: { fontSize: 14, fontWeight: '600', color: colors.navy[100], textAlign: 'right' },
  input: {
    borderWidth: 1, borderColor: colors.navy[500], borderRadius: 14,
    padding: 16, fontSize: 18, backgroundColor: colors.navy[800], color: '#fff',
  },
  button: {
    backgroundColor: colors.primary, borderRadius: 14, padding: 16, alignItems: 'center',
    marginTop: 4, shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  secondaryBtn: {
    borderWidth: 1.5, borderColor: colors.accent, borderRadius: 14,
    padding: 16, alignItems: 'center',
  },
  secondaryBtnText: { color: colors.accent, fontSize: 18, fontWeight: '700' },
})
