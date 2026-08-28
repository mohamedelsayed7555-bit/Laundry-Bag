import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native'
import { useAuth } from '../../src/contexts/AuthContext'
import { supabase } from '../../src/lib/supabase'
import { colors } from '../../src/theme'

const typeConfig: Record<string, { icon: string; color: string }> = {
  order: { icon: '📦', color: '#3b82f6' },
  offer: { icon: '🎁', color: '#f59e0b' },
  reminder: { icon: '🔔', color: '#8b5cf6' },
  system: { icon: '⚙️', color: '#06b6d4' },
}

export default function MessagesScreen() {
  const { profile } = useAuth()
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setNotifications(data ?? [])
    setLoading(false)
    setRefreshing(false)
  }, [profile])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!profile) return
    const channel = supabase
      .channel('user-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile, load])

  async function markRead(id: string) {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  const onRefresh = () => { setRefreshing(true); load() }

  return (
    <View style={s.container}>
      <Text style={s.title}>الإشعارات</Text>

      {loading ? (
        <Text style={s.emptyText}>جاري التحميل...</Text>
      ) : notifications.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyIcon}>🔔</Text>
          <Text style={s.emptyText}>لا توجد إشعارات</Text>
          <Text style={s.emptySubText}>ستظهر هنا إشعارات الطلبات والعروض</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={i => i.id}
          contentContainerStyle={{ gap: 8, paddingBottom: 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => {
            const cfg = typeConfig[item.type] ?? typeConfig.system
            const isUnread = !item.read_at
            return (
              <TouchableOpacity
                style={[s.notifCard, isUnread && s.notifUnread]}
                activeOpacity={0.7}
                onPress={() => isUnread && markRead(item.id)}
              >
                <View style={[s.iconCircle, { backgroundColor: cfg.color + '20' }]}>
                  <Text style={{ fontSize: 20 }}>{cfg.icon}</Text>
                </View>
                <View style={s.notifContent}>
                  <Text style={[s.notifTitle, isUnread && s.notifTitleUnread]}>{item.title}</Text>
                  <Text style={s.notifBody} numberOfLines={2}>{item.body}</Text>
                  <Text style={s.notifTime}>{timeAgo(item.created_at)}</Text>
                </View>
                {isUnread && <View style={s.unreadDot} />}
              </TouchableOpacity>
            )
          }}
        />
      )}
    </View>
  )
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'الآن'
  if (mins < 60) return `منذ ${mins} دقيقة`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `منذ ${hours} ساعة`
  const days = Math.floor(hours / 24)
  return `منذ ${days} يوم`
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900], padding: 20, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 20 },
  emptyCard: {
    backgroundColor: colors.navy[800], borderRadius: 20, padding: 40,
    alignItems: 'center', borderWidth: 1, borderColor: colors.navy[700],
  },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, color: colors.navy[300], textAlign: 'center' },
  emptySubText: { fontSize: 12, color: colors.navy[400], marginTop: 8 },
  notifCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.navy[800],
    borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.navy[700],
  },
  notifUnread: { backgroundColor: colors.navy[700], borderColor: colors.primary + '40' },
  iconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginLeft: 12 },
  notifContent: { flex: 1 },
  notifTitle: { fontSize: 14, fontWeight: '600', color: colors.navy[200], marginBottom: 2 },
  notifTitleUnread: { color: '#fff', fontWeight: '700' },
  notifBody: { fontSize: 12, color: colors.navy[300], lineHeight: 18 },
  notifTime: { fontSize: 10, color: colors.navy[400], marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginRight: 4 },
})
