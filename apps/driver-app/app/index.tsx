import { Redirect } from 'expo-router'
import { View, StyleSheet } from 'react-native'
import { useAuth } from '../src/contexts/AuthContext'
import Skeleton, { SkeletonOrderCard } from '../src/components/Skeleton'
import { colors } from '../src/theme'

/**
 * The opening wait used to be a spinner on a white screen, which flashed white
 * against the app's dark theme and said nothing about what was coming. This is
 * the shape of the orders screen instead, so the first frame already looks like
 * the app and the wait reads as loading rather than a blank.
 */
function BootSkeleton() {
  return (
    <View style={s.container}>
      <View style={s.header}>
        <View>
          <Skeleton width={130} height={24} borderRadius={8} />
          <Skeleton width={210} height={12} borderRadius={6} style={{ marginTop: 10 }} />
        </View>
        <Skeleton width={44} height={44} borderRadius={22} />
      </View>

      <View style={s.filterRow}>
        <Skeleton width="32%" height={40} borderRadius={14} />
        <Skeleton width="32%" height={40} borderRadius={14} />
        <Skeleton width="32%" height={40} borderRadius={14} />
      </View>

      <Skeleton width="100%" height={46} borderRadius={14} style={{ marginBottom: 14 }} />

      <SkeletonOrderCard />
      <SkeletonOrderCard />
      <SkeletonOrderCard />
    </View>
  )
}

export default function Index() {
  const { session, loading } = useAuth()

  if (loading) return <BootSkeleton />
  if (session) return <Redirect href="/(tabs)/orders" />
  return <Redirect href="/(auth)/login" />
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900], padding: 20, paddingTop: 56 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12, justifyContent: 'space-between' },
})
