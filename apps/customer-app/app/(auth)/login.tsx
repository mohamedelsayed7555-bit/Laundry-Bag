import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
  KeyboardAvoidingView, Platform, ScrollView, Image,
} from 'react-native'
import { useAuth } from '../../src/contexts/AuthContext'
import { colors } from '../../src/theme'

export default function LoginScreen() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const { signInWithPassword, signUp } = useAuth()

  const handleLogin = async () => {
    if (!email.includes('@')) { Alert.alert('خطأ', 'أدخل بريد إلكتروني صحيح'); return }
    if (password.length < 6) { Alert.alert('خطأ', 'كلمة المرور 6 أحرف على الأقل'); return }
    setLoading(true)
    const { error } = await signInWithPassword(email, password)
    setLoading(false)
    if (error) Alert.alert('خطأ', error)
  }

  const handleSignUp = async () => {
    if (!name.trim()) { Alert.alert('خطأ', 'أدخل الاسم'); return }
    if (!phone.trim()) { Alert.alert('خطأ', 'أدخل رقم التليفون'); return }
    if (!email.includes('@')) { Alert.alert('خطأ', 'أدخل بريد إلكتروني صحيح'); return }
    if (password.length < 6) { Alert.alert('خطأ', 'كلمة المرور 6 أحرف على الأقل'); return }
    setLoading(true)
    const { error } = await signUp(email, password, name.trim(), phone.trim())
    setLoading(false)
    if (error) {
      Alert.alert('خطأ', error)
    } else {
      Alert.alert('تم', 'تم إنشاء حسابك بنجاح! يمكنك تسجيل الدخول الآن', [
        { text: 'حسناً', onPress: () => setIsSignUp(false) },
      ])
    }
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.logoBox}>
          <Image source={require('../../assets/logo.png')} style={s.logoImage} resizeMode="contain" />
          <Text style={s.logoText}>Laundry Bag</Text>
          <Text style={s.tagline}>غسيلك في شنطة</Text>
          <Text style={s.taglineSub}>خدمة غسيل وكي الملابس{'\n'}توصيل سريع وذكي</Text>
        </View>

        {/* Tabs */}
        <View style={s.tabs}>
          <TouchableOpacity style={[s.tab, !isSignUp && s.tabActive]} onPress={() => setIsSignUp(false)}>
            <Text style={[s.tabText, !isSignUp && s.tabTextActive]}>تسجيل دخول</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tab, isSignUp && s.tabActive]} onPress={() => setIsSignUp(true)}>
            <Text style={[s.tabText, isSignUp && s.tabTextActive]}>حساب جديد</Text>
          </TouchableOpacity>
        </View>

        <View style={s.form}>
          {isSignUp && (
            <>
              <Text style={s.label}>الاسم الكامل</Text>
              <TextInput
                style={s.input}
                placeholder="محمد أحمد"
                placeholderTextColor={colors.navy[300]}
                value={name}
                onChangeText={setName}
                textAlign="right"
              />

              <Text style={s.label}>رقم التليفون</Text>
              <TextInput
                style={s.input}
                placeholder="01xxxxxxxxx"
                placeholderTextColor={colors.navy[300]}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                textAlign="left"
              />
            </>
          )}

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

          <TouchableOpacity
            style={[s.button, loading && s.buttonDisabled]}
            onPress={isSignUp ? handleSignUp : handleLogin}
            disabled={loading}
          >
            <Text style={s.buttonText}>
              {loading ? 'جاري التحميل...' : isSignUp ? 'إنشاء حساب' : 'تسجيل دخول'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
            <Text style={s.switchText}>
              {isSignUp ? 'عندك حساب؟ سجّل دخول' : 'مستخدم جديد؟ أنشئ حساب'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900] },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  logoBox: { alignItems: 'center', marginBottom: 36 },
  logoImage: { width: 120, height: 120, marginBottom: 16 },
  logoText: { fontSize: 36, fontWeight: '800', color: '#fff', letterSpacing: 2 },
  tagline: { fontSize: 16, color: colors.gray[300], marginTop: 8 },
  taglineSub: { fontSize: 13, color: colors.navy[300], marginTop: 4, textAlign: 'center', lineHeight: 20 },

  // Tabs
  tabs: {
    flexDirection: 'row', backgroundColor: colors.navy[800], borderRadius: 14,
    padding: 4, marginBottom: 24,
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 15, fontWeight: '600', color: colors.navy[300] },
  tabTextActive: { color: '#fff' },

  // Form
  form: { gap: 14 },
  label: { fontSize: 14, fontWeight: '600', color: colors.navy[100], textAlign: 'right' },
  input: {
    borderWidth: 1, borderColor: colors.navy[500], borderRadius: 14,
    padding: 16, fontSize: 18, backgroundColor: colors.navy[800], color: '#fff',
  },
  button: {
    backgroundColor: colors.primary, borderRadius: 14, padding: 16, alignItems: 'center',
    marginTop: 8, shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  switchText: {
    color: colors.accent, fontSize: 14, textAlign: 'center', marginTop: 8,
    textDecorationLine: 'underline',
  },
})
