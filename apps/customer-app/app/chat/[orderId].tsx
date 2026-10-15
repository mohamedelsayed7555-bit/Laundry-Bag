import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Vibration, I18nManager } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Check, CheckCheck, SendHorizontal, WashingMachine, Shirt, Droplet, Sparkles, Truck, Package, Wind, Sun } from 'lucide-react-native'
import { useBrand, IconButton, BackIcon, F, clock, shortDate } from '../../src/components/brand'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useAuth } from '../../src/contexts/AuthContext'
import { useLanguage } from '../../src/contexts/LanguageContext'
import { supabase } from '../../src/lib/supabase'
import { notifyMessage, setActiveChat } from '../../src/hooks/useNotifications'

type Message = {
  id: string
  sender_id: string
  receiver_id: string
  body: string
  created_at: string
  read_at: string | null
}

const closedStatuses = ['delivered', 'cancelled']

export default function ChatScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>()
  const { profile } = useAuth()
  const { t, locale } = useLanguage()
  const b = useBrand()
  const insets = useSafeAreaInsets()
  const isEn = locale === 'en'
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [otherName, setOtherName] = useState(t('theDriver'))
  const [orderStatus, setOrderStatus] = useState<string | null>(null)
  const [orderNumber, setOrderNumber] = useState<string | null>(null)
  const flatListRef = useRef<FlatList>(null)

  const chatClosed = orderStatus !== null && closedStatuses.includes(orderStatus)

  const load = useCallback(async () => {
    if (!profile || !orderId) return

    const [{ data }, { data: orderData }] = await Promise.all([
      supabase
        .from('messages')
        .select('id, sender_id, receiver_id, body, read_at, created_at')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true })
        .limit(200),
      supabase
        .from('orders')
        .select('status, order_number')
        .eq('id', orderId)
        .eq('customer_id', profile.id)
        .single(),
    ])

    setMessages(data ?? [])
    if (orderData) { setOrderStatus(orderData.status); setOrderNumber(orderData.order_number) }

    const unread = (data ?? []).filter(m => m.receiver_id === profile.id && !m.read_at)
    if (unread.length > 0) {
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('order_id', orderId)
        .eq('receiver_id', profile.id)
        .is('read_at', null)
    }

    const otherMsg = (data ?? []).find(m => m.sender_id !== profile.id)
    if (otherMsg) {
      const { data: user } = await supabase.from('users').select('name').eq('id', otherMsg.sender_id).single()
      if (user) setOtherName(user.name)
    }
  }, [profile, orderId])

  useEffect(() => { load() }, [load])

  // While this chat is open its messages only get a soft in-chat sound, not a banner.
  useEffect(() => {
    if (!orderId) return
    setActiveChat(orderId)
    return () => setActiveChat(null)
  }, [orderId])

  useEffect(() => {
    if (!profile || !orderId) return
    const channel = supabase
      .channel(`chat-${orderId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `order_id=eq.${orderId}` }, (payload) => {
        const newMsg = payload.new as Message
        setMessages(prev => [...prev, newMsg])
        if (newMsg.sender_id !== profile.id) {
          notifyMessage({ id: newMsg.id, order_id: orderId, body: newMsg.body }, t('newMessage'))
        }
        if (newMsg.receiver_id === profile.id) {
          supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', newMsg.id)
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, (payload) => {
        const newStatus = (payload.new as any).status
        if (newStatus) setOrderStatus(newStatus)
      })
      .subscribe((status, err) => {
        if (err) console.warn('chat realtime error:', err.message)
      })
    return () => { supabase.removeChannel(channel) }
  }, [profile, orderId])

  async function handleSend() {
    if (!text.trim() || !profile || !orderId || chatClosed) return

    const { data: order } = await supabase.from('orders').select('driver_id').eq('id', orderId).eq('customer_id', profile.id).single()
    if (!order?.driver_id) return

    setSending(true)
    const msgBody = text.trim()
    await supabase.from('messages').insert({
      order_id: orderId,
      sender_id: profile.id,
      receiver_id: order.driver_id,
      body: msgBody,
    })

    setText('')
    setSending(false)
  }

  const isMe = (msg: Message) => msg.sender_id === profile?.id
  const cleanNumber = (n?: string | null) => (n ?? '').replace(/^#+/, '')

  // Messages plus day separators ("اليوم" / "أمس" / "15 أكتوبر"); consecutive messages from the same
  // sender are grouped (tighter gap, no squared "tail" corner).
  type Row = { kind: 'day'; key: string; label: string } | { kind: 'msg'; key: string; msg: Message; grouped: boolean }
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    const today = new Date(); const yest = new Date(); yest.setDate(today.getDate() - 1)
    let lastDay = ''
    let lastSender = ''
    for (const m of messages) {
      const d = new Date(m.created_at)
      const dayKey = d.toDateString()
      if (dayKey !== lastDay) {
        const label = dayKey === today.toDateString() ? t('chatToday') : dayKey === yest.toDateString() ? t('chatYesterday') : shortDate(d, isEn)
        out.push({ kind: 'day', key: 'd-' + dayKey, label })
        lastDay = dayKey
        lastSender = ''
      }
      out.push({ kind: 'msg', key: m.id, msg: m, grouped: lastSender === m.sender_id })
      lastSender = m.sender_id
    }
    return out
  }, [messages, isEn])

  // WhatsApp-style doodle wallpaper made of laundry icons (positions fixed once).
  const doodles = useMemo(() => {
    const icons = [WashingMachine, Shirt, Droplet, Sparkles, Truck, Package, Wind, Sun]
    let seed = 7
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 }
    const out: { Icon: typeof Shirt; x: number; y: number; r: number }[] = []
    for (let row = 0; row < 22; row++) {
      for (let col = 0; col < 7; col++) {
        out.push({ Icon: icons[Math.floor(rnd() * icons.length)], x: col * 62 + (row % 2 ? 31 : 0) + rnd() * 10 - 5, y: row * 48 + rnd() * 10 - 5, r: Math.round(rnd() * 50 - 25) })
      }
    }
    return out
  }, [])

  const wallBg = b.isDark ? '#0B1424' : '#EAF1F8'
  const doodleColor = b.isDark ? 'rgba(56,189,248,0.07)' : 'rgba(2,132,199,0.09)'
  const mineBg = b.isDark ? '#0B5E8E' : '#D4EEFC'
  const theirsBg = b.isDark ? '#1A2740' : '#FFFFFF'

  return (
    <KeyboardAvoidingView style={[s.container, { backgroundColor: wallBg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden', direction: 'ltr' }]}>
        {doodles.map((d, i) => (
          <View key={i} style={{ position: 'absolute', left: d.x, top: d.y, transform: [{ rotate: d.r + 'deg' }] }}>
            <d.Icon size={22} color={doodleColor} />
          </View>
        ))}
      </View>

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8, backgroundColor: b.card, borderBottomColor: b.divider }]}>
        <IconButton onPress={() => router.back()} label={t('back')}>
          <BackIcon color={b.ink} />
        </IconButton>
        <LinearGradient colors={['#38BDF8', '#0284C7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.avatar}>
          <Text style={s.avatarText}>{otherName?.[0] ?? '?'}</Text>
        </LinearGradient>
        <View style={s.headerInfo}>
          <Text style={[s.headerName, { color: b.ink }]} numberOfLines={1}>{otherName}</Text>
          <Text style={[s.headerSub, { color: b.muted }]} numberOfLines={1}>{t('orderHash')}{cleanNumber(orderNumber) || orderId?.slice(0, 8)}</Text>
        </View>
        {chatClosed && (
          <View style={[s.closedBadge, { backgroundColor: b.iconTile }]}>
            <Text style={[s.closedBadgeText, { color: b.muted }]}>
              {orderStatus === 'delivered' ? t('chatCompleted') : t('chatCancelled')}
            </Text>
          </View>
        )}
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={rows}
        keyExtractor={i => i.key}
        contentContainerStyle={s.msgList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          if (item.kind === 'day') {
            return (
              <View style={[s.day, { backgroundColor: b.isDark ? '#16223A' : '#FFFFFF' }]}>
                <Text style={[s.dayText, { color: b.muted }]}>{item.label}</Text>
              </View>
            )
          }
          const m = item.msg
          const mine = isMe(m)
          return (
            <View
              style={[
                s.bubble,
                mine ? s.bubbleMe : s.bubbleOther,
                { backgroundColor: mine ? mineBg : theirsBg, marginTop: item.grouped ? 2 : 6 },
                !item.grouped && (mine ? { borderTopEndRadius: 3 } : { borderTopStartRadius: 3 }),
              ]}
            >
              <Text style={[s.bubbleText, { color: mine ? (b.isDark ? '#FFFFFF' : '#0A1628') : b.ink }]}>{m.body}</Text>
              <View style={s.meta}>
                <Text style={[s.bubbleTime, { color: mine ? (b.isDark ? '#B5DDF5' : '#5D86A3') : b.faint }]}>{clock(new Date(m.created_at), isEn)}</Text>
                {mine ? (m.read_at
                  ? <CheckCheck size={14} color={b.isDark ? '#7DD3FC' : '#0284C7'} />
                  : <Check size={14} color={b.isDark ? '#B5DDF5' : '#5D86A3'} />) : null}
              </View>
            </View>
          )
        }}
        ListEmptyComponent={
          <View style={s.emptyChat}>
            <View style={[s.emptyPill, { backgroundColor: b.isDark ? '#16223A' : '#FFFFFF' }]}>
              <Text style={[s.emptyChatText, { color: b.muted }]}>{t('startChat')}</Text>
            </View>
          </View>
        }
      />

      {/* Chat Closed Banner */}
      {chatClosed && (
        <View style={[s.closedBanner, { backgroundColor: b.card, borderTopColor: b.divider, paddingBottom: Math.max(insets.bottom, 8) + 8 }]}>
          <Text style={[s.closedBannerText, { color: b.muted }]}>
            {orderStatus === 'delivered' ? t('chatClosedDelivered') : t('chatClosedCancelled')}
          </Text>
        </View>
      )}

      {/* Input - only if chat is open */}
      {!chatClosed && (
        <View style={[s.inputRow, { paddingBottom: Math.max(insets.bottom, 8) + 6 }]}>
          <TextInput
            style={[s.input, { backgroundColor: b.isDark ? '#16223A' : '#FFFFFF', color: b.ink }]}
            value={text}
            onChangeText={setText}
            placeholder={t('typeMessage')}
            placeholderTextColor={b.faint}
            textAlign={isEn ? 'left' : 'right'}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!text.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel={t('send')}
            style={(!text.trim() || sending) ? { opacity: 0.5 } : undefined}
          >
            <LinearGradient colors={['#38BDF8', '#0284C7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.sendBtn}>
              <View style={I18nManager.isRTL ? { transform: [{ scaleX: -1 }] } : undefined}>
                <SendHorizontal size={20} color="#fff" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 10, paddingHorizontal: 12, borderBottomWidth: 1 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 15, fontFamily: F.display },
  headerInfo: { flex: 1, minWidth: 0 },
  headerName: { fontSize: 15, fontFamily: F.bold },
  headerSub: { fontSize: 11, fontFamily: F.regular, marginTop: 1 },
  closedBadge: { borderRadius: 10, paddingHorizontal: 10, height: 24, justifyContent: 'center' },
  closedBadgeText: { fontSize: 11, fontFamily: F.semibold },
  msgList: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10, flexGrow: 1 },
  day: { alignSelf: 'center', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, marginVertical: 8, elevation: 1, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  dayText: { fontSize: 11, fontFamily: F.semibold },
  bubble: { maxWidth: '78%', borderRadius: 12, paddingHorizontal: 10, paddingTop: 6, paddingBottom: 5, elevation: 1, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 1.5, shadowOffset: { width: 0, height: 1 } },
  bubbleMe: { alignSelf: 'flex-end' },
  bubbleOther: { alignSelf: 'flex-start' },
  bubbleText: { fontSize: 14, lineHeight: 21, fontFamily: F.regular },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-end', marginTop: 2 },
  bubbleTime: { fontSize: 10, fontFamily: F.regular },
  emptyChat: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyPill: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  emptyChatText: { fontSize: 13, fontFamily: F.medium },
  closedBanner: { borderTopWidth: 1, paddingTop: 14, paddingHorizontal: 16, alignItems: 'center' },
  closedBannerText: { fontSize: 13, fontFamily: F.semibold, textAlign: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 7, paddingHorizontal: 8, paddingTop: 6 },
  input: { flex: 1, minHeight: 44, maxHeight: 110, borderRadius: 22, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontSize: 14, fontFamily: F.regular, elevation: 1, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
})
