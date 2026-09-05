import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Vibration } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../src/contexts/AuthContext'
import { useTheme } from '../../src/contexts/ThemeContext'
import { useLanguage } from '../../src/contexts/LanguageContext'
import { supabase } from '../../src/lib/supabase'
import { playNotificationSound, sendLocalNotification } from '../../src/hooks/useNotifications'

type Conversation = {
  order_id: string
  other_id: string
  other_name: string
  last_message: string
  last_time: string
  unread: number
}

export default function MessagesScreen() {
  const { profile } = useAuth()
  const { colors } = useTheme()
  const { t } = useLanguage()
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!profile) return
    const { data: msgs } = await supabase
      .from('messages')
      .select('id, order_id, sender_id, receiver_id, body, read_at, created_at')
      .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
      .order('created_at', { ascending: false })

    if (!msgs || msgs.length === 0) {
      setConversations([])
      setLoading(false)
      setRefreshing(false)
      return
    }

    const orderMap = new Map<string, { msgs: any[] }>()
    for (const m of msgs) {
      if (!orderMap.has(m.order_id)) orderMap.set(m.order_id, { msgs: [] })
      orderMap.get(m.order_id)!.msgs.push(m)
    }

    const otherIds = new Set<string>()
    for (const m of msgs) {
      const otherId = m.sender_id === profile.id ? m.receiver_id : m.sender_id
      otherIds.add(otherId)
    }

    const { data: users } = await supabase
      .from('users')
      .select('id, name')
      .in('id', [...otherIds])

    const userMap = new Map<string, string>()
    for (const u of users ?? []) userMap.set(u.id, u.name)

    const convos: Conversation[] = []
    for (const [orderId, { msgs: orderMsgs }] of orderMap) {
      const last = orderMsgs[0]
      const otherId = last.sender_id === profile.id ? last.receiver_id : last.sender_id
      const unread = orderMsgs.filter(m => m.receiver_id === profile.id && !m.read_at).length
      convos.push({
        order_id: orderId,
        other_id: otherId,
        other_name: userMap.get(otherId) ?? 'Driver',
        last_message: last.body,
        last_time: last.created_at,
        unread,
      })
    }

    setConversations(convos)
    setLoading(false)
    setRefreshing(false)
  }, [profile])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!profile) return
    const channel = supabase
      .channel('user-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${profile.id}` }, (payload) => { playNotificationSound('order-update'); Vibration.vibrate(300); sendLocalNotification('رسالة جديدة', (payload.new as any).body ?? '', 'messages'); load() })
      .subscribe((status, err) => {
        if (err) console.warn('user-messages realtime error:', err.message)
      })
    return () => { supabase.removeChannel(channel) }
  }, [profile, load])

  return (
    <View style={[s.container, { backgroundColor: colors.navy[900] }]}>
      <Text style={[s.title, { color: colors.text }]}>{t('messages')}</Text>

      {loading ? (
        <Text style={[s.emptyText, { color: colors.navy[300] }]}>{t('loading')}</Text>
      ) : conversations.length === 0 ? (
        <View style={[s.emptyCard, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }]}>
          <Text style={s.emptyIcon}>💬</Text>
          <Text style={[s.emptyText, { color: colors.navy[300] }]}>{t('noMessages')}</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={i => i.order_id}
          contentContainerStyle={{ gap: 8, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.convoCard, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }, item.unread > 0 && { backgroundColor: colors.navy[700], borderColor: colors.primary + '40' }]}
              onPress={() => router.push(`/chat/${item.order_id}`)}
            >
              <View style={[s.avatar, { backgroundColor: colors.primary + '25' }]}>
                <Text style={[s.avatarText, { color: colors.primary }]}>{item.other_name[0] ?? '?'}</Text>
              </View>
              <View style={s.convoContent}>
                <View style={s.convoHeader}>
                  <Text style={[s.convoName, { color: colors.navy[100] }, item.unread > 0 && { color: colors.text }]}>{item.other_name}</Text>
                  <Text style={[s.convoTime, { color: colors.navy[400] }]}>{timeAgo(item.last_time)}</Text>
                </View>
                <Text style={[s.convoLastMsg, { color: colors.navy[300] }, item.unread > 0 && { color: colors.navy[100] }]} numberOfLines={1}>{item.last_message}</Text>
              </View>
              {item.unread > 0 && (
                <View style={[s.badge, { backgroundColor: colors.primary }]}><Text style={s.badgeText}>{item.unread}</Text></View>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  )
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 56 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 20 },
  emptyCard: {
    borderRadius: 20, padding: 40,
    alignItems: 'center', borderWidth: 1,
  },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, textAlign: 'center' },
  convoCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, padding: 14, borderWidth: 1,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center', marginLeft: 12,
  },
  avatarText: { fontSize: 18, fontWeight: '700' },
  convoContent: { flex: 1 },
  convoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convoName: { fontSize: 15, fontWeight: '700' },
  convoTime: { fontSize: 10 },
  convoLastMsg: { fontSize: 13, marginTop: 2 },
  badge: {
    borderRadius: 10, minWidth: 20, height: 20,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6, marginRight: 4,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
})
