import { useEffect } from 'react'
import { View, StyleSheet, ViewStyle } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated'
import { colors } from '../theme'

interface SkeletonProps {
  width?: number | string
  height?: number
  borderRadius?: number
  style?: ViewStyle
}

export default function Skeleton({ width = '100%', height = 16, borderRadius = 10, style }: SkeletonProps) {
  const shimmer = useSharedValue(0)

  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 1200 }), -1, true)
  }, [])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.3, 0.7]),
  }))

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: colors.navy[700],
        },
        animatedStyle,
        style,
      ]}
    />
  )
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <View style={sk.card}>
      <View style={sk.row}>
        <Skeleton width={44} height={44} borderRadius={14} />
        <View style={sk.textCol}>
          <Skeleton width="60%" height={14} />
          <Skeleton width="40%" height={10} style={{ marginTop: 8 }} />
        </View>
      </View>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={`${90 - i * 15}%`} height={12} style={{ marginTop: 10 }} />
      ))}
    </View>
  )
}

export function SkeletonOrderCard() {
  return (
    <View style={sk.card}>
      <View style={sk.row}>
        <View style={sk.textCol}>
          <Skeleton width="50%" height={16} />
          <Skeleton width="35%" height={12} style={{ marginTop: 8 }} />
        </View>
        <Skeleton width={70} height={28} borderRadius={14} />
      </View>
      <View style={[sk.row, { marginTop: 14 }]}>
        <Skeleton width="30%" height={12} />
        <Skeleton width="25%" height={12} />
        <Skeleton width="20%" height={12} />
      </View>
    </View>
  )
}

const sk = StyleSheet.create({
  card: {
    backgroundColor: colors.navy[800],
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.navy[700],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  textCol: {
    flex: 1,
  },
})
