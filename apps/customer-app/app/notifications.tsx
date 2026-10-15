import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useAuth } from '../src/contexts/AuthContext'
import { useLanguage } from '../src/contexts/LanguageContext'
import { supabase } from '../src/lib/supabase'
import { SkeletonPage } from '../src/components/Skeleton'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Package, Clock, Megaphone, Gift, Bell, CheckCheck, type LucideIcon } from 'lucide-react-native'
import { useBrand, Segmented, IconButton, BackIcon, FlowLines, shortDate, F, HIT } from '../src/components/brand'

type Tab = 'orders' | 'offers'

const TYPE_LOOK: Record<string, { Icon: LucideIcon; color: string }> = {
  order: { Icon: Package, color: '#0EA5E9' },
  order_update: { Icon: Package, color: '#0EA5E9' },
  order_activated: { Icon: Clock, color: '#818CF8' },
  system: { Icon: Megaphone, color: '#A78BFA' },
  offer: { Icon: Gift, color: '#F59E0B' },
  broadcast: { Icon: Megaphone, color: '#A78BFA' },
  reminder: { Icon: Clock, color: '#F59E0B' },
}

export default function NotificationsScreen() {
  const { profile } = useAuth()
  const b = useBrand()
  const insets = useSafeAreaInsets()
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
  const unreadIn = (which: Tab) => notifications.filter(n => {
    const t = n.type ?? (n.data?.type ?? '')
    const mine = which === 'orders' ? orderTypes.includes(t) : !orderTypes.includes(t)
    return mine && !n.read_at
  }).length

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return isEn ? 'Just now' : 'الآن'
    if (diffMin < 60) return isEn ? `${diffMin}m ago` : `من ${diffMin} د`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return isEn ? `${diffHr}h ago` : `من ${diffHr} س`
    const diffDay = Math.floor(diffHr / 24)
    if (diffDay === 1) return isEn ? 'Yesterday' : 'أمس'
    if (diffDay < 7) return isEn ? `${diffDay}d ago` : `من ${diffDay} يوم`
    return shortDate(d, isEn)
  }

  // Day header above each group, like the chat screen
  const dayLabel = (iso: string) => {
    const d = new Date(iso)
    const today = new Date(); const yest = new Date(); yest.setDate(today.getDate() - 1)
    const k = d.toDateString()
    if (k === today.toDateString()) return isEn ? 'Today' : 'اليوم'
    if (k === yest.toDateString()) return isEn ? 'Yesterday' : 'أمس'
    return shortDate(d, isEn)
  }
  type Row = { kind: 'day'; key: string; label: string } | { kind: 'item'; key: string; item: any }
  const rows: Row[] = []
  let lastDay = ''
  for (const item of filtered) {
    const label = dayLabel(item.created_at)
    if (label !== lastDay) { rows.push({ kind: 'day', key: 'd-' + label, label }); lastDay = label }
    rows.push({ kind: 'item', key: item.id, item })
  }

  const markAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.read_at).map(n => n.id)
    if (unreadIds.length === 0) return
    setNotifications(prev => prev.map(n => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })))
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', unreadIds)
  }

  const openNotification = (item: any) => {
    const d = item.data ?? {}
    if (d.type === 'chat' || d.type === 'message') { if (d.order_id) router.push(`/chat/${d.order_id}`); return }
    if (d.type === 'subscription' || d.subscription_id) { router.push('/plans'); return }
    if (d.order_id) router.push(`/order/${d.order_id}`)
  }

  const renderRow = ({ item: row }: { item: Row }) => {
    if (row.kind === 'day') {
      return <Text style={[n.day, { color: b.muted }]}>{row.label}</Text>
    }
    const item = row.item
    const key = item.data?.type ?? item.type ?? ''
    const { Icon, color } = TYPE_LOOK[key] ?? { Icon: Bell, color: '#0EA5E9' }
    const isUnread = !item.read_at
    return (
      <TouchableOpacity
        style={[n.row, { backgroundColor: isUnread ? b.tint : b.card, borderColor: b.cardBorder }]}
        onPress={() => openNotification(item)}
        activeOpacity={0.75}
        accessibilityRole="button"
      >
        <View style={[n.icon, { backgroundColor: color + '22' }]}><Icon size={18} color={color} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[n.title, { color: b.ink }]} numberOfLines={1}>{item.title}</Text>
          {item.body ? <Text style={[n.body, { color: b.muted }]} numberOfLines={2}>{item.body}</Text> : null}
        </View>
        <View style={n.meta}>
          <Text style={[n.time, { color: b.faint }]}>{formatTime(item.created_at)}</Text>
          {isUnread && <View style={[n.dot, { backgroundColor: b.primary }]} />}
        </View>
      </TouchableOpacity>
    )
  }

  const hasUnread = notifications.some(x => !x.read_at)

  return (
    <View style={[n.container, { backgroundColor: b.page, paddingTop: insets.top + 10 }]}>
      <FlowLines height={240} />

      <View style={n.header}>
        <IconButton onPress={() => router.back()} label={isEn ? 'Back' : 'رجوع'}><BackIcon color={b.ink} /></IconButton>
        <Text style={[n.pageTitle, { color: b.ink }]}>{isEn ? 'Notifications' : 'الإشعارات'}</Text>
        {hasUnread && (
          <TouchableOpacity onPress={markAllRead} style={n.markBtn} hitSlop={HIT} accessibilityRole="button">
            <CheckCheck size={15} color={b.tintText} />
            <Text style={[n.markText, { color: b.tintText }]}>{isEn ? 'Mark all' : 'تعليم الكل'}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={n.segWrap}>
        <Segmented
          value={tab}
          onChange={k => setTab(k as Tab)}
          items={[
            { key: 'orders', label: isEn ? 'Orders' : 'الطلبات', badge: unreadIn('orders') || undefined },
            { key: 'offers', label: isEn ? 'Offers' : 'العروض', badge: unreadIn('offers') || undefined },
          ]}
        />
      </View>

      {loading ? (
        <SkeletonPage />
      ) : rows.length === 0 ? (
        <View style={n.center}>
          <View style={[n.emptyIcon, { backgroundColor: b.iconTile }]}><Bell size={34} color={b.faint} /></View>
          <Text style={[n.emptyTitle, { color: b.ink }]}>{isEn ? 'No notifications' : 'مفيش إشعارات'}</Text>
          <Text style={[n.emptyText, { color: b.muted }]}>
            {tab === 'orders'
              ? (isEn ? 'Updates about your orders will show here' : 'تحديثات طلباتك هتظهر هنا')
              : (isEn ? 'Offers and news will show here' : 'العروض والأخبار هتظهر هنا')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={r => r.key}
          renderItem={renderRow}
          contentContainerStyle={n.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  )
}

const n = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, marginBottom: 12 },
  pageTitle: { flex: 1, fontSize: 18, fontFamily: F.display },
  markBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  markText: { fontSize: 12, fontFamily: F.bold },
  segWrap: { paddingHorizontal: 16, marginBottom: 10 },
  list: { paddingHorizontal: 16, paddingBottom: 30 },
  day: { fontSize: 11, fontFamily: F.bold, marginTop: 10, marginBottom: 6, marginHorizontal: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1, padding: 11, marginBottom: 8 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 13, fontFamily: F.bold },
  body: { fontSize: 11.5, fontFamily: F.regular, lineHeight: 18, marginTop: 2 },
  meta: { alignItems: 'center', gap: 5 },
  time: { fontSize: 10, fontFamily: F.regular },
  dot: { width: 7, height: 7, borderRadius: 4 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, paddingBottom: 60 },
  emptyIcon: { width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontSize: 16, fontFamily: F.display },
  emptyText: { fontSize: 13, fontFamily: F.regular, textAlign: 'center', marginTop: 4, lineHeight: 21 },
})
