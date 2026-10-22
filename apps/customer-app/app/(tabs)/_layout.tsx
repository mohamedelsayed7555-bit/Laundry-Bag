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

// Loaded defensively: an over-the-air update can reach a build that has no native blur
// module, and the bar falls back to its tinted backing rather than failing to render.
let BlurView: any = null
try { BlurView = require('expo-blur').BlurView } catch {}

// Glass bar: the page's own colour shows through it, softened, with a hairline edge.
// A heavy glow and a thick bright border made it read as a sticker laid over the page.
function TabBarFrame({ b }: { b: Brand }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[tb.frame, { backgroundColor: b.isDark ? 'rgba(10,17,32,0.62)' : 'rgba(255,255,255,0.62)' }]}>
        {BlurView ? (
          <BlurView
            intensity={34}
            tint={b.isDark ? 'dark' : 'light'}
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View
          style={[
            tb.hairline,
            { borderColor: b.isDark ? 'rgba(146,197,253,0.26)' : 'rgba(2,32,71,0.12)' },
          ]}
        />
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
        tabBarItemStyle: { paddingTop: 6, paddingHorizontal: 2 },
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
    bottom: Platform.OS === 'ios' ? 24 : 18,
    // Margins, not insets: left/right were ignored here and the bar ran off both
    // edges of the screen with its rounded corners cut away.
    left: 0,
    right: 0,
    marginHorizontal: 20,
    borderRadius: 24,
    height: 68,
    borderTopWidth: 0,
    backgroundColor: 'transparent',
    elevation: 0,
    shadowOpacity: 0,
    paddingBottom: 0,
    // The rounded frame curves in at the ends, so the first and last tabs need room
    // or their labels sit right on the curve.
    paddingHorizontal: 8,
  },
  frame: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    // Clips the blur to the rounded shape, and keeps Android's elevation shadow off a
    // translucent surface, where it turns the glass muddy.
    overflow: 'hidden',
  },
  hairline: { ...StyleSheet.absoluteFillObject, borderWidth: 1, borderRadius: 24 },
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
