import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../src/contexts/AuthContext'
import { supabase } from '../../src/lib/supabase'
import { colors } from '../../src/theme'

export default function ProfileScreen() {
  const { profile, signOut } = useAuth()
  const [activeSub, setActiveSub] = useState<any>(null)

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
      { text: 'خروج', style: 'destructive', onPress: signOut },
    ])
  }

  return (
    <View style={s.container}>
      <Text style={s.title}>حسابي</Text>

      <View style={s.card}>
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
      </View>

      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Text style={s.statValue}>{profile?.tier ?? 'bronze'}</Text>
          <Text style={s.statLabel}>المستوى</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statValue}>{profile?.points ?? 0}</Text>
          <Text style={s.statLabel}>النقاط</Text>
        </View>
      </View>

      <View style={s.menuSection}>
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
})
