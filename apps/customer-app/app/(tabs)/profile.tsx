import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Switch, TextInput, Modal } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import { useAuth } from '../../src/contexts/AuthContext'
import { useCustomAlert } from '../../src/components/CustomAlert'
import { supabase } from '../../src/lib/supabase'
import { colors } from '../../src/theme'
import { ChevronLeft, Edit3, MapPin, Crown, Fingerprint, LogOut } from 'lucide-react-native'

const tierConfig: Record<string, { label: string; color: string; bg: string }> = {
  bronze: { label: 'برونزي', color: '#cd7f32', bg: 'rgba(205,127,50,0.12)' },
  silver: { label: 'فضي', color: '#c0c0c0', bg: 'rgba(192,192,192,0.12)' },
  gold: { label: 'ذهبي', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  platinum: { label: 'بلاتيني', color: '#e5e4e2', bg: 'rgba(229,228,226,0.12)' },
}

export default function ProfileScreen() {
  const { profile, signOut, biometricEnabled, biometricAvailable, toggleBiometric } = useAuth()
  const { showAlert, AlertComponent } = useCustomAlert()
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

  const tier = tierConfig[profile?.tier ?? 'bronze'] ?? tierConfig.bronze

  const handleSignOut = () => {
    showAlert({ title: 'تسجيل الخروج', message: 'هل أنت متأكد؟', type: 'confirm', buttons: [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'خروج', style: 'destructive', onPress: async () => { await signOut(); router.replace('/') } },
    ] })
  }

  return (
    <>
    <ScrollView style={s.container} contentContainerStyle={s.contentContainer} showsVerticalScrollIndicator={false}>
      <Animated.Text entering={FadeInDown.duration(500)} style={s.pageTitle}>حسابي</Animated.Text>

      {/* Profile Card */}
      <Animated.View entering={FadeInDown.duration(500).delay(100)}>
        <LinearGradient
          colors={[colors.navy[800], colors.navy[700]]}
          style={s.profileCard}
        >
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={s.avatarImg} />
          ) : (
            <View style={s.avatar}>
              <Text style={s.avatarText}>{profile?.name?.[0] ?? '؟'}</Text>
            </View>
          )}
          <Text style={s.name}>{profile?.name}</Text>
          <Text style={s.phone}>{profile?.phone}</Text>

          <View style={s.badgesRow}>
            {profile?.customer_code && (
              <View style={s.codeBadge}>
                <Text style={s.codeText}>{profile.customer_code}</Text>
              </View>
            )}
            <View style={[s.tierBadge, { backgroundColor: tier.bg }]}>
              <Text style={[s.tierText, { color: tier.color }]}>{tier.label}</Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Stats */}
      <Animated.View entering={FadeInDown.duration(500).delay(200)} style={s.statsRow}>
        <View style={s.statCard}>
          <View style={[s.statIconWrap, { backgroundColor: colors.accentGlow }]}>
            <Text style={{ fontSize: 18 }}>⭐</Text>
          </View>
          <Text style={s.statValue}>{profile?.points ?? 0}</Text>
          <Text style={s.statLabel}>النقاط</Text>
        </View>
        <View style={s.statCard}>
          <View style={[s.statIconWrap, { backgroundColor: tier.bg }]}>
            <Text style={{ fontSize: 18 }}>🏆</Text>
          </View>
          <Text style={s.statValue}>{tier.label}</Text>
          <Text style={s.statLabel}>المستوى</Text>
        </View>
      </Animated.View>

      {/* Menu */}
      <Animated.View entering={FadeInDown.duration(500).delay(300)} style={s.menuSection}>
        <MenuItem icon={<Edit3 size={20} color={colors.primary} />} label="تعديل البيانات" onPress={() => router.push('/edit-profile')} />
        <MenuItem icon={<MapPin size={20} color={colors.accent} />} label="عناويني" onPress={() => router.push('/addresses')} />
        <MenuItem
          icon={<Crown size={20} color={colors.gold} />}
          label="الباقات والاشتراك"
          onPress={() => router.push('/plans')}
          badge={activeSub ? activeSub.plans?.name : undefined}
        />

        {biometricAvailable && (
          <View style={s.menuItem}>
            <View style={[s.menuIconWrap, { backgroundColor: colors.primaryGlow }]}>
              <Fingerprint size={20} color={colors.primary} />
            </View>
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
                  showAlert({ title: 'تم', message: 'تم إلغاء تسجيل الدخول بالبصمة', type: 'success' })
                }
              }}
              trackColor={{ false: colors.navy[600], true: colors.primary + '60' }}
              thumbColor={biometricEnabled ? colors.primary : colors.navy[400]}
            />
          </View>
        )}
      </Animated.View>

      {/* Logout */}
      <Animated.View entering={FadeInDown.duration(500).delay(400)}>
        <TouchableOpacity style={s.logoutBtn} onPress={handleSignOut} activeOpacity={0.7}>
          <LogOut size={18} color={colors.danger} />
          <Text style={s.logoutText}>تسجيل الخروج</Text>
        </TouchableOpacity>
      </Animated.View>

      <View style={{ height: 100 }} />

      {/* Biometric Modal */}
      <Modal visible={showBioModal} animationType="slide" transparent>
        <View style={s.bioModalOverlay}>
          <View style={s.bioModalContent}>
            <View style={s.bioModalHeader}>
              <Text style={{ fontSize: 32 }}>🔐</Text>
              <Text style={s.bioModalTitle}>تفعيل البصمة</Text>
              <Text style={s.bioModalHint}>أدخل كلمة المرور لتفعيل تسجيل الدخول بالبصمة</Text>
            </View>
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
                  if (!bioEmail || !bioPassword) { showAlert({ title: 'تنبيه', message: 'أدخل البريد وكلمة المرور', type: 'warning' }); return }
                  setBioSaving(true)
                  const ok = await toggleBiometric(true, bioEmail, bioPassword)
                  setBioSaving(false)
                  if (ok) {
                    setShowBioModal(false)
                    showAlert({ title: 'تم', message: 'تم تفعيل تسجيل الدخول بالبصمة بنجاح', type: 'success' })
                  } else {
                    showAlert({ title: 'خطأ', message: 'فشل تفعيل البصمة', type: 'error' })
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
    {AlertComponent}
    </>
  )
}

function MenuItem({ icon, label, onPress, badge }: { icon: React.ReactNode; label: string; onPress?: () => void; badge?: string }) {
  return (
    <TouchableOpacity style={s.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={s.menuIconWrap}>{icon}</View>
      <Text style={s.menuText}>{label}</Text>
      {badge ? (
        <View style={s.menuBadge}><Text style={s.menuBadgeText}>{badge}</Text></View>
      ) : (
        <ChevronLeft size={18} color={colors.navy[400]} />
      )}
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900] },
  contentContainer: { padding: 20, paddingTop: 56 },
  pageTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 24 },

  profileCard: {
    alignItems: 'center', borderRadius: 24,
    padding: 28, borderWidth: 1, borderColor: colors.navy[600], marginBottom: 16,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 14,
    borderWidth: 3, borderColor: colors.accentLight,
  },
  avatarText: { fontSize: 32, color: '#fff', fontWeight: 'bold' },
  avatarImg: { width: 80, height: 80, borderRadius: 40, marginBottom: 14, borderWidth: 3, borderColor: colors.accentLight },
  name: { fontSize: 22, fontWeight: '800', color: '#fff' },
  phone: { fontSize: 14, color: colors.navy[200], marginTop: 4 },
  badgesRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  codeBadge: {
    backgroundColor: colors.primaryGlow, paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: colors.primary + '30',
  },
  codeText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  tierBadge: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
  },
  tierText: { fontWeight: '700', fontSize: 12 },

  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: colors.navy[800], borderRadius: 18, padding: 18,
    alignItems: 'center', borderWidth: 1, borderColor: colors.navy[700], gap: 6,
  },
  statIconWrap: {
    width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 11, color: colors.navy[300] },

  menuSection: { gap: 8, marginBottom: 24 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.navy[800],
    borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.navy[700], gap: 12,
  },
  menuIconWrap: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: colors.navy[700],
    justifyContent: 'center', alignItems: 'center',
  },
  menuText: { flex: 1, fontSize: 15, color: '#fff', fontWeight: '600' },
  menuBadge: {
    backgroundColor: colors.primaryGlow, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
  },
  menuBadgeText: { fontSize: 11, color: colors.primary, fontWeight: '700' },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    backgroundColor: colors.dangerGlow, borderWidth: 1, borderColor: colors.danger + '30',
    borderRadius: 16, padding: 16,
  },
  logoutText: { color: colors.danger, fontSize: 16, fontWeight: '700' },

  bioModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  bioModalContent: { backgroundColor: colors.navy[800], borderRadius: 24, padding: 24, borderWidth: 1, borderColor: colors.navy[600] },
  bioModalHeader: { alignItems: 'center', marginBottom: 20 },
  bioModalTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 8 },
  bioModalHint: { fontSize: 13, color: colors.navy[300], textAlign: 'center', marginTop: 4 },
  bioFieldLabel: { fontSize: 12, color: colors.navy[200], marginBottom: 4, textAlign: 'right' },
  bioInput: { backgroundColor: colors.navy[700], borderRadius: 12, padding: 14, color: '#fff', fontSize: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.navy[600] },
  bioModalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  bioModalCancel: { flex: 1, borderWidth: 1, borderColor: colors.navy[500], borderRadius: 14, padding: 14, alignItems: 'center' },
  bioModalCancelText: { color: colors.navy[200], fontWeight: '600' },
  bioModalSave: { flex: 2, backgroundColor: colors.primary, borderRadius: 14, padding: 14, alignItems: 'center' },
  bioModalSaveText: { color: '#fff', fontWeight: '700' },
})
