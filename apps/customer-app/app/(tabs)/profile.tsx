import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { useAuth } from '../../src/contexts/AuthContext'
import { colors } from '../../src/theme'

export default function ProfileScreen() {
  const { profile, signOut } = useAuth()

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
  name: { fontSize: 20, fontWeight: '700', color: '#fff' },
  phone: { fontSize: 14, color: colors.navy[200], marginTop: 4 },
  codeBadge: {
    backgroundColor: colors.primary + '20', paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: 20, marginTop: 12,
  },
  codeText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: {
    flex: 1, backgroundColor: colors.navy[800], borderRadius: 16, padding: 20,
    alignItems: 'center', borderWidth: 1, borderColor: colors.navy[700],
  },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  statLabel: { fontSize: 12, color: colors.navy[300], marginTop: 4 },
  logoutBtn: {
    borderWidth: 1.5, borderColor: colors.danger, borderRadius: 14,
    padding: 14, alignItems: 'center',
  },
  logoutText: { color: colors.danger, fontSize: 16, fontWeight: '600' },
})
