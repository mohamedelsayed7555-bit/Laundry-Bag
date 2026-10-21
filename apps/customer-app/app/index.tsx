import { Redirect } from 'expo-router'
import { useAuth } from '../src/contexts/AuthContext'

export default function Index() {
  const { session, profile, loading } = useAuth()

  // The native splash stays visible while the session is being restored (see SplashGate in _layout).
  if (loading) return null

  if (session) {
    // Google gives no phone number, so an account created that way is not usable
    // until it has one — orders are dispatched by phone.
    if (profile && !profile.phone) {
      return <Redirect href="/(auth)/complete-profile" />
    }
    return <Redirect href="/(tabs)/home" />
  }

  return <Redirect href="/(auth)/welcome" />
}
