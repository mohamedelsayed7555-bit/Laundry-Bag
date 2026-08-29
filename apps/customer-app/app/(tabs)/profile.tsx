import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image, ScrollView, Switch, TextInput, Modal } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import { useAuth } from '../../src/contexts/AuthContext'
import { supabase } from '../../src/lib/supabase'
import { colors } from '../../src/theme'

export default function ProfileScreen() {
  const { profile, signOut, biometricEnabled, biometricAvailable, toggleBiometric } = useAuth()
  const [activeSub, setActiveSub] = useState<any>(null)
  const [showBioModal, setShowBioModal] = useState(false)
  const [bioEmail, setBioEmail] = useState('')
  const [bioPassword, setBioPassword] = useState('')
  const [bioSaving, setBioSaving] = useState(false)

  useEffect(() => {
    if (!profile) return
    supabase
      .from('subscriptions')
      .select('*, plans(name)')
      .eq('user_id', profile.id)
      .eq('status', 'active')
      .single()
      .then(({ data }) => setActiveSub(data))
  }, [profile])
  const router = useRouter()

  const handleSignOut = () => {
    Alert.alert('تسجيل الخروج', 'هل أنت متأكد؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'خروج', style: 'destructive', onPress: async () => { await signOut(); router.replace('/') } },
    ])
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.contentContainer} showsVerticalScrollIndicator={false}>
      <Animated.Text entering={FadeInDown.duration(500)} style={s.title}>حسابي</Animated.Text>

      <Animated.View entering={FadeInDown.duration(500).delay(100)} style={s.card}>
        {profile?.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={s.avatarImg} />
        ) : (
          <View style={s.avatar}>
            <Text style={s.avatarText}>{profile?.name?.[0] ?? '؟'}</Text>
          </View>
        )}
        <Text style={s.name}>{profile?.name}</Text>
        <Text style={s.phone}>{profile?.phone}</Text>
        {profile?.customer_code && (
          <View style={s.codeBadge}>
            <Text style={s.codeText}>{profile.customer_code}</Text>
          </View>
        )}
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(500).delay(200)} style={s.statsRow}>
        <View style={s.statCard}>
          <Text style={s.statValue}>{profile?.tier ?? 'bronze'}</Text>
          <Text style={s.statLabel}>المستوى</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statValue}>{profile?.points ?? 0}</Text>
          <Text style={s.statLabel}>النقاط</Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(500).delay(300)} style={s.menuSection}>
        <TouchableOpacity style={s.menuItem} onPress={() => router.push('/edit-profile')}>
          <Text style={s.menuIcon}>✏️</Text>
          <Text style={s.menuText}>تعديل البيانات</Text>
          <Text style={s.menuArrow}>←</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.menuItem} onPress={() => router.push('/addresses')}>
          <Text style={s.menuIcon}>📍</Text>
          <Text style={s.menuText}>عناويني</Text>
          <Text style={s.menuArrow}>←</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.menuItem} onPress={() => router.push('/plans')}>
          <Text style={s.menuIcon}>👑</Text>
          <Text style={s.menuText}>الباقات والاشتراك</Text>
          {activeSub ? (
            <Text style={s.subBadge}>{activeSub.plans?.name}</Text>
          ) : (
            <Text style={s.menuArrow}>←</Text>
          )}
        </TouchableOpacity>

        {biometricAvailable && (
          <View style={s.menuItem}>
            <Text style={s.menuIcon}>🔐</Text>
            <Text style={s.menuText}>تسجيل دخول بالبصمة</Text>
            <Switch
              value={biometricEnabled}
              onValueChange={async (val) => {
                if (val) {
                  setBioEmail(profile?.email ?? '')
                  setBioPassword('')
                  setShowBioModal(true)
                } else {
                  await toggleBiometric(false)
                  Alert.alert('تم', 'تم إلغاء تسجيل الدخول بالبصمة')
                }
              }}
              trackColor={{ false: colors.navy[600], true: colors.primary + '60' }}
              thumbColor={biometricEnabled ? colors.primary : colors.navy[400]}
            />
          </View>
        )}
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(500).delay(400)}>
      <TouchableOpacity style={s.logoutBtn} onPress={handleSignOut}>
        <Text style={s.logoutText}>تسجيل الخروج</Text>
      </TouchableOpacity>
      </Animated.View>

      <Modal visible={showBioModal} animationType="slide" transparent>
        <View style={s.bioModalOverlay}>
          <View style={s.bioModalContent}>
            <Text style={s.bioModalTitle}>تفعيل البصمة</Text>
            <Text style={s.bioModalHint}>أدخل كلمة المرور لتفعيل تسجيل الدخول بالبصمة</Text>
            <Text style={s.bioFieldLabel}>البريد الإلكتروني</Text>
            <TextInput style={s.bioInput} value={bioEmail} onChangeText={setBioEmail} keyboardType="email-address" autoCapitalize="none" textAlign="left" />
            <Text style={s.bioFieldLabel}>كلمة المرور</Text>
            <TextInput style={s.bioInput} value={bioPassword} onChangeText={setBioPassword} secureTextEntry textAlign="left" />
            <View style={s.bioModalActions}>
              <TouchableOpacity style={s.bioModalCancel} onPress={() => setShowBioModal(false)}>
                <Text style={s.bioModalCancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.bioModalSave, bioSaving && { opacity: 0.6 }]}
                disabled={bioSaving}
                onPress={async () => {
                  if (!bioEmail || !bioPassword) { Alert.alert('تنبيه', 'أدخل البريد وكلمة المرور'); return }
                  setBioSaving(true)
                  const ok = await toggleBiometric(true, bioEmail, bioPassword)
                  setBioSaving(false)
                  if (ok) {
                    setShowBioModal(false)
                    Alert.alert('تم', 'تم تفعيل تسجيل الدخول بالبصمة بنجاح')
                  } else {
                    Alert.alert('خطأ', 'فشل تفعيل البصمة')
                  }
                }}
              >
                <Text style={s.bioModalSaveText}>{bioSaving ? 'جاري...' : 'تفعيل'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900] },
  contentContainer: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 24 },
  card: {
    alignItems: 'center', backgroundColor: colors.navy[800], borderRadius: 20,
    padding: 28, borderWidth: 1, borderColor: colors.navy[700], marginBottom: 20,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  avatarText: { fontSize: 28, color: '#fff', fontWeight: 'bold' },
  avatarImg: { width: 72, height: 72, borderRadius: 36 },
  name: { fontSize: 20, fontWeight: '700', color: '#fff' },
  phone: { fontSize: 14, color: colors.navy[200], marginTop: 4 },
  codeBadge: {
    backgroundColor: colors.primary + '20', paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: 20, marginTop: 12,
  },
  codeText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: colors.navy[800], borderRadius: 16, padding: 20,
    alignItems: 'center', borderWidth: 1, borderColor: colors.navy[700],
  },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  statLabel: { fontSize: 12, color: colors.navy[300], marginTop: 4 },
  menuSection: { gap: 8, marginBottom: 24 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.navy[800],
    borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.navy[700],
  },
  menuIcon: { fontSize: 20, marginLeft: 12 },
  menuText: { flex: 1, fontSize: 15, color: '#fff', fontWeight: '600' },
  menuArrow: { fontSize: 18, color: colors.navy[400] },
  logoutBtn: {
    borderWidth: 1.5, borderColor: colors.danger, borderRadius: 14,
    padding: 14, alignItems: 'center',
  },
  logoutText: { color: colors.danger, fontSize: 16, fontWeight: '600' },
  subBadge: { fontSize: 11, color: colors.primary, fontWeight: '700', backgroundColor: colors.primary + '20', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  bioModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  bioModalContent: { backgroundColor: colors.navy[800], borderRadius: 20, padding: 24 },
  bioModalTitle: { fontSize: 18, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 8 },
  bioModalHint: { fontSize: 13, color: colors.navy[300], textAlign: 'center', marginBottom: 20 },
  bioFieldLabel: { fontSize: 12, color: colors.navy[200], marginBottom: 4, textAlign: 'right' },
  bioInput: { backgroundColor: colors.navy[700], borderRadius: 10, padding: 12, color: '#fff', fontSize: 14, marginBottom: 12 },
  bioModalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  bioModalCancel: { flex: 1, borderWidth: 1, borderColor: colors.navy[500], borderRadius: 12, padding: 14, alignItems: 'center' },
  bioModalCancelText: { color: colors.navy[200], fontWeight: '600' },
  bioModalSave: { flex: 2, backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  bioModalSaveText: { color: '#fff', fontWeight: '700' },
})
