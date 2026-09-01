import { Tabs } from 'expo-router'
import { Platform } from 'react-native'
import { ClipboardList, MapPin, MessageCircle, User } from 'lucide-react-native'
import { colors } from '../../src/theme'

export default function TabsLayout() {
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
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 2 },
        tabBarItemStyle: { paddingTop: 4 },
      }}
    >
      <Tabs.Screen name="orders" options={{ title: 'الطلبات', tabBarIcon: ({ color, size }) => <ClipboardList size={size} color={color} /> }} />
      <Tabs.Screen name="map" options={{ title: 'الخريطة', tabBarIcon: ({ color, size }) => <MapPin size={size} color={color} /> }} />
      <Tabs.Screen name="messages" options={{ title: 'المحادثات', tabBarIcon: ({ color, size }) => <MessageCircle size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'حسابي', tabBarIcon: ({ color, size }) => <User size={size} color={color} /> }} />
    </Tabs>
  )
}
