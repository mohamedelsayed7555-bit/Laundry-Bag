import { useEffect } from 'react'
import { View, StyleSheet, ViewStyle } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated'
import { useBrand, type Brand } from './brand'

interface SkeletonProps {
  width?: number | string
  height?: number
  borderRadius?: number
  style?: ViewStyle
}

export default function Skeleton({ width = '100%', height = 16, borderRadius = 10, style }: SkeletonProps) {
  const b = useBrand()
  const shimmer = useSharedValue(0)

  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 1200 }), -1, true)
  }, [])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.35, 0.75]),
  }))

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: b.isDark ? '#1E2B44' : '#DFE7F1',
        },
        animatedStyle,
        style,
      ]}
    />
  )
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  const b = useBrand()
  const sk = getSkStyles(b)
  return (
    <View style={sk.card}>
      <View style={sk.row}>
        <Skeleton width={42} height={42} borderRadius={13} />
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
  const b = useBrand()
  const sk = getSkStyles(b)
  return (
    <View style={sk.card}>
      <View style={sk.row}>
        <View style={sk.textCol}>
          <Skeleton width="50%" height={16} />
          <Skeleton width="35%" height={12} style={{ marginTop: 8 }} />
        </View>
        <Skeleton width={70} height={26} borderRadius={13} />
      </View>
      {/* the 8-step progress bar the order cards show */}
      <View style={[sk.row, { marginTop: 14, gap: 3 }]}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} width={`${100 / 8 - 1}%`} height={4} borderRadius={2} />
        ))}
      </View>
      <View style={[sk.row, { marginTop: 14 }]}>
        <Skeleton width="30%" height={12} />
        <Skeleton width="25%" height={12} />
        <Skeleton width="20%" height={12} />
      </View>
    </View>
  )
}

export function SkeletonPage() {
  const b = useBrand()
  return (
    <View style={{ flex: 1, backgroundColor: b.page, paddingHorizontal: 16, paddingTop: 60 }}>
      {/* header: back button + title */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <Skeleton width={36} height={36} borderRadius={12} />
        <Skeleton width="45%" height={18} />
      </View>
      <Skeleton width="100%" height={120} borderRadius={18} style={{ marginBottom: 12 }} />
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        <Skeleton width={96} height={44} borderRadius={12} />
        <Skeleton width={96} height={44} borderRadius={12} />
        <Skeleton width={96} height={44} borderRadius={12} />
      </View>
      <Skeleton width="100%" height={86} borderRadius={18} style={{ marginBottom: 10 }} />
      <Skeleton width="100%" height={86} borderRadius={18} style={{ marginBottom: 10 }} />
      <Skeleton width="100%" height={86} borderRadius={18} />
    </View>
  )
}

function getSkStyles(b: Brand) {
  return StyleSheet.create({
    card: {
      backgroundColor: b.card,
      borderRadius: 18,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: b.cardBorder,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    textCol: {
      flex: 1,
    },
  })
}
