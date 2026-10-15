import AsyncStorage from '@react-native-async-storage/async-storage'

// The last customer who signed in on this device. Used only to greet them by name on the
// sign-in screen, so the server never reveals a name for a phone number someone types in.
const KEY = '@last_user'

export type LastUser = { name: string; phone: string; email: string }

export async function saveLastUser(user: LastUser) {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(user)) } catch {}
}

export async function loadLastUser(): Promise<LastUser | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.name !== 'string' || typeof parsed?.phone !== 'string') return null
    return { name: parsed.name, phone: parsed.phone, email: typeof parsed.email === 'string' ? parsed.email : '' }
  } catch {
    return null
  }
}
