import { Tabs } from 'expo-router'
import { ClipboardList, MapPin, User } from 'lucide-react-native'
import { colors } from '../../src/theme'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.navy[300],
        tabBarStyle: {
          backgroundColor: colors.navy[800],
          borderTopColor: colors.navy[700],
          borderTopWidth: 1,
          height: 85,
          paddingTop: 8,
          paddingBottom: 24,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="orders" options={{ title: 'الطلبات', tabBarIcon: ({ color, size }) => <ClipboardList size={size} color={color} /> }} />
      <Tabs.Screen name="map" options={{ title: 'الخريطة', tabBarIcon: ({ color, size }) => <MapPin size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'حسابي', tabBarIcon: ({ color, size }) => <User size={size} color={color} /> }} />
    </Tabs>
  )
}
