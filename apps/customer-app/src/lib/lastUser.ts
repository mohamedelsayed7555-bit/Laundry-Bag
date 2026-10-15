import AsyncStorage from '@react-native-async-storage/async-storage'

// The last customer who signed in on this device. Used only to greet them by name on the
// sign-in screen, so the server never reveals a name for a phone number someone types in.
const KEY = '@last_user'

export type LastUser = { name: string; phone: string; email: string; avatarUrl?: string | null }

export async function saveLastUser(user: LastUser) {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(user)) } catch {}
}

export async function loadLastUser(): Promise<LastUser | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.name !== 'string' || typeof parsed?.phone !== 'string') return null
    return {
      name: parsed.name,
      phone: parsed.phone,
      email: typeof parsed.email === 'string' ? parsed.email : '',
      avatarUrl: typeof parsed.avatarUrl === 'string' ? parsed.avatarUrl : null,
    }
  } catch {
    return null
  }
}

// When this phone last signed in on this device, shown on the sign-in screen. Kept under its own key
// so it never races with saveLastUser (which runs whenever the profile loads).
const LOGIN_KEY = '@last_login'

export async function markLastLogin(phone: string) {
  try { await AsyncStorage.setItem(LOGIN_KEY, JSON.stringify({ phone, at: Date.now() })) } catch {}
}

export async function loadLastLogin(phone: string): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(LOGIN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.phone === phone && typeof parsed.at === 'number' ? parsed.at : null
  } catch {
    return null
  }
}
