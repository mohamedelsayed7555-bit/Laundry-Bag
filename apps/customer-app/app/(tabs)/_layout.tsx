import { Tabs } from 'expo-router'
import { View, StyleSheet, Platform } from 'react-native'
import { Home, ClipboardList, PlusCircle, MessageCircle, User } from 'lucide-react-native'
import { colors } from '../../src/theme'

function FloatingAddButton({ color, focused }: { color: string; focused: boolean }) {
  return (
    <View style={[tb.fabWrap, focused && tb.fabWrapActive]}>
      <PlusCircle size={28} color="#fff" />
    </View>
  )
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.navy[400],
        tabBarStyle: tb.bar,
        tabBarLabelStyle: tb.label,
        tabBarItemStyle: { paddingTop: 6 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'الرئيسية',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'طلباتي',
          tabBarIcon: ({ color, size }) => <ClipboardList size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="new-order"
        options={{
          title: '',
          tabBarIcon: ({ color, focused }) => <FloatingAddButton color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'المحادثات',
          tabBarIcon: ({ color, size }) => <MessageCircle size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'حسابي',
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
    backgroundColor: colors.navy[800],
    borderRadius: 24,
    height: 68,
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: colors.navy[600],
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
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -28,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 12,
  },
  fabWrapActive: {
    backgroundColor: colors.primaryDark,
    transform: [{ scale: 1.08 }],
  },
})
