import { useEffect, useState, useCallback, useRef } from 'react'
import { Tabs } from 'expo-router'
import { View, StyleSheet, Platform } from 'react-native'
import { Home, ClipboardList, PlusCircle, MessageCircle, User } from 'lucide-react-native'
import { useTheme } from '../../src/contexts/ThemeContext'
import { useLanguage } from '../../src/contexts/LanguageContext'
import { useAuth } from '../../src/contexts/AuthContext'
import { supabase } from '../../src/lib/supabase'

function FloatingAddButton({ color, focused, primary, primaryDark }: { color: string; focused: boolean; primary: string; primaryDark: string }) {
  return (
    <View style={[tb.fabWrap, { backgroundColor: primary, shadowColor: primary }, focused && { backgroundColor: primaryDark, transform: [{ scale: 1.08 }] }]}>
      <PlusCircle size={28} color="#fff" />
    </View>
  )
}

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
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [profile, debouncedFetch])

  return count
}

export default function TabsLayout() {
  const { colors } = useTheme()
  const { t } = useLanguage()
  const unread = useUnreadMessages()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.navy[400],
        tabBarStyle: [tb.bar, {
          backgroundColor: colors.tabBarBg,
          borderColor: colors.navy[600],
          flexDirection: 'row-reverse',
        }],
        tabBarLabelStyle: tb.label,
        tabBarItemStyle: { paddingTop: 6 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('tabHome'),
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: t('tabOrders'),
          tabBarIcon: ({ color, size }) => <ClipboardList size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="new-order"
        options={{
          title: '',
          tabBarIcon: ({ color, focused }) => <FloatingAddButton color={color} focused={focused} primary={colors.primary} primaryDark={colors.primaryDark} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t('tabMessages'),
          tabBarIcon: ({ color, size }) => <MessageCircle size={size} color={color} />,
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary, color: '#fff', fontSize: 10, fontWeight: '700', minWidth: 18, height: 18, lineHeight: 18, borderRadius: 9 },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabProfile'),
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tabs>
  )
}

const tb = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 16,
    left: 16,
    right: 16,
    borderRadius: 24,
    height: 68,
    borderTopWidth: 0,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 16,
    paddingBottom: 0,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  fabWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -28,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 12,
  },
})
