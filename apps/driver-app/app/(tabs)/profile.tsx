import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert, Switch } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import { useAuth } from '../../src/contexts/AuthContext'
import { supabase } from '../../src/lib/supabase'
import { colors } from '../../src/theme'

export default function DriverProfileScreen() {
  const { profile, signOut, refreshProfile } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState({ total: 0, delivered: 0, earnings: 0 })
  const [isOnline, setIsOnline] = useState(profile?.is_active ?? false)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    if (profile) {
      setIsOnline(profile.is_active)
      supabase.from('orders').select('status, total').eq('driver_id', profile.id).then(({ data }) => {
        const orders = data ?? []
        const delivered = orders.filter(o => o.status === 'delivered')
        setStats({
          total: orders.length,
          delivered: delivered.length,
          earnings: delivered.reduce((s, o) => s + (o.total ?? 0), 0),
        })
      })
    }
  }, [profile])

  async function toggleAvailability(value: boolean) {
    if (!profile) return
    setToggling(true)
    setIsOnline(value)
    const { error } = await supabase.from('users').update({ is_active: value }).eq('id', profile.id)
    if (error) {
      setIsOnline(!value)
      Alert.alert('خطأ', 'حدث خطأ أثناء تغيير الحالة')
    } else {
      await refreshProfile()
    }
    setToggling(false)
  }

  const handleSignOut = () => {
    Alert.alert('تسجيل الخروج', 'هل أنت متأكد؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'خروج', style: 'destructive', onPress: async () => { await signOut(); router.replace('/') } },
    ])
  }

  return (
    <View style={s.container}>
      <Animated.Text entering={FadeInDown.duration(500)} style={s.title}>حسابي</Animated.Text>

      <Animated.View entering={FadeInDown.duration(500).delay(100)} style={s.card}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{profile?.name?.[0] ?? '؟'}</Text>
        </View>
        <Text style={s.name}>{profile?.name}</Text>
        <Text style={s.phone}>{profile?.phone ?? profile?.email ?? '—'}</Text>
        <View style={s.roleBadge}>
          <Text style={s.roleText}>سائق</Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(500).delay(200)} style={s.onlineCard}>
        <View style={s.onlineRow}>
          <View style={s.onlineInfo}>
            <View style={[s.statusDot, { backgroundColor: isOnline ? colors.success : colors.danger }]} />
            <Text style={s.onlineLabel}>{isOnline ? 'متاح للطلبات' : 'غير متاح'}</Text>
          </View>
          <Switch
            value={isOnline}
            onValueChange={toggleAvailability}
            disabled={toggling}
            trackColor={{ false: colors.navy[600], true: colors.primary + '60' }}
            thumbColor={isOnline ? colors.primary : colors.navy[400]}
          />
        </View>
        <Text style={s.onlineHint}>{isOnline ? 'ستصلك طلبات جديدة' : 'لن تصلك طلبات جديدة'}</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(500).delay(300)} style={s.statsRow}>
        <View style={s.statCard}>
          <Text style={s.statValue}>{stats.total}</Text>
          <Text style={s.statLabel}>إجمالي الطلبات</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statValue}>{stats.delivered}</Text>
          <Text style={s.statLabel}>تم التوصيل</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statValue}>{stats.earnings.toFixed(0)}</Text>
          <Text style={s.statLabel}>ج.م</Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(500).delay(400)} style={s.menuSection}>
        <TouchableOpacity style={s.menuItem} onPress={() => router.push('/edit-profile')}>
          <Text style={s.menuIcon}>✏️</Text>
          <Text style={s.menuText}>تعديل البيانات</Text>
          <Text style={s.menuArrow}>←</Text>
        </TouchableOpacity>
      </Animated.View>

      {profile?.vehicle_type && (
        <Animated.View entering={FadeInDown.duration(500).delay(500)}>
        <View style={s.infoCard}>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>المركبة</Text>
            <Text style={s.infoValue}>{profile.vehicle_type === 'motorcycle' ? 'موتوسيكل' : profile.vehicle_type === 'car' ? 'سيارة' : 'فان'}</Text>
          </View>
          {profile?.vehicle_number && (
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>رقم المركبة</Text>
              <Text style={s.infoValue}>{profile.vehicle_number}</Text>
            </View>
          )}
        </View>
        </Animated.View>
      )}

      <Animated.View entering={FadeInDown.duration(500).delay(600)}>
      <TouchableOpacity style={s.logoutBtn} onPress={handleSignOut}>
        <Text style={s.logoutText}>تسجيل الخروج</Text>
      </TouchableOpacity>
      </Animated.View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900], padding: 20, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 24 },
  card: {
    alignItems: 'center', backgroundColor: colors.navy[800], borderRadius: 20,
    padding: 28, borderWidth: 1, borderColor: colors.navy[700], marginBottom: 16,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  avatarText: { fontSize: 28, color: '#fff', fontWeight: 'bold' },
  name: { fontSize: 20, fontWeight: '700', color: '#fff' },
  phone: { fontSize: 14, color: colors.navy[200], marginTop: 4 },
  roleBadge: {
    backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 4, borderRadius: 12, marginTop: 12,
  },
  roleText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  onlineCard: {
    backgroundColor: colors.navy[800], borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: colors.navy[700], marginBottom: 16,
  },
  onlineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  onlineInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  onlineLabel: { fontSize: 15, color: '#fff', fontWeight: '700' },
  onlineHint: { fontSize: 11, color: colors.navy[300], marginTop: 6 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: colors.navy[800], borderRadius: 16, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: colors.navy[700],
  },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  statLabel: { fontSize: 10, color: colors.navy[300], marginTop: 4 },

  menuSection: { gap: 8, marginBottom: 16 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.navy[800],
    borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.navy[700],
  },
  menuIcon: { fontSize: 20, marginLeft: 12 },
  menuText: { flex: 1, fontSize: 15, color: '#fff', fontWeight: '600' },
  menuArrow: { fontSize: 18, color: colors.navy[400] },

  infoCard: {
    backgroundColor: colors.navy[800], borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: colors.navy[700], marginBottom: 16, gap: 12,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoLabel: { fontSize: 13, color: colors.navy[300], flex: 1 },
  infoValue: { fontSize: 13, color: '#fff', fontWeight: '600' },
  logoutBtn: {
    borderWidth: 1.5, borderColor: colors.danger, borderRadius: 14,
    padding: 14, alignItems: 'center',
  },
  logoutText: { color: colors.danger, fontSize: 16, fontWeight: '600' },
})
