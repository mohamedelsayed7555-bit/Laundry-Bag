import { useEffect, useState, useRef, useCallback } from 'react'
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useAuth } from '../../src/contexts/AuthContext'
import { supabase } from '../../src/lib/supabase'
import { colors } from '../../src/theme'

type Message = {
  id: string
  sender_id: string
  body: string
  created_at: string
  read_at: string | null
}

const closedStatuses = ['delivered', 'cancelled']

export default function ChatScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>()
  const { profile } = useAuth()
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [otherName, setOtherName] = useState('العميل')
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
      .channel(`driver-chat-${orderId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `order_id=eq.${orderId}` }, (payload) => {
        const newMsg = payload.new as Message
        setMessages(prev => [...prev, newMsg])
        if (newMsg.receiver_id === profile.id) {
          supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', newMsg.id)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile, orderId])

  useEffect(() => {
    if (!orderId) return
    const channel = supabase
      .channel(`driver-order-status-${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, (payload) => {
        const newStatus = (payload.new as any).status
        if (newStatus) setOrderStatus(newStatus)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [orderId])

  async function handleSend() {
    if (!text.trim() || !profile || !orderId || chatClosed) return

    const { data: order } = await supabase.from('orders').select('customer_id').eq('id', orderId).single()
    if (!order?.customer_id) return

    setSending(true)
    const msgBody = text.trim()
    await supabase.from('messages').insert({
      order_id: orderId,
      sender_id: profile.id,
      receiver_id: order.customer_id,
      body: msgBody,
    })

    const { data: customerData } = await supabase.from('users').select('fcm_token').eq('id', order.customer_id).single()
    if (customerData?.fcm_token) {
      fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: customerData.fcm_token,
          title: `رسالة من ${profile.name ?? 'السائق'}`,
          body: msgBody.length > 100 ? msgBody.slice(0, 100) + '...' : msgBody,
          sound: 'default',
          data: { type: 'chat', order_id: orderId },
        }),
      }).catch(() => {})
    }

    setText('')
    setSending(false)
  }

  const isMe = (msg: Message) => msg.sender_id === profile?.id

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.backText}>→</Text>
        </TouchableOpacity>
        <View style={s.headerInfo}>
          <Text style={s.headerName}>{otherName}</Text>
          <Text style={s.headerSub}>طلب #{orderId?.slice(0, 8)}</Text>
        </View>
        {chatClosed && (
          <View style={s.closedBadge}>
            <Text style={s.closedBadgeText}>
              {orderStatus === 'delivered' ? '✅ مكتمل' : '❌ ملغي'}
            </Text>
          </View>
        )}
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={i => i.id}
        contentContainerStyle={s.msgList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <View style={[s.bubble, isMe(item) ? s.bubbleMe : s.bubbleOther]}>
            <Text style={[s.bubbleText, isMe(item) ? s.bubbleTextMe : s.bubbleTextOther]}>{item.body}</Text>
            <Text style={[s.bubbleTime, isMe(item) && s.bubbleTimeMe]}>
              {new Date(item.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
              {isMe(item) && (item.read_at ? ' ✓✓' : ' ✓')}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={s.emptyChat}>
            <Text style={s.emptyChatText}>💬 ابدأ المحادثة مع العميل</Text>
          </View>
        }
      />

      {chatClosed && (
        <View style={s.closedBanner}>
          <Text style={s.closedBannerText}>
            {orderStatus === 'delivered'
              ? '🔒 تم إغلاق المحادثة — الطلب مكتمل'
              : '🔒 تم إغلاق المحادثة — الطلب ملغي'}
          </Text>
        </View>
      )}

      {!chatClosed && (
        <View style={s.inputRow}>
          <TouchableOpacity style={[s.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]} onPress={handleSend} disabled={!text.trim() || sending}>
            <Text style={s.sendText}>إرسال</Text>
          </TouchableOpacity>
          <TextInput
            style={s.input}
            value={text}
            onChangeText={setText}
            placeholder="اكتب رسالة..."
            placeholderTextColor={colors.navy[400]}
            textAlign="right"
            multiline
            maxLength={500}
          />
        </View>
      )}
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900] },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.navy[800], paddingTop: 56, paddingBottom: 14, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: colors.navy[700],
  },
  backText: { fontSize: 22, color: colors.primary, fontWeight: '600' },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 16, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 11, color: colors.navy[300], marginTop: 1 },
  closedBadge: {
    backgroundColor: colors.navy[700], borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
  },
  closedBadgeText: { fontSize: 11, color: colors.navy[200], fontWeight: '600' },
  msgList: { padding: 16, paddingBottom: 8, flexGrow: 1 },
  bubble: { maxWidth: '78%', borderRadius: 18, padding: 12, marginBottom: 8 },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomLeftRadius: 4 },
  bubbleOther: { alignSelf: 'flex-start', backgroundColor: colors.navy[700], borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTextMe: { color: '#fff' },
  bubbleTextOther: { color: colors.navy[100] },
  bubbleTime: { fontSize: 9, color: colors.navy[300], marginTop: 4, textAlign: 'left' },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.6)', textAlign: 'left' },
  emptyChat: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyChatText: { color: colors.navy[400], fontSize: 15 },
  closedBanner: {
    backgroundColor: colors.navy[800], borderTopWidth: 1, borderTopColor: colors.navy[700],
    padding: 16, alignItems: 'center',
  },
  closedBannerText: { color: colors.navy[300], fontSize: 13, fontWeight: '600' },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    backgroundColor: colors.navy[800], padding: 12, paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    borderTopWidth: 1, borderTopColor: colors.navy[700],
  },
  input: {
    flex: 1, backgroundColor: colors.navy[700], borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
    color: '#fff', fontSize: 14, maxHeight: 100,
  },
  sendBtn: { backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10 },
  sendText: { color: '#fff', fontWeight: '700', fontSize: 14 },
})
