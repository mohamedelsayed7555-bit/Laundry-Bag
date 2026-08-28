import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, Image } from 'react-native'
import { useAuth } from '../../src/contexts/AuthContext'
import { colors } from '../../src/theme'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { signInWithPassword } = useAuth()

  const handleLogin = async () => {
    if (!email.includes('@')) { Alert.alert('خطأ', 'أدخل بريد إلكتروني صحيح'); return }
    if (!password) { Alert.alert('خطأ', 'أدخل كلمة المرور'); return }
    setLoading(true)
    const { error } = await signInWithPassword(email, password)
    setLoading(false)
    if (error) Alert.alert('خطأ', error)
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.content}>
        <View style={s.header}>
          <Image source={require('../../assets/logo.png')} style={s.logoImage} resizeMode="contain" />
          <Text style={s.logo}>Laundry Bag</Text>
          <View style={s.badge}>
            <Text style={s.badgeText}>تطبيق السائق</Text>
          </View>
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
          />

          <Text style={s.label}>كلمة المرور</Text>
          <TextInput
            style={s.input}
            placeholder="••••••••"
            placeholderTextColor={colors.navy[300]}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textAlign="left"
          />

          <TouchableOpacity style={[s.button, loading && s.buttonDisabled]} onPress={handleLogin} disabled={loading}>
            <Text style={s.buttonText}>{loading ? 'جاري الدخول...' : 'تسجيل دخول'}</Text>
          </TouchableOpacity>

          <Text style={s.hint}>يتم إنشاء حسابك بواسطة الإدارة فقط</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900] },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  header: { alignItems: 'center', marginBottom: 48 },
  logoImage: { width: 120, height: 120, marginBottom: 16 },
  logo: { fontSize: 36, fontWeight: '800', color: '#fff', letterSpacing: 2 },
  badge: {
    backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 4, borderRadius: 12, marginTop: 10,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  form: { gap: 16 },
  label: { fontSize: 14, fontWeight: '600', color: colors.navy[100], textAlign: 'right' },
  input: {
    borderWidth: 1, borderColor: colors.navy[500], borderRadius: 14,
    padding: 16, fontSize: 18, backgroundColor: colors.navy[800], color: '#fff',
  },
  button: {
    backgroundColor: colors.primary, borderRadius: 14, padding: 16, alignItems: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  hint: { fontSize: 12, color: colors.navy[400], textAlign: 'center', marginTop: 4 },
})
