import { Redirect } from 'expo-router'
import { useAuth } from '../src/contexts/AuthContext'

export default function Index() {
  const { session, loading } = useAuth()

  // The native splash stays visible while the session is being restored (see SplashGate in _layout).
  if (loading) return null

  if (session) {
    return <Redirect href="/(tabs)/home" />
  }

  return <Redirect href="/(auth)/welcome" />
}
