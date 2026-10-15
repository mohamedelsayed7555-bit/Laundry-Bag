import { useState } from 'react'
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Camera, UserRound, Phone, Mail, Lock, KeyRound, ShieldCheck, ChevronDown, ChevronUp, Check, Trash2 } from 'lucide-react-native'
import { useBrand, Card, IconButton, BackIcon, FlowLines, F, SIZE } from '../src/components/brand'
import { PrimaryButton } from '../src/components/auth/ui'
import { useRouter } from 'expo-router'
import { useAuth } from '../src/contexts/AuthContext'
import { useCustomAlert } from '../src/components/CustomAlert'
import { supabase } from '../src/lib/supabase'
import { passwordChecks } from '../src/lib/passwordRules'
import { useTheme } from '../src/contexts/ThemeContext'
import { useLanguage } from '../src/contexts/LanguageContext'
import * as ImagePicker from 'expo-image-picker'

export default function EditProfileScreen() {
  const { colors } = useTheme()
  const { t, locale } = useLanguage()
  const b = useBrand()
  const insets = useSafeAreaInsets()
  const { profile, refreshProfile, toggleBiometric, biometricEnabled } = useAuth()
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
      showAlert({ title: t('permissionTitle'), message: t('permissionPhotos'), type: 'warning' })
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
        showAlert({ title: t('error'), message: t('uploadError'), type: 'error' })
        setUploading(false)
        return
      }

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = `${publicUrl}?t=${Date.now()}`

      await supabase.from('users').update({ avatar_url: url }).eq('id', profile!.id)
      setAvatarUrl(url)
      await refreshProfile()
      showAlert({ title: t('success'), message: t('photoUpdated'), type: 'success' })
    } catch {
      showAlert({ title: t('error'), message: t('uploadErrorGeneric'), type: 'error' })
    }
    setUploading(false)
  }

  async function handleSave() {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = t('nameRequiredMsg')
    if (!phone.trim()) e.phone = t('phoneRequiredMsg')
    else if (!/^01[0-9]{9}$/.test(phone.trim())) e.phone = t('phoneInvalidMsg')
    setErrors(e)
    if (Object.keys(e).length > 0) return
    if (!profile) return
    setSaving(true)
    if (phone.trim() !== profile.phone) {
      const { data: phoneTaken } = await supabase.rpc('is_phone_registered', { p_phone: phone.trim(), p_exclude: profile.id })
      if (phoneTaken) {
        setSaving(false)
        setErrors({ phone: locale === 'en' ? 'Phone number already registered' : 'رقم الموبايل مسجل بالفعل' })
        return
      }
    }
    const { error } = await supabase.from('users').update({
      name: name.trim(),
      phone: phone.trim(),
    }).eq('id', profile.id)
    setSaving(false)
    if (error) {
      showAlert({ title: t('error'), message: t('updateError'), type: 'error' })
    } else {
      await refreshProfile()
      showAlert({ title: t('success'), message: t('profileUpdated'), type: 'success' })
    }
  }

  async function handleChangePassword() {
    if (!passwordChecks(newPassword).every(c => c.ok)) {
      showAlert({ title: t('error'), message: t('authPasswordWeak'), type: 'error' })
      return
    }
    if (newPassword !== confirmPassword) {
      showAlert({ title: t('error'), message: t('passwordMismatchError'), type: 'error' })
      return
    }
    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)
    if (error) {
      showAlert({ title: t('error'), message: error.message || t('updateError'), type: 'error' })
    } else {
      setNewPassword('')
      setConfirmPassword('')
      setShowPassword(false)
      if (biometricEnabled) await toggleBiometric(false)
      showAlert({ title: t('success'), message: t('passwordChanged'), type: 'success' })
    }
  }

  async function handleDeleteAccount() {
    showAlert({
      title: t('deleteAccountTitle'),
      message: t('deleteAccountMsg'),
      type: 'confirm',
      buttons: [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'), style: 'destructive', onPress: () => {
            showAlert({ title: t('finalConfirm'), message: t('cannotUndo'), type: 'confirm', buttons: [
              { text: t('cancel'), style: 'cancel' },
              {
                text: t('deleteMyAccount'), style: 'destructive', onPress: async () => {
                  if (!profile) return
                  // Removes personal data and closes the login (see /delete-account); order history stays without it.
                  const { error } = await supabase.rpc('delete_my_account')
                  if (error) {
                    const activeOrders = error.message?.includes('active_orders')
                    showAlert({
                      title: t('error'),
                      message: activeOrders
                        ? (locale === 'en' ? 'You have an order in progress. You can delete your account after it is delivered or cancelled.' : 'عندك طلب لسه شغال. تقدر تحذف حسابك بعد ما يتسلّم أو يتلغي.')
                        : t('updateError'),
                      type: 'error',
                    })
                    return
                  }
                  if (biometricEnabled) await toggleBiometric(false)
                  await supabase.auth.signOut().catch(() => {})
                  router.replace('/')
                }
              },
            ] })
          }
        },
      ],
    })
  }

  const checks = passwordChecks(newPassword)
  const passedChecks = checks.filter(c => c.ok).length
  const passwordOk = passedChecks === checks.length
  // Strength follows how many of the sign-up rules are met (at least "weak" once something is typed).
  const passwordStrength = newPassword.length > 0 ? Math.max(1, passedChecks) : 0
  const strengthLabel = ['', t('strengthWeak'), t('strengthFair'), t('strengthGood'), t('strengthStrong')][passwordStrength]
  const strengthColor = ['', colors.danger, colors.warning, colors.primary, colors.success][passwordStrength]

  const mismatch = confirmPassword.length > 0 && confirmPassword !== newPassword
  const pwDisabled = savingPassword || !passwordOk || newPassword !== confirmPassword

  return (
    <>
    <ScrollView style={[s.container, { backgroundColor: b.page }]} contentContainerStyle={[s.content, { paddingTop: insets.top + 10 }]} keyboardShouldPersistTaps="handled">
      <FlowLines height={260} />
      <View style={s.headerRow}>
        <IconButton onPress={() => router.back()} label={t('back')}>
          <BackIcon color={b.ink} />
        </IconButton>
        <Text style={[s.title, { color: b.ink }]} numberOfLines={1}>{t('editProfileTitle')}</Text>
      </View>

      {/* Avatar */}
      <View style={s.avatarSection}>
        <TouchableOpacity onPress={pickImage} disabled={uploading} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('tapToChangePhoto')}>
          <LinearGradient colors={['#38BDF8', '#818CF8', '#0EA5E9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.avatarRing}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={[s.avatarImage, { borderColor: b.page }]} />
            ) : (
              <LinearGradient colors={['#38BDF8', '#0284C7']} style={[s.avatarImage, s.avatarFallback, { borderColor: b.page }]}>
                <Text style={s.avatarText}>{name?.[0] ?? '؟'}</Text>
              </LinearGradient>
            )}
          </LinearGradient>
          <View style={[s.cameraBadge, { backgroundColor: b.primary, borderColor: b.page }]}>
            {uploading ? <ActivityIndicator size="small" color="#fff" /> : <Camera size={15} color="#fff" />}
          </View>
        </TouchableOpacity>
        <Text style={[s.changePhotoText, { color: b.muted }]}>{t('tapToChangePhoto')}</Text>
      </View>

      {/* Personal Info */}
      <Card style={s.section}>
        <Text style={[s.sectionTitle, { color: b.ink }]}>{t('personalInfo')}</Text>

        <Text style={[s.label, { color: b.ink2 }]}>{t('theName')}</Text>
        <View style={[s.field, { backgroundColor: b.field, borderColor: errors.name ? b.dangerText : b.fieldBorder }]}>
          <View style={[s.fieldIcon, { backgroundColor: b.iconTile }]}><UserRound size={15} color={b.accentIcon} /></View>
          <TextInput style={[s.fieldInput, { color: b.ink }]} value={name} onChangeText={v => { setName(v); clearError('name') }} placeholder={t('fullNamePlaceholder')} placeholderTextColor={b.faint} textAlign={locale === 'en' ? 'left' : 'right'} />
        </View>
        {errors.name ? <Text style={[s.errorText, { color: b.dangerText }]}>{errors.name}</Text> : null}

        <Text style={[s.label, { color: b.ink2 }]}>{t('thePhone')}</Text>
        <View style={[s.field, { backgroundColor: b.field, borderColor: errors.phone ? b.dangerText : b.fieldBorder }]}>
          <View style={[s.fieldIcon, { backgroundColor: b.iconTile }]}><Phone size={15} color={b.accentIcon} /></View>
          <TextInput style={[s.fieldInput, { color: b.ink }]} value={phone} onChangeText={v => { setPhone(v); clearError('phone') }} placeholder="01xxxxxxxxx" placeholderTextColor={b.faint} keyboardType="phone-pad" textAlign="left" />
        </View>
        {errors.phone ? <Text style={[s.errorText, { color: b.dangerText }]}>{errors.phone}</Text> : null}

        <Text style={[s.label, { color: b.ink2 }]}>{t('theEmail')}</Text>
        <View style={[s.field, { backgroundColor: b.isDark ? '#0D1626' : '#F1F4F9', borderColor: b.fieldBorder }]}>
          <View style={[s.fieldIcon, { backgroundColor: b.iconTile }]}><Mail size={15} color={b.faint} /></View>
          <Text style={[s.fieldInput, s.readOnly, { color: b.faint }]} numberOfLines={1}>{profile?.email ?? '-'}</Text>
          <Lock size={14} color={b.faint} />
        </View>

        <PrimaryButton title={t('saveChanges')} loadingTitle={t('savingText')} loading={saving} onPress={handleSave} style={{ marginTop: 16 }} />
      </Card>

      {/* Change Password */}
      <Card style={s.section} pad={false}>
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={s.pwHeader} activeOpacity={0.7} accessibilityRole="button" accessibilityState={{ expanded: showPassword }}>
          <View style={[s.pwIcon, { backgroundColor: b.tint }]}><KeyRound size={16} color={b.tintText} /></View>
          <Text style={[s.pwTitle, { color: b.ink }]}>{t('changePassword')}</Text>
          {showPassword ? <ChevronUp size={18} color={b.faint} /> : <ChevronDown size={18} color={b.faint} />}
        </TouchableOpacity>

        {showPassword && (
          <View style={[s.passwordForm, { borderTopColor: b.divider }]}>
            <Text style={[s.label, { color: b.ink2 }]}>{t('newPasswordLabel')}</Text>
            <View style={[s.field, { backgroundColor: b.field, borderColor: b.fieldBorder }]}>
              <View style={[s.fieldIcon, { backgroundColor: b.iconTile }]}><Lock size={15} color={b.accentIcon} /></View>
              <TextInput style={[s.fieldInput, { color: b.ink }]} value={newPassword} onChangeText={setNewPassword} placeholder={t('newPasswordPlaceholder')} placeholderTextColor={b.faint} secureTextEntry textAlign="left" />
            </View>

            {newPassword.length > 0 && (
              <View style={s.strengthRow}>
                {[1, 2, 3, 4].map(i => (
                  <View key={i} style={[s.strengthBar, { backgroundColor: i <= passwordStrength ? strengthColor : (b.isDark ? '#1E2B44' : '#E3E9F2') }]} />
                ))}
                <Text style={[s.strengthText, { color: strengthColor }]}>{strengthLabel}</Text>
              </View>
            )}
            <View style={s.rulesRow}>
              {checks.map(c => (
                <View key={c.key} style={[s.rule, { backgroundColor: c.ok ? b.okTint : b.iconTile }]}>
                  {c.ok ? <Check size={11} color={b.okText} /> : <View style={[s.ruleDot, { backgroundColor: b.faint }]} />}
                  <Text style={[s.ruleText, { color: c.ok ? b.okText : b.muted }]}>{t(c.labelKey)}</Text>
                </View>
              ))}
            </View>

            <Text style={[s.label, { color: b.ink2 }]}>{t('confirmPasswordLabel')}</Text>
            <View style={[s.field, { backgroundColor: b.field, borderColor: mismatch ? b.dangerText : b.fieldBorder }]}>
              <View style={[s.fieldIcon, { backgroundColor: b.iconTile }]}><ShieldCheck size={15} color={b.accentIcon} /></View>
              <TextInput style={[s.fieldInput, { color: b.ink }]} value={confirmPassword} onChangeText={setConfirmPassword} placeholder={t('confirmPasswordPlaceholder')} placeholderTextColor={b.faint} secureTextEntry textAlign="left" />
            </View>

            {mismatch && <Text style={[s.errorText, { color: b.dangerText }]}>{t('passwordMismatch')}</Text>}
            {confirmPassword.length > 0 && confirmPassword === newPassword && (
              <Text style={[s.matchText, { color: b.okText }]}>{t('passwordMatch')}</Text>
            )}

            <PrimaryButton
              title={t('changePasswordBtn')}
              loadingTitle={t('changingPassword')}
              loading={savingPassword}
              disabled={pwDisabled}
              onPress={handleChangePassword}
              style={{ marginTop: 14 }}
            />
          </View>
        )}
      </Card>

      {/* Delete Account */}
      <TouchableOpacity style={[s.deleteBtn, { borderColor: b.dangerBorder, backgroundColor: b.dangerTint }]} onPress={handleDeleteAccount} activeOpacity={0.7} accessibilityRole="button">
        <Trash2 size={16} color={b.dangerText} />
        <Text style={[s.deleteText, { color: b.dangerText }]}>{t('deleteAccount')}</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
    {AlertComponent}
    </>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  title: { flex: 1, fontSize: 18, fontFamily: F.display },

  avatarSection: { alignItems: 'center', marginBottom: 18 },
  avatarRing: { width: 92, height: 92, borderRadius: 46, padding: 3 },
  avatarImage: { width: '100%', height: '100%', borderRadius: 43, borderWidth: 3 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 32, color: '#fff', fontFamily: F.display },
  cameraBadge: { position: 'absolute', bottom: 0, end: 0, width: 32, height: 32, borderRadius: 16, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  changePhotoText: { fontSize: 12, fontFamily: F.regular, marginTop: 8 },

  section: { marginBottom: 12, padding: 14 },
  sectionTitle: { fontSize: 15, fontFamily: F.bold, marginBottom: 4 },

  label: { fontSize: 12, fontFamily: F.semibold, marginBottom: 6, marginTop: 10, marginHorizontal: 2 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 8, height: SIZE.L, borderRadius: SIZE.rL, borderWidth: 1, paddingHorizontal: 8 },
  fieldIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  fieldInput: { flex: 1, fontSize: 14.5, fontFamily: F.medium, paddingVertical: 0 },
  readOnly: { textAlign: 'left', writingDirection: 'ltr' },
  errorText: { fontSize: 11.5, fontFamily: F.medium, marginTop: 4, marginHorizontal: 2 },

  pwHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: SIZE.M + 10, paddingHorizontal: 14 },
  pwIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pwTitle: { flex: 1, fontSize: 14.5, fontFamily: F.bold },
  passwordForm: { borderTopWidth: 1, paddingHorizontal: 14, paddingBottom: 14 },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthText: { fontSize: 11, fontFamily: F.bold, marginStart: 6, minWidth: 40 },
  rulesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 24, paddingHorizontal: 8, borderRadius: 12 },
  ruleDot: { width: 4, height: 4, borderRadius: 2 },
  ruleText: { fontSize: 11, fontFamily: F.semibold },
  matchText: { fontSize: 11.5, fontFamily: F.medium, marginTop: 4, marginHorizontal: 2 },

  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderRadius: SIZE.rM, height: SIZE.M, marginTop: 6 },
  deleteText: { fontSize: 14, fontFamily: F.bold },
})
