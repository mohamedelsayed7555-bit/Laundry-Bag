import { useState } from 'react'
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Image, Platform, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../src/contexts/AuthContext'
import { useCustomAlert } from '../src/components/CustomAlert'
import { supabase } from '../src/lib/supabase'
import { colors } from '../src/theme'
import * as ImagePicker from 'expo-image-picker'

export default function EditProfileScreen() {
  const { profile, refreshProfile } = useAuth()
  const router = useRouter()
  const { showAlert, AlertComponent } = useCustomAlert()
  const [name, setName] = useState(profile?.name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [saving, setSaving] = useState(false)

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null)
  const [uploading, setUploading] = useState(false)

  // Password
  const [showPassword, setShowPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function clearError(field: string) {
    setErrors(prev => { const n = { ...prev }; delete n[field]; return n })
  }

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      showAlert({ title: 'صلاحية', message: 'يرجى السماح بالوصول للصور من الإعدادات', type: 'warning' })
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    })

    if (result.canceled || !result.assets?.[0]) return

    const asset = result.assets[0]
    setUploading(true)

    try {
      const ext = asset.uri.split('.').pop() ?? 'jpg'
      const path = `avatars/${profile!.id}.${ext}`

      const response = await fetch(asset.uri)
      const blob = await response.blob()
      const arrayBuffer = await new Response(blob).arrayBuffer()

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, arrayBuffer, { upsert: true, contentType: `image/${ext}` })

      if (uploadError) {
        showAlert({ title: 'خطأ', message: 'فشل رفع الصورة', type: 'error' })
        setUploading(false)
        return
      }

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = `${publicUrl}?t=${Date.now()}`

      await supabase.from('users').update({ avatar_url: url }).eq('id', profile!.id)
      setAvatarUrl(url)
      await refreshProfile()
      showAlert({ title: 'تم', message: 'تم تحديث الصورة الشخصية', type: 'success' })
    } catch {
      showAlert({ title: 'خطأ', message: 'حدث خطأ أثناء رفع الصورة', type: 'error' })
    }
    setUploading(false)
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
      showAlert({ title: 'خطأ', message: 'حدث خطأ أثناء التحديث', type: 'error' })
    } else {
      await refreshProfile()
      showAlert({ title: 'تم', message: 'تم تحديث البيانات بنجاح', type: 'success' })
    }
  }

  async function handleChangePassword() {
    if (newPassword.length < 6) {
      showAlert({ title: 'خطأ', message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل', type: 'error' })
      return
    }
    if (newPassword !== confirmPassword) {
      showAlert({ title: 'خطأ', message: 'كلمة المرور غير متطابقة', type: 'error' })
      return
    }
    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)
    if (error) {
      showAlert({ title: 'خطأ', message: error.message || 'حدث خطأ', type: 'error' })
    } else {
      setNewPassword('')
      setConfirmPassword('')
      setShowPassword(false)
      showAlert({ title: 'تم', message: 'تم تغيير كلمة المرور بنجاح', type: 'success' })
    }
  }

  async function handleDeleteAccount() {
    showAlert({
      title: 'حذف الحساب',
      message: 'هل أنت متأكد؟ سيتم حذف حسابك نهائياً ولن تتمكن من استرجاعه.',
      type: 'confirm',
      buttons: [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف نهائي', style: 'destructive', onPress: () => {
            showAlert({ title: 'تأكيد أخير', message: 'هذا الإجراء لا يمكن التراجع عنه!', type: 'confirm', buttons: [
              { text: 'تراجع', style: 'cancel' },
              {
                text: 'احذف حسابي', style: 'destructive', onPress: async () => {
                  if (!profile) return
                  await supabase.from('users').update({ is_active: false }).eq('id', profile.id)
                  await supabase.auth.signOut()
                  router.replace('/')
                }
              },
            ] })
          }
        },
      ],
    })
  }

  const passwordStrength = newPassword.length >= 12 ? 4 : newPassword.length >= 8 ? 3 : newPassword.length >= 6 ? 2 : newPassword.length > 0 ? 1 : 0
  const strengthLabel = ['', 'ضعيفة', 'مقبولة', 'جيدة', 'قوية'][passwordStrength]
  const strengthColor = ['', colors.danger, colors.warning, colors.primary, colors.success][passwordStrength]

  return (
    <>
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.headerRow}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.backText}>→ رجوع</Text>
        </TouchableOpacity>
        <Text style={s.title}>تعديل البيانات</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Avatar */}
      <View style={s.avatarSection}>
        <TouchableOpacity onPress={pickImage} disabled={uploading} style={s.avatarWrapper}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={s.avatarImage} />
          ) : (
            <View style={s.avatar}>
              <Text style={s.avatarText}>{name?.[0] ?? '؟'}</Text>
            </View>
          )}
          <View style={s.cameraOverlay}>
            {uploading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.cameraIcon}>📷</Text>
            )}
          </View>
        </TouchableOpacity>
        <Text style={s.changePhotoText}>اضغط لتغيير الصورة</Text>
      </View>

      {/* Personal Info */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>البيانات الشخصية</Text>

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

      {/* Change Password */}
      <View style={s.section}>
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={s.sectionHeader}>
          <Text style={s.sectionTitle}>🔒 تغيير كلمة المرور</Text>
          <Text style={s.expandIcon}>{showPassword ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {showPassword && (
          <View style={s.passwordForm}>
            <Text style={s.label}>كلمة المرور الجديدة</Text>
            <TextInput
              style={s.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="6 أحرف على الأقل"
              placeholderTextColor={colors.navy[400]}
              secureTextEntry
              textAlign="left"
            />

            {newPassword.length > 0 && (
              <View style={s.strengthRow}>
                {[1, 2, 3, 4].map(i => (
                  <View key={i} style={[s.strengthBar, { backgroundColor: i <= passwordStrength ? strengthColor : colors.navy[700] }]} />
                ))}
                <Text style={[s.strengthText, { color: strengthColor }]}>{strengthLabel}</Text>
              </View>
            )}

            <Text style={s.label}>تأكيد كلمة المرور</Text>
            <TextInput
              style={s.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="أعد كتابة كلمة المرور"
              placeholderTextColor={colors.navy[400]}
              secureTextEntry
              textAlign="left"
            />

            {confirmPassword.length > 0 && confirmPassword !== newPassword && (
              <Text style={s.errorText}>كلمة المرور غير متطابقة</Text>
            )}
            {confirmPassword.length > 0 && confirmPassword === newPassword && (
              <Text style={s.matchText}>✓ متطابقة</Text>
            )}

            <TouchableOpacity
              style={[s.passwordBtn, (savingPassword || !newPassword || newPassword !== confirmPassword) && { opacity: 0.5 }]}
              onPress={handleChangePassword}
              disabled={savingPassword || !newPassword || newPassword !== confirmPassword}
            >
              <Text style={s.passwordBtnText}>{savingPassword ? 'جاري التغيير...' : 'تغيير كلمة المرور'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Delete Account */}
      <TouchableOpacity style={s.deleteBtn} onPress={handleDeleteAccount}>
        <Text style={s.deleteText}>🗑️ حذف الحساب نهائياً</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
    {AlertComponent}
    </>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900] },
  content: { padding: 20, paddingTop: 56, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  backText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },

  // Avatar
  avatarSection: { alignItems: 'center', marginBottom: 28 },
  avatarWrapper: { position: 'relative' },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 38, color: '#fff', fontWeight: 'bold' },
  avatarImage: { width: 100, height: 100, borderRadius: 50 },
  cameraOverlay: {
    position: 'absolute', bottom: 0, right: 0,
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: colors.navy[900],
  },
  cameraIcon: { fontSize: 16 },
  changePhotoText: { fontSize: 12, color: colors.navy[300], marginTop: 8 },

  // Sections
  section: {
    backgroundColor: colors.navy[800], borderRadius: 18, padding: 20,
    borderWidth: 1, borderColor: colors.navy[700], marginBottom: 16,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 16 },
  expandIcon: { fontSize: 12, color: colors.navy[400] },

  // Form
  label: { fontSize: 13, fontWeight: '600', color: colors.navy[200], marginBottom: 6, marginTop: 8, textAlign: 'right' },
  input: {
    backgroundColor: colors.navy[700], borderRadius: 14, padding: 16,
    fontSize: 16, color: '#fff', borderWidth: 1, borderColor: colors.navy[600],
  },
  disabledInput: { backgroundColor: colors.navy[700], justifyContent: 'center', opacity: 0.6 },
  disabledText: { fontSize: 16, color: colors.navy[400] },
  inputError: { borderColor: '#ef4444', backgroundColor: '#ef444410' },
  errorText: { fontSize: 12, color: '#ef4444', textAlign: 'right', marginTop: 4, fontWeight: '500' },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: 14, padding: 16,
    alignItems: 'center', marginTop: 16,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Password
  passwordForm: { marginTop: 8 },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, marginBottom: 4 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthText: { fontSize: 11, fontWeight: '600', marginRight: 8, minWidth: 40 },
  matchText: { fontSize: 11, color: colors.success, marginTop: 4 },
  passwordBtn: {
    backgroundColor: colors.accent, borderRadius: 14, padding: 14,
    alignItems: 'center', marginTop: 16,
  },
  passwordBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Delete
  deleteBtn: {
    borderWidth: 1.5, borderColor: colors.danger + '50', borderRadius: 14,
    padding: 14, alignItems: 'center', marginTop: 8,
  },
  deleteText: { color: colors.danger, fontSize: 14, fontWeight: '600' },
})
