import { useState } from 'react'
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
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

  async function handleSave() {
    if (!name.trim()) { Alert.alert('خطأ', 'أدخل الاسم'); return }
    if (!phone.trim()) { Alert.alert('خطأ', 'أدخل رقم التليفون'); return }
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
          <TextInput style={s.input} value={name} onChangeText={setName} placeholder="الاسم الكامل" placeholderTextColor={colors.navy[400]} textAlign="right" />

          <Text style={s.label}>رقم التليفون</Text>
          <TextInput style={s.input} value={phone} onChangeText={setPhone} placeholder="01xxxxxxxxx" placeholderTextColor={colors.navy[400]} keyboardType="phone-pad" textAlign="left" />

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
  saveBtn: { backgroundColor: colors.primary, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
})
