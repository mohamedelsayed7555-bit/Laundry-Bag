import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Vibration, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { MessageCircle } from 'lucide-react-native'
import { useAuth } from '../../src/contexts/AuthContext'
import { useLanguage } from '../../src/contexts/LanguageContext'
import { supabase } from '../../src/lib/supabase'
import { notifyMessage } from '../../src/hooks/useNotifications'
import { useBrand, Card, F, clock, shortDate } from '../../src/components/brand'

type Conversation = {
  order_id: string
  other_id: string
  other_name: string
  last_message: string
  last_time: string
  unread: number
  order_number: string
}

const AVATAR = 46

export default function MessagesScreen() {
  const { profile } = useAuth()
  const b = useBrand()
  const { t, locale } = useLanguage()
  const isEn = locale === 'en'
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${profile.id}` }, (payload) => { notifyMessage(payload.new as any, t('newMessage')); load() })
      .subscribe((status, err) => {
        if (err) console.warn('user-messages realtime error:', err.message)
      })
    return () => { supabase.removeChannel(channel) }
  }, [profile, load])

  const timeLabel = (dateStr: string) => {
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return ''
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)
    if (d.toDateString() === today.toDateString()) return clock(d, isEn)
    if (d.toDateString() === yesterday.toDateString()) return t('chatYesterday')
    return shortDate(d, isEn)
  }

  return (
    <View style={[s.container, { backgroundColor: b.page }]}>
      <Text style={[s.title, { color: b.ink }]}>{t('messages')}</Text>

      {loading ? (
        <View style={s.loading}>
          <ActivityIndicator color={b.primary} />
          <Text style={[s.emptyText, { color: b.muted }]}>{t('loading')}</Text>
        </View>
      ) : conversations.length === 0 ? (
        <View style={s.pad}>
          <Card style={s.emptyCard}>
            <View style={[s.emptyIcon, { backgroundColor: b.iconTile }]}>
              <MessageCircle size={30} color={b.accentIcon} />
            </View>
            <Text style={[s.emptyText, { color: b.muted }]}>{t('noMessages')}</Text>
          </Card>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={i => i.order_id}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={b.primary} />}
          ItemSeparatorComponent={() => <View style={[s.sep, { backgroundColor: b.divider }]} />}
          renderItem={({ item }) => {
            const unread = item.unread > 0
            const num = String(item.order_number || item.order_id.slice(0, 8)).replace(/^#/, '')
            return (
              <TouchableOpacity
                style={s.row}
                activeOpacity={0.7}
                onPress={() => router.push(`/chat/${item.order_id}`)}
                accessibilityRole="button"
                accessibilityLabel={item.other_name}
              >
                <LinearGradient colors={['#38BDF8', '#0284C7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.avatar}>
                  <Text style={s.avatarText}>{item.other_name?.[0] ?? '?'}</Text>
                </LinearGradient>
                <View style={s.content}>
                  <View style={s.line}>
                    <Text style={[s.name, { color: b.ink, fontFamily: unread ? F.bold : F.semibold }]} numberOfLines={1}>{item.other_name}</Text>
                    <Text style={[s.time, unread ? { color: b.primary, fontFamily: F.bold } : { color: b.faint }]}>{timeLabel(item.last_time)}</Text>
                  </View>
                  <View style={[s.line, { marginTop: 3 }]}>
                    <View style={s.lastRow}>
                      <View style={[s.orderChip, { backgroundColor: b.tint }]}>
                        <Text style={[s.orderChipText, { color: b.tintText }]}>{t('order') || 'طلب'} #{num}</Text>
                      </View>
                      <Text
                        style={[s.lastMsg, unread ? { color: b.ink2, fontFamily: F.semibold } : { color: b.muted }]}
                        numberOfLines={1}
                      >
                        {item.last_message}
                      </Text>
                    </View>
                    {unread && (
                      <View style={[s.badge, { backgroundColor: b.primary }]}><Text style={s.badgeText}>{item.unread}</Text></View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            )
          }}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, paddingTop: 56 },
  title: { fontSize: 20, fontFamily: F.display, paddingHorizontal: 16, marginBottom: 8 },
  pad: { paddingHorizontal: 16, paddingTop: 8 },
  loading: { alignItems: 'center', gap: 10, paddingTop: 40 },
  emptyCard: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyText: { fontSize: 14, fontFamily: F.medium, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 16, paddingVertical: 11 },
  sep: { height: StyleSheet.hairlineWidth * 2, marginStart: 16 + AVATAR + 11, marginEnd: 16 },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 17, fontFamily: F.display },
  content: { flex: 1, minWidth: 0 },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontSize: 14.5 },
  time: { fontSize: 11, fontFamily: F.regular },
  lastRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  orderChip: { borderRadius: 7, paddingHorizontal: 6, paddingVertical: 1 },
  orderChipText: { fontSize: 10.5, fontFamily: F.bold },
  lastMsg: { flex: 1, fontSize: 12.5, fontFamily: F.regular },
  badge: {
    borderRadius: 10, minWidth: 20, height: 20,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6,
  },
  badgeText: { color: '#fff', fontSize: 11, fontFamily: F.bold },
})
