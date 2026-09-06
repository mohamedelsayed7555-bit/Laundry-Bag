import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, Switch } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import { Edit3, Fingerprint, LogOut, Truck, ChevronLeft } from 'lucide-react-native'
import { useAuth } from '../../src/contexts/AuthContext'
import { supabase } from '../../src/lib/supabase'
import { colors } from '../../src/theme'
import { useCustomAlert } from '../../src/components/CustomAlert'

export default function DriverProfileScreen() {
  const { profile, signOut, refreshProfile, biometricEnabled, biometricAvailable, toggleBiometric } = useAuth()
  const router = useRouter()
  const { showAlert, AlertComponent } = useCustomAlert()
  const [stats, setStats] = useState({ total: 0, delivered: 0, earnings: 0, avgRating: 0, ratingCount: 0 })
  const [showBioModal, setShowBioModal] = useState(false)
  const [bioEmail, setBioEmail] = useState('')
  const [bioPassword, setBioPassword] = useState('')
  const [bioSaving, setBioSaving] = useState(false)

  useEffect(() => {
    if (profile) {
      supabase.from('orders').select('status, total, rating_driver').eq('driver_id', profile.id).then(({ data }) => {
        const orders = data ?? []
        const delivered = orders.filter(o => o.status === 'delivered')
        const rated = delivered.filter(o => o.rating_driver != null)
        const avgRating = rated.length ? rated.reduce((s, o) => s + (o.rating_driver ?? 0), 0) / rated.length : 0
        setStats({
          total: orders.length,
          delivered: delivered.length,
          earnings: delivered.reduce((s, o) => s + (o.total ?? 0), 0),
          avgRating: Math.round(avgRating * 10) / 10,
          ratingCount: rated.length,
        })
      })
    }
  }, [profile])


  const handleSignOut = () => {
    showAlert({ title: 'تسجيل الخروج', message: 'هل أنت متأكد؟', type: 'confirm', buttons: [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'خروج', style: 'destructive', onPress: async () => { await signOut(); router.replace('/') } },
    ] })
  }

  return (
    <>
    <ScrollView style={s.container} contentContainerStyle={s.contentContainer} showsVerticalScrollIndicator={false}>
      <Animated.Text entering={FadeInDown.duration(500)} style={s.title}>حسابي</Animated.Text>

      <Animated.View entering={FadeInDown.duration(500).delay(100)}>
        <LinearGradient
          colors={[colors.accent + '30', colors.navy[800]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.card}
        >
          <View style={s.avatar}>
            <Text style={s.avatarText}>{profile?.name?.[0] ?? '؟'}</Text>
          </View>
          <Text style={s.name}>{profile?.name}</Text>
          <Text style={s.phone}>{profile?.phone ?? profile?.email ?? '—'}</Text>
          <View style={s.roleBadge}>
            <Text style={s.roleText}>سائق</Text>
          </View>
        </LinearGradient>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(500).delay(200)} style={s.statsRow}>
        {[
          { value: stats.total, label: 'إجمالي الطلبات', glow: colors.primaryGlow },
          { value: stats.delivered, label: 'تم التوصيل', glow: colors.successGlow },
          { value: `${stats.earnings.toFixed(0)}`, label: 'ج.م', glow: colors.goldGlow },
          { value: stats.ratingCount > 0 ? `⭐ ${stats.avgRating}` : '—', label: `تقييم (${stats.ratingCount})`, glow: colors.accentGlow },
        ].map((stat, i) => (
          <View key={i} style={s.statCard}>
            <View style={[s.statIconWrap, { backgroundColor: stat.glow }]}>
              <Text style={s.statValue}>{stat.value}</Text>
            </View>
            <Text style={s.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(500).delay(400)} style={s.menuSection}>
        <MenuItem icon={<Edit3 size={18} color={colors.accent} />} label="تعديل البيانات" glow={colors.accentGlow} onPress={() => router.push('/edit-profile')} />
        {biometricAvailable && (
          <View style={s.menuItem}>
            <View style={[s.menuIconWrap, { backgroundColor: colors.primaryGlow }]}>
              <Fingerprint size={18} color={colors.primary} />
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
        {profile?.vehicle_type && (
          <View style={s.menuItem}>
            <View style={[s.menuIconWrap, { backgroundColor: colors.warningGlow }]}>
              <Truck size={18} color={colors.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.menuText}>
                {profile.vehicle_type === 'motorcycle' ? 'موتوسيكل' : profile.vehicle_type === 'car' ? 'سيارة' : 'فان'}
              </Text>
              {profile?.vehicle_number && <Text style={s.menuSubText}>{profile.vehicle_number}</Text>}
            </View>
          </View>
        )}
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(500).delay(500)}>
        <TouchableOpacity style={s.logoutBtn} onPress={handleSignOut} activeOpacity={0.7}>
          <View style={[s.menuIconWrap, { backgroundColor: colors.dangerGlow }]}>
            <LogOut size={18} color={colors.danger} />
          </View>
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

function MenuItem({ icon, label, glow, onPress }: { icon: React.ReactNode; label: string; glow: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={[s.menuIconWrap, { backgroundColor: glow }]}>{icon}</View>
      <Text style={s.menuText}>{label}</Text>
      <ChevronLeft size={18} color={colors.navy[400]} />
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900] },
  contentContainer: { padding: 20, paddingTop: 56, paddingBottom: 100 },
  title: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 24 },
  card: {
    alignItems: 'center', borderRadius: 24,
    padding: 28, borderWidth: 1, borderColor: colors.navy[600], marginBottom: 16,
  },
  avatar: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    borderWidth: 3, borderColor: colors.accentLight,
  },
  avatarText: { fontSize: 28, color: '#fff', fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '800', color: '#fff' },
  phone: { fontSize: 14, color: colors.navy[200], marginTop: 4 },
  roleBadge: {
    backgroundColor: colors.accentGlow, paddingHorizontal: 20, paddingVertical: 6,
    borderRadius: 14, marginTop: 12, borderWidth: 1, borderColor: colors.accent + '30',
  },
  roleText: { color: colors.accent, fontSize: 12, fontWeight: '700' },


  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: colors.navy[800], borderRadius: 18, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: colors.navy[700],
  },
  statIconWrap: {
    width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 10, color: colors.navy[300] },

  menuSection: { gap: 10, marginBottom: 20 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.navy[800],
    borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.navy[700], gap: 12,
  },
  menuIconWrap: {
    width: 36, height: 36, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  menuText: { flex: 1, fontSize: 15, color: '#fff', fontWeight: '600' },
  menuSubText: { fontSize: 11, color: colors.navy[300], marginTop: 2 },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.dangerGlow, borderWidth: 1.5, borderColor: colors.danger + '40',
    borderRadius: 16, padding: 16,
  },
  logoutText: { flex: 1, color: colors.danger, fontSize: 16, fontWeight: '700' },

  bioModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  bioModalContent: { backgroundColor: colors.navy[800], borderRadius: 24, padding: 24, borderWidth: 1, borderColor: colors.navy[600] },
  bioModalTitle: { fontSize: 18, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 8 },
  bioModalHint: { fontSize: 13, color: colors.navy[300], textAlign: 'center', marginBottom: 20 },
  bioFieldLabel: { fontSize: 12, color: colors.navy[200], marginBottom: 4, textAlign: 'right' },
  bioInput: { backgroundColor: colors.navy[700], borderRadius: 12, padding: 14, color: '#fff', fontSize: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.navy[600] },
  bioModalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  bioModalCancel: { flex: 1, borderWidth: 1, borderColor: colors.navy[500], borderRadius: 14, padding: 14, alignItems: 'center' },
  bioModalCancelText: { color: colors.navy[200], fontWeight: '600' },
  bioModalSave: { flex: 2, backgroundColor: colors.primary, borderRadius: 14, padding: 14, alignItems: 'center' },
  bioModalSaveText: { color: '#fff', fontWeight: '700' },
})
