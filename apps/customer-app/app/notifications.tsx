import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useAuth } from '../src/contexts/AuthContext'
import { useTheme } from '../src/contexts/ThemeContext'
import { useLanguage } from '../src/contexts/LanguageContext'
import { supabase } from '../src/lib/supabase'

type Tab = 'orders' | 'offers'

const typeIcons: Record<string, string> = {
  order: '📦',
  order_update: '📦',
  order_activated: '🕐',
  system: '📢',
  offer: '🎁',
  broadcast: '📢',
  reminder: '⏰',
}

export default function NotificationsScreen() {
  const { profile } = useAuth()
  const { colors } = useTheme()
  const { locale } = useLanguage()
  const router = useRouter()
  const isEn = locale === 'en'

  const [tab, setTab] = useState<Tab>('orders')
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase
      .from('notifications')
      .select('id, title, body, type, data, read_at, created_at')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setNotifications(data ?? [])
    setLoading(false)
  }, [profile])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!profile) return
    const channel = supabase
      .channel('notif-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, () => load())
      .subscribe((status, err) => {
        if (err) console.warn('notifications realtime error:', err.message)
      })
    return () => { supabase.removeChannel(channel) }
  }, [profile, load])

  useFocusEffect(useCallback(() => {
    load()
  }, [load]))

  useEffect(() => {
    if (!profile || notifications.length === 0) return
    const unreadIds = notifications.filter(n => !n.read_at).map(n => n.id)
    if (unreadIds.length === 0) return
    const timer = setTimeout(() => {
      supabase.from('notifications')
        .update({ read_at: new Date().toISOString() })
        .in('id', unreadIds)
        .then(() => {})
    }, 1000)
    return () => clearTimeout(timer)
  }, [profile, notifications])

  const orderTypes = ['order', 'order_update', 'order_activated', 'reminder']
  const filtered = notifications.filter(n => {
    const t = n.type ?? (n.data?.type ?? '')
    if (tab === 'orders') return orderTypes.includes(t)
    return !orderTypes.includes(t)
  })

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return isEn ? 'Just now' : 'الآن'
    if (diffMin < 60) return isEn ? `${diffMin}m ago` : `منذ ${diffMin} د`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return isEn ? `${diffHr}h ago` : `منذ ${diffHr} س`
    const diffDay = Math.floor(diffHr / 24)
    if (diffDay < 7) return isEn ? `${diffDay}d ago` : `منذ ${diffDay} يوم`
    return d.toLocaleDateString(isEn ? 'en-US' : 'ar-EG', { day: 'numeric', month: 'short' })
  }

  const renderItem = ({ item }: { item: any }) => {
    const icon = typeIcons[item.data?.type ?? item.type] ?? '🔔'
    const isUnread = !item.read_at
    return (
      <TouchableOpacity
        style={[s.notifCard, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }, isUnread && { borderColor: colors.primary + '50', backgroundColor: colors.primary + '08' }]}
        onPress={() => {
          if (item.data?.order_id) {
            router.push(`/order/${item.data.order_id}`)
          }
        }}
        activeOpacity={0.7}
      >
        <Text style={s.notifIcon}>{icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[s.notifTitle, { color: colors.text }]}>{item.title}</Text>
          <Text style={[s.notifBody, { color: colors.navy[300] }]} numberOfLines={2}>{item.body}</Text>
          <Text style={[s.notifTime, { color: colors.navy[400] }]}>{formatTime(item.created_at)}</Text>
        </View>
        {isUnread && <View style={[s.unreadDot, { backgroundColor: colors.primary }]} />}
      </TouchableOpacity>
    )
  }

  return (
    <View style={[s.container, { backgroundColor: colors.navy[900] }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[s.backBtn, { color: colors.primary }]}>→ {isEn ? 'Back' : 'رجوع'}</Text>
        </TouchableOpacity>
        <Text style={[s.title, { color: colors.text }]}>🔔 {isEn ? 'Notifications' : 'الإشعارات'}</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={s.tabRow}>
        <TouchableOpacity
          style={[s.tabBtn, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }, tab === 'orders' && { borderColor: colors.primary, backgroundColor: colors.primary + '15' }]}
          onPress={() => setTab('orders')}
        >
          <Text style={[s.tabText, { color: colors.navy[300] }, tab === 'orders' && { color: colors.primary }]}>📦 {isEn ? 'Orders' : 'الطلبات'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tabBtn, { backgroundColor: colors.cardBg, borderColor: colors.navy[700] }, tab === 'offers' && { borderColor: colors.primary, backgroundColor: colors.primary + '15' }]}
          onPress={() => setTab('offers')}
        >
          <Text style={[s.tabText, { color: colors.navy[300] }, tab === 'offers' && { color: colors.primary }]}>📢 {isEn ? 'Offers & News' : 'العروض والأخبار'}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : filtered.length === 0 ? (
        <View style={s.center}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>🔕</Text>
          <Text style={[s.emptyText, { color: colors.navy[300] }]}>
            {tab === 'orders'
              ? (isEn ? 'No order notifications yet' : 'مفيش إشعارات طلبات لسه')
              : (isEn ? 'No offers or news yet' : 'مفيش عروض أو أخبار لسه')
            }
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  backBtn: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700' },
  tabRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 12 },
  tabBtn: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5 },
  tabText: { fontSize: 14, fontWeight: '600' },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  notifCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1 },
  notifIcon: { fontSize: 24, marginTop: 2 },
  notifTitle: { fontSize: 14, fontWeight: '700' },
  notifBody: { fontSize: 13, marginTop: 4, lineHeight: 20 },
  notifTime: { fontSize: 11, marginTop: 6 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 15, fontWeight: '600' },
})
