import { useEffect, useRef } from 'react'
import { Redirect } from 'expo-router'
import { View, Text, Image, Animated, StyleSheet } from 'react-native'
import { useAuth } from '../src/contexts/AuthContext'

export default function Index() {
  const { session, loading } = useAuth()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.8)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 60, useNativeDriver: true }),
    ]).start()
  }, [])

  if (loading) {
    return (
      <View style={s.container}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
          <Image source={require('../assets/logo.jpg')} style={s.logo} resizeMode="contain" />
        </Animated.View>
        <Animated.Text style={[s.appName, { opacity: fadeAnim }]}>Laundry Bag</Animated.Text>
      </View>
    )
  }

  if (session) {
    return <Redirect href="/(tabs)/home" />
  }

  return <Redirect href="/(auth)/login" />
}

const s = StyleSheet.create({
  container: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#0a1628',
  },
  logo: {
    width: 140, height: 140, borderRadius: 70,
  },
  appName: {
    marginTop: 20,
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 2,
  },
})
