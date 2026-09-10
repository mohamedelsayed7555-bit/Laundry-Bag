import { useEffect, useState, useRef, useCallback } from 'react'
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Vibration } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useAuth } from '../../src/contexts/AuthContext'
import { useTheme } from '../../src/contexts/ThemeContext'
import { useLanguage } from '../../src/contexts/LanguageContext'
import { supabase } from '../../src/lib/supabase'
import { playNotificationSound, sendLocalNotification } from '../../src/hooks/useNotifications'

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
  const { colors } = useTheme()
  const { t, locale } = useLanguage()
  const isEn = locale === 'en'
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [otherName, setOtherName] = useState(t('theDriver'))
  const [orderStatus, setOrderStatus] = useState<string | null>(null)
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
        .select('status')
        .eq('id', orderId)
        .eq('customer_id', profile.id)
        .single(),
    ])

    setMessages(data ?? [])
    if (orderData) setOrderStatus(orderData.status)

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

  useEffect(() => {
    if (!profile || !orderId) return
    const channel = supabase
      .channel(`chat-${orderId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `order_id=eq.${orderId}` }, (payload) => {
        const newMsg = payload.new as Message
        setMessages(prev => [...prev, newMsg])
        if (newMsg.sender_id !== profile.id) {
          playNotificationSound('order-update')
          Vibration.vibrate(300)
          sendLocalNotification(t('newMessage'), newMsg.body, 'messages')
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

  return (
    <KeyboardAvoidingView style={[s.container, { backgroundColor: colors.navy[900] }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: colors.navy[800], borderBottomColor: colors.navy[700] }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[s.backText, { color: colors.primary }]}>→</Text>
        </TouchableOpacity>
        <View style={s.headerInfo}>
          <Text style={[s.headerName, { color: colors.text }]}>{otherName}</Text>
          <Text style={[s.headerSub, { color: colors.navy[300] }]}>{t('orderHash')}{orderId?.slice(0, 8)}</Text>
        </View>
        {chatClosed && (
          <View style={[s.closedBadge, { backgroundColor: colors.navy[700] }]}>
            <Text style={[s.closedBadgeText, { color: colors.navy[200] }]}>
              {orderStatus === 'delivered' ? t('chatCompleted') : t('chatCancelled')}
            </Text>
          </View>
        )}
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={i => i.id}
        contentContainerStyle={s.msgList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => (
          <View style={[s.bubble, isMe(item) ? [s.bubbleMe, { backgroundColor: colors.primary }] : [s.bubbleOther, { backgroundColor: colors.navy[700] }]]}>
            <Text style={[s.bubbleText, isMe(item) ? s.bubbleTextMe : { color: colors.navy[100] }]}>{item.body}</Text>
            <Text style={[s.bubbleTime, { color: colors.navy[300] }, isMe(item) && s.bubbleTimeMe]}>
              {new Date(item.created_at).toLocaleTimeString(isEn ? 'en-US' : 'ar-EG', { hour: '2-digit', minute: '2-digit' })}
              {isMe(item) && (item.read_at ? ' ✓✓' : ' ✓')}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={s.emptyChat}>
            <Text style={[s.emptyChatText, { color: colors.navy[400] }]}>{t('startChat')}</Text>
          </View>
        }
      />

      {/* Chat Closed Banner */}
      {chatClosed && (
        <View style={[s.closedBanner, { backgroundColor: colors.navy[800], borderTopColor: colors.navy[700] }]}>
          <Text style={[s.closedBannerText, { color: colors.navy[300] }]}>
            {orderStatus === 'delivered' ? t('chatClosedDelivered') : t('chatClosedCancelled')}
          </Text>
        </View>
      )}

      {/* Input - only if chat is open */}
      {!chatClosed && (
        <View style={[s.inputRow, { backgroundColor: colors.navy[800], borderTopColor: colors.navy[700] }]}>
          <TouchableOpacity style={[s.sendBtn, { backgroundColor: colors.primary }, (!text.trim() || sending) && { opacity: 0.5 }]} onPress={handleSend} disabled={!text.trim() || sending}>
            <Text style={s.sendText}>{t('send')}</Text>
          </TouchableOpacity>
          <TextInput
            style={[s.input, { backgroundColor: colors.navy[700], color: colors.text }]}
            value={text}
            onChangeText={setText}
            placeholder={t('typeMessage')}
            placeholderTextColor={colors.navy[400]}
            textAlign={isEn ? 'left' : 'right'}
            multiline
            maxLength={500}
          />
        </View>
      )}
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingTop: 56, paddingBottom: 14, paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  backText: { fontSize: 22, fontWeight: '600' },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 16, fontWeight: '700' },
  headerSub: { fontSize: 11, marginTop: 1 },
  closedBadge: {
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
  },
  closedBadgeText: { fontSize: 11, fontWeight: '600' },
  msgList: { padding: 16, paddingBottom: 8, flexGrow: 1 },
  bubble: { maxWidth: '78%', borderRadius: 18, padding: 12, marginBottom: 8 },
  bubbleMe: { alignSelf: 'flex-end', borderBottomLeftRadius: 4 },
  bubbleOther: { alignSelf: 'flex-start', borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTextMe: { color: '#fff' },
  bubbleTime: { fontSize: 9, marginTop: 4, textAlign: 'left' },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.6)', textAlign: 'left' },
  emptyChat: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyChatText: { fontSize: 15 },
  closedBanner: {
    borderTopWidth: 1,
    padding: 16, alignItems: 'center',
  },
  closedBannerText: { fontSize: 13, fontWeight: '600' },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: 12, paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    borderTopWidth: 1,
  },
  input: {
    flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, maxHeight: 100,
  },
  sendBtn: { borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10 },
  sendText: { color: '#fff', fontWeight: '700', fontSize: 14 },
})
