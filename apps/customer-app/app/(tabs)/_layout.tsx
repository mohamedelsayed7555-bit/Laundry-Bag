import { useEffect, useState, useCallback, useRef } from 'react'
import { Tabs } from 'expo-router'
import { View, StyleSheet, Platform } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Home, ClipboardList, Plus, MessageCircle, User } from 'lucide-react-native'
import { useLanguage } from '../../src/contexts/LanguageContext'
import { useAuth } from '../../src/contexts/AuthContext'
import { supabase } from '../../src/lib/supabase'
import { useBrand, F, type Brand } from '../../src/components/brand'
import ContactFAB from '../../src/components/ContactFAB'

const BRAND_EDGE = ['#38BDF8', '#818CF8', '#0EA5E9'] as const

// Opaque bar with a thin brand-gradient frame and a soft halo (a translucent bar picked up
// Android's elevation shadow and looked muddy over the page).
function TabBarFrame({ b }: { b: Brand }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[tb.halo, { backgroundColor: b.isDark ? 'rgba(56,189,248,0.20)' : 'rgba(14,165,233,0.12)' }]} />
      <View style={[tb.frame, { backgroundColor: b.card }]}>
        <LinearGradient colors={BRAND_EDGE} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 24 }]} />
        <View style={[tb.inner, { backgroundColor: b.card }]} />
      </View>
    </View>
  )
}

// Active tab: icon on a soft tinted pill
function TabIcon({ children, focused, b }: { children: React.ReactNode; focused: boolean; b: Brand }) {
  return <View style={[tb.iconPill, focused && { backgroundColor: b.tint }]}>{children}</View>
}

// Centre "new order" button sitting in a ring the colour of the page
function FloatingAddButton({ focused, b }: { focused: boolean; b: Brand }) {
  return (
    <View style={[tb.fabRing, { backgroundColor: b.page }]}>
      <LinearGradient
        colors={focused ? ['#0EA5E9', '#0369A1'] : ['#38BDF8', '#0284C7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={tb.fab}
      >
        <Plus size={28} color="#fff" />
      </LinearGradient>
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
      .subscribe((status, err) => {
        if (err) console.warn('customer unread-badge realtime error:', err.message)
      })
    return () => {
      supabase.removeChannel(channel)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [profile, debouncedFetch])

  return count
}

export default function TabsLayout() {
  const b = useBrand()
  const { t } = useLanguage()
  const unread = useUnreadMessages()

  return (
    <>
    <ContactFAB />
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: b.tintText,
        tabBarInactiveTintColor: b.faint,
        tabBarStyle: [tb.bar, { flexDirection: 'row-reverse' }],
        tabBarBackground: () => <TabBarFrame b={b} />,
        tabBarLabelStyle: tb.label,
        tabBarItemStyle: { paddingTop: 6 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('tabHome'),
          tabBarIcon: ({ color, focused }) => <TabIcon focused={focused} b={b}><Home size={22} color={color} /></TabIcon>,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: t('tabOrders'),
          tabBarIcon: ({ color, focused }) => <TabIcon focused={focused} b={b}><ClipboardList size={22} color={color} /></TabIcon>,
        }}
      />
      <Tabs.Screen
        name="new-order"
        options={{
          title: '',
          tabBarIcon: ({ focused }) => <FloatingAddButton focused={focused} b={b} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t('tabMessages'),
          tabBarIcon: ({ color, focused }) => <TabIcon focused={focused} b={b}><MessageCircle size={22} color={color} /></TabIcon>,
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarBadgeStyle: { backgroundColor: '#EF4444', color: '#fff', fontSize: 10, fontFamily: F.bold, minWidth: 18, height: 18, lineHeight: 18, borderRadius: 9 },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabProfile'),
          tabBarIcon: ({ color, focused }) => <TabIcon focused={focused} b={b}><User size={22} color={color} /></TabIcon>,
        }}
      />
    </Tabs>
    </>
  )
}

const tb = StyleSheet.create({
  // Same position/size as before (other screens offset their bottom bars from it)
  bar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 16,
    left: 24,
    right: 24,
    borderRadius: 24,
    height: 68,
    borderTopWidth: 0,
    backgroundColor: 'transparent',
    elevation: 0,
    shadowOpacity: 0,
    paddingBottom: 0,
  },
  halo: { position: 'absolute', top: -4, bottom: -4, left: -4, right: -4, borderRadius: 28 },
  frame: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    shadowColor: '#022047',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 14,
  },
  inner: { position: 'absolute', top: 1.5, bottom: 1.5, left: 1.5, right: 1.5, borderRadius: 22.5 },
  iconPill: { width: 44, height: 30, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 10.5, fontFamily: F.bold, marginTop: 1 },
  fabRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    padding: 5,
    marginTop: -30,
  },
  fab: {
    flex: 1,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
})
