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
  order_number: string
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
    const { data, error } = await supabase.rpc('get_conversations', { p_user_id: profile.id })

    if (error || !data || data.length === 0) {
      setConversations([])
      setLoading(false)
      setRefreshing(false)
      return
    }

    setConversations(data)
    setLoading(false)
    setRefreshing(false)
  }, [profile])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!profile) return
    const channel = supabase
      .channel('user-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${profile.id}` }, (payload) => { playNotificationSound('order-update'); Vibration.vibrate(300); sendLocalNotification(t('newMessage'), (payload.new as any).body ?? '', 'messages'); load() })
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
                <Text style={[s.convoOrderId, { color: colors.navy[400] }]}>{t('order') || 'طلب'} #{item.order_number || item.order_id.slice(0, 8)}</Text>
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
  const d = new Date(dateStr)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const time = d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: true })
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d · ${time}`
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' }) + ` · ${time}`
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
    flexDirection: 'row', alignItems: 'center', gap: 12,
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
  convoOrderId: { fontSize: 11, marginTop: 2 },
  convoLastMsg: { fontSize: 13, marginTop: 2 },
  badge: {
    borderRadius: 10, minWidth: 20, height: 20,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6, marginRight: 4,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
})
