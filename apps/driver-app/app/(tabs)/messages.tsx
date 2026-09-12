import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Vibration } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../src/contexts/AuthContext'
import { supabase } from '../../src/lib/supabase'
import { colors } from '../../src/theme'
import { playNotificationSound, sendLocalNotification } from '../../src/hooks/useNotifications'

type Conversation = {
  order_id: string
  other_id: string
  other_name: string
  last_message: string
  last_time: string
  unread: number
  order_number: string
}

export default function MessagesScreen() {
  const { profile } = useAuth()
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

    const { data: users } = await supabase.from('users').select('id, name').in('id', [...otherIds])
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
        other_name: userMap.get(otherId) ?? 'عميل',
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
      .channel('driver-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${profile.id}` }, (payload) => { playNotificationSound('order-update'); Vibration.vibrate(300); sendLocalNotification('رسالة جديدة', (payload.new as any).body ?? '', 'messages'); load() })
      .subscribe((status, err) => {
        if (err) console.warn('driver-messages realtime error:', err.message)
      })
    return () => { supabase.removeChannel(channel) }
  }, [profile, load])

  return (
    <View style={s.container}>
      <Text style={s.title}>المحادثات</Text>

      {loading ? (
        <Text style={s.emptyText}>جاري التحميل...</Text>
      ) : conversations.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyIcon}>💬</Text>
          <Text style={s.emptyText}>لا توجد محادثات</Text>
          <Text style={s.emptySubText}>ستظهر هنا محادثاتك مع العملاء</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={i => i.order_id}
          contentContainerStyle={{ gap: 10, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.convoCard, item.unread > 0 && s.convoUnread]}
              onPress={() => router.push(`/chat/${item.order_id}`)}
              activeOpacity={0.7}
            >
              <View style={s.avatar}>
                <Text style={s.avatarText}>{item.other_name[0] ?? '?'}</Text>
              </View>
              <View style={s.convoContent}>
                <View style={s.convoHeader}>
                  <Text style={[s.convoName, item.unread > 0 && { color: '#fff' }]}>{item.other_name}</Text>
                  <Text style={s.convoTime}>{timeAgo(item.last_time)}</Text>
                </View>
                <Text style={s.convoOrderId} numberOfLines={1}>طلب #{item.order_number || item.order_id.slice(0, 8)}</Text>
                <Text style={[s.convoLastMsg, item.unread > 0 && { color: colors.navy[100] }]} numberOfLines={1}>{item.last_message}</Text>
              </View>
              {item.unread > 0 && (
                <View style={s.badge}><Text style={s.badgeText}>{item.unread}</Text></View>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  )
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'الآن'
  if (mins < 60) return `${mins} د`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} س`
  const time = d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true })
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} ي · ${time}`
  return d.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' }) + ` · ${time}`
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900], padding: 20, paddingTop: 56 },
  title: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 20 },
  emptyCard: {
    backgroundColor: colors.navy[800], borderRadius: 22, padding: 40,
    alignItems: 'center', borderWidth: 1, borderColor: colors.navy[700],
  },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, color: colors.navy[300], textAlign: 'center' },
  emptySubText: { fontSize: 12, color: colors.navy[400], marginTop: 8 },
  convoCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.navy[800],
    borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.navy[700],
  },
  convoUnread: { backgroundColor: colors.navy[700], borderColor: colors.accent + '40' },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accent + '25',
    justifyContent: 'center', alignItems: 'center', marginLeft: 12,
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.accent },
  convoContent: { flex: 1 },
  convoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convoName: { fontSize: 15, fontWeight: '700', color: colors.navy[100] },
  convoTime: { fontSize: 10, color: colors.navy[400] },
  convoOrderId: { fontSize: 10, color: colors.navy[400], marginTop: 1 },
  convoLastMsg: { fontSize: 13, color: colors.navy[300], marginTop: 2 },
  badge: {
    backgroundColor: colors.accent, borderRadius: 10, minWidth: 20, height: 20,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6, marginRight: 4,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
})
