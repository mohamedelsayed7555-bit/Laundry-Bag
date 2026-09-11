import { useState, useRef } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useAuth } from '../../src/contexts/AuthContext'
import { useCustomAlert } from '../../src/components/CustomAlert'
import { useTheme } from '../../src/contexts/ThemeContext'
import { useLanguage } from '../../src/contexts/LanguageContext'

const OTP_LENGTH = 6

export default function VerifyScreen() {
  const { colors } = useTheme()
  const { locale } = useLanguage()
  const isEn = locale === 'en'
  const s = getStyles(colors)
  const { email } = useLocalSearchParams<{ email: string }>()
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''))
  const [loading, setLoading] = useState(false)
  const inputs = useRef<(TextInput | null)[]>([])
  const { verifyOtp, signInWithOtp } = useAuth()
  const router = useRouter()
  const { showAlert, AlertComponent } = useCustomAlert()

  const handleChange = (text: string, index: number) => {
    const newOtp = [...otp]
    newOtp[index] = text
    setOtp(newOtp)
    if (text && index < OTP_LENGTH - 1) inputs.current[index + 1]?.focus()
    if (newOtp.every(d => d !== '')) handleVerify(newOtp.join(''))
  }

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) inputs.current[index - 1]?.focus()
  }

  const handleVerify = async (token: string) => {
    if (!email) return
    setLoading(true)
    const { error } = await verifyOtp(email, token)
    setLoading(false)
    if (error) {
      showAlert({ title: isEn ? 'Error' : 'خطأ', message: isEn ? 'Invalid verification code' : 'كود التفعيل غير صحيح', type: 'error' })
      setOtp(Array(OTP_LENGTH).fill(''))
      inputs.current[0]?.focus()
    }
  }

  const handleResend = async () => {
    if (!email) return
    const { error } = await signInWithOtp(email)
    showAlert({ title: error ? (isEn ? 'Error' : 'خطأ') : (isEn ? 'Done' : 'تم'), message: error ?? (isEn ? 'New code sent' : 'تم إرسال كود جديد'), type: error ? 'error' : 'success' })
  }

  return (
    <>
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.content}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>{isEn ? '← Back' : '← رجوع'}</Text>
        </TouchableOpacity>

        <Text style={s.title}>{isEn ? 'Verify Email' : 'تأكيد البريد الإلكتروني'}</Text>
        <Text style={s.subtitle}>{isEn ? `Enter the code sent to ${email}` : `أدخل الكود المرسل إلى ${email}`}</Text>

        <View style={s.otpRow}>
          {otp.map((digit, i) => (
            <TextInput
              key={i}
              ref={ref => { inputs.current[i] = ref }}
              style={[s.otpInput, digit ? s.otpFilled : null]}
              value={digit}
              onChangeText={text => handleChange(text, i)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
              autoFocus={i === 0}
            />
          ))}
        </View>

        {loading && <Text style={s.loadingText}>{isEn ? 'Verifying...' : 'جاري التحقق...'}</Text>}

        <TouchableOpacity onPress={handleResend} style={s.resendBtn}>
          <Text style={s.resendText}>{isEn ? 'Resend code' : 'إعادة إرسال الكود'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
    {AlertComponent}
    </>
  )
}

function getStyles(colors: any) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900] },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  backBtn: { position: 'absolute', top: 60, right: 24 },
  backText: { fontSize: 16, color: colors.primary },
  title: { fontSize: 28, fontWeight: 'bold', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.navy[200], textAlign: 'center', marginTop: 8, marginBottom: 32 },
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  otpInput: {
    width: 48, height: 56, borderWidth: 2, borderColor: colors.navy[500], borderRadius: 14,
    fontSize: 24, fontWeight: 'bold', color: colors.text, backgroundColor: colors.navy[800],
  },
  otpFilled: { borderColor: colors.primary, backgroundColor: colors.navy[700] },
  loadingText: { textAlign: 'center', color: colors.primary, marginTop: 16 },
  resendBtn: { marginTop: 32, alignItems: 'center' },
  resendText: { fontSize: 14, color: colors.accent, textDecorationLine: 'underline' },
}) }
