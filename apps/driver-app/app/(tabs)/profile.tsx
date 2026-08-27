import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { useAuth } from '../../src/contexts/AuthContext'
import { supabase } from '../../src/lib/supabase'
import { colors } from '../../src/theme'

export default function DriverProfileScreen() {
  const { profile, signOut } = useAuth()
  const [stats, setStats] = useState({ total: 0, delivered: 0, earnings: 0 })

  useEffect(() => {
    if (profile) {
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

  const handleSignOut = () => {
    Alert.alert('تسجيل الخروج', 'هل أنت متأكد؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'خروج', style: 'destructive', onPress: signOut },
    ])
  }

  return (
    <View style={s.container}>
      <Text style={s.title}>حسابي</Text>

      <View style={s.card}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{profile?.name?.[0] ?? '؟'}</Text>
        </View>
        <Text style={s.name}>{profile?.name}</Text>
        <Text style={s.phone}>{profile?.phone ?? profile?.email ?? '—'}</Text>
        <View style={s.roleBadge}>
          <Text style={s.roleText}>سائق</Text>
        </View>
      </View>

      <View style={s.statsRow}>
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
      </View>

      <View style={s.infoCard}>
        <View style={s.infoRow}>
          <Text style={s.infoLabel}>الحالة</Text>
          <View style={[s.statusDot, { backgroundColor: profile?.is_active ? colors.success : colors.danger }]} />
          <Text style={[s.infoValue, { color: profile?.is_active ? colors.success : colors.danger }]}>
            {profile?.is_active ? 'متاح' : 'غير متاح'}
          </Text>
        </View>
        {profile?.vehicle_type && (
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>المركبة</Text>
            <Text style={s.infoValue}>{profile.vehicle_type === 'motorcycle' ? 'موتوسيكل' : profile.vehicle_type === 'car' ? 'سيارة' : 'فان'}</Text>
          </View>
        )}
        {profile?.vehicle_number && (
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>رقم المركبة</Text>
            <Text style={s.infoValue}>{profile.vehicle_number}</Text>
          </View>
        )}
      </View>

      <TouchableOpacity style={s.logoutBtn} onPress={handleSignOut}>
        <Text style={s.logoutText}>تسجيل الخروج</Text>
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900], padding: 20, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 24 },
  card: {
    alignItems: 'center', backgroundColor: colors.navy[800], borderRadius: 20,
    padding: 28, borderWidth: 1, borderColor: colors.navy[700], marginBottom: 20,
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
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: colors.navy[800], borderRadius: 16, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: colors.navy[700],
  },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  statLabel: { fontSize: 10, color: colors.navy[300], marginTop: 4 },
  infoCard: {
    backgroundColor: colors.navy[800], borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: colors.navy[700], marginBottom: 24, gap: 12,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoLabel: { fontSize: 13, color: colors.navy[300], flex: 1 },
  infoValue: { fontSize: 13, color: '#fff', fontWeight: '600' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  logoutBtn: {
    borderWidth: 1.5, borderColor: colors.danger, borderRadius: 14,
    padding: 14, alignItems: 'center',
  },
  logoutText: { color: colors.danger, fontSize: 16, fontWeight: '600' },
})
