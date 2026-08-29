import { useState } from 'react'
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView, Animated } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../src/contexts/AuthContext'
import { supabase } from '../src/lib/supabase'
import { colors } from '../src/theme'

export default function EditProfileScreen() {
  const { profile, refreshProfile } = useAuth()
  const router = useRouter()
  const [name, setName] = useState(profile?.name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function clearError(field: string) {
    setErrors(prev => { const n = { ...prev }; delete n[field]; return n })
  }

  async function handleSave() {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'الاسم مطلوب'
    if (!phone.trim()) e.phone = 'رقم التليفون مطلوب'
    else if (!/^01[0-9]{9}$/.test(phone.trim())) e.phone = 'رقم تليفون غير صحيح'
    setErrors(e)
    if (Object.keys(e).length > 0) return
    if (!profile) return
    setSaving(true)
    const { error } = await supabase.from('users').update({
      name: name.trim(),
      phone: phone.trim(),
    }).eq('id', profile.id)
    setSaving(false)
    if (error) {
      Alert.alert('خطأ', 'حدث خطأ أثناء التحديث')
    } else {
      await refreshProfile()
      Alert.alert('تم', 'تم تحديث البيانات بنجاح', [{ text: 'حسناً', onPress: () => router.back() }])
    }
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={s.backText}>→ رجوع</Text>
          </TouchableOpacity>
          <Text style={s.title}>تعديل البيانات</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={s.avatarSection}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{name?.[0] ?? '؟'}</Text>
          </View>
        </View>

        <View style={s.form}>
          <Text style={s.label}>الاسم</Text>
          <TextInput style={[s.input, errors.name ? s.inputError : null]} value={name} onChangeText={v => { setName(v); clearError('name') }} placeholder="الاسم الكامل" placeholderTextColor={colors.navy[400]} textAlign="right" />
          {errors.name ? <Text style={s.errorText}>{errors.name}</Text> : null}

          <Text style={s.label}>رقم التليفون</Text>
          <TextInput style={[s.input, errors.phone ? s.inputError : null]} value={phone} onChangeText={v => { setPhone(v); clearError('phone') }} placeholder="01xxxxxxxxx" placeholderTextColor={colors.navy[400]} keyboardType="phone-pad" textAlign="left" />
          {errors.phone ? <Text style={s.errorText}>{errors.phone}</Text> : null}

          <Text style={s.label}>البريد الإلكتروني</Text>
          <View style={[s.input, s.disabledInput]}>
            <Text style={s.disabledText}>{profile?.email ?? '-'}</Text>
          </View>

          <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            <Text style={s.saveBtnText}>{saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900] },
  content: { padding: 20, paddingTop: 56 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  backText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  avatarSection: { alignItems: 'center', marginBottom: 32 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 32, color: '#fff', fontWeight: 'bold' },
  form: { gap: 16 },
  label: { fontSize: 14, fontWeight: '600', color: colors.navy[100], textAlign: 'right' },
  input: {
    backgroundColor: colors.navy[800], borderRadius: 14, padding: 16,
    fontSize: 16, color: '#fff', borderWidth: 1, borderColor: colors.navy[700],
  },
  disabledInput: { backgroundColor: colors.navy[700], justifyContent: 'center' },
  disabledText: { fontSize: 16, color: colors.navy[400] },
  inputError: { borderColor: '#ef4444', backgroundColor: '#ef444410' },
  errorText: { fontSize: 12, color: '#ef4444', textAlign: 'right', marginTop: 4, fontWeight: '500' },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
})
