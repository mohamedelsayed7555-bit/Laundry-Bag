import { useEffect, useState, useCallback, useRef } from 'react'
import { Tabs } from 'expo-router'
import { Platform } from 'react-native'
import { ClipboardList, MapPin, MessageCircle, User } from 'lucide-react-native'
import { colors } from '../../src/theme'
import { useAuth } from '../../src/contexts/AuthContext'
import { supabase } from '../../src/lib/supabase'

function useUnreadMessages() {
  const { profile } = useAuth()
  const [count, setCount] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchCount = useCallback(async () => {
    if (!profile) return
    const { count: c } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('receiver_id', profile.id)
      .is('read_at', null)
    setCount(c ?? 0)
  }, [profile])

  const debouncedFetch = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => fetchCount(), 500)
  }, [fetchCount])

  useEffect(() => { fetchCount() }, [fetchCount])

  useEffect(() => {
    if (!profile) return
    const channel = supabase
      .channel('unread-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${profile.id}` }, () => debouncedFetch())
      .subscribe((status, err) => {
        if (err) console.warn('driver unread-badge realtime error:', err.message)
      })
    return () => {
      supabase.removeChannel(channel)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [profile, debouncedFetch])

  return count
}

export default function TabsLayout() {
  const unread = useUnreadMessages()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.navy[400],
        tabBarStyle: {
          position: 'absolute',
          bottom: Platform.OS === 'ios' ? 24 : 16,
          left: 16,
          right: 16,
          backgroundColor: colors.navy[800],
          borderRadius: 24,
          height: 64,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: colors.navy[600],
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 24,
          elevation: 16,
          paddingBottom: 0,
          paddingTop: 6,
          flexDirection: 'row-reverse',
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 2 },
        tabBarItemStyle: { paddingTop: 4 },
      }}
    >
      <Tabs.Screen name="orders" options={{ title: 'الطلبات', tabBarIcon: ({ color, size }) => <ClipboardList size={size} color={color} /> }} />
      <Tabs.Screen name="map" options={{ title: 'الخريطة', tabBarIcon: ({ color, size }) => <MapPin size={size} color={color} /> }} />
      <Tabs.Screen name="messages" options={{ title: 'المحادثات', tabBarIcon: ({ color, size }) => <MessageCircle size={size} color={color} />, tabBarBadge: unread > 0 ? unread : undefined, tabBarBadgeStyle: { backgroundColor: colors.primary, color: '#fff', fontSize: 10, fontWeight: '700', minWidth: 18, height: 18, lineHeight: 18, borderRadius: 9 } }} />
      <Tabs.Screen name="profile" options={{ title: 'حسابي', tabBarIcon: ({ color, size }) => <User size={size} color={color} /> }} />
    </Tabs>
  )
}
