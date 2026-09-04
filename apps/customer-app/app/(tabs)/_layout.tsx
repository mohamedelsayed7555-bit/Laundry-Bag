import { Tabs } from 'expo-router'
import { View, StyleSheet, Platform } from 'react-native'
import { Home, ClipboardList, PlusCircle, MessageCircle, User } from 'lucide-react-native'
import { useTheme } from '../../src/contexts/ThemeContext'
import { useLanguage } from '../../src/contexts/LanguageContext'

function FloatingAddButton({ color, focused, primary, primaryDark }: { color: string; focused: boolean; primary: string; primaryDark: string }) {
  return (
    <View style={[tb.fabWrap, { backgroundColor: primary, shadowColor: primary }, focused && { backgroundColor: primaryDark, transform: [{ scale: 1.08 }] }]}>
      <PlusCircle size={28} color="#fff" />
    </View>
  )
}

export default function TabsLayout() {
  const { colors } = useTheme()
  const { t } = useLanguage()

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
