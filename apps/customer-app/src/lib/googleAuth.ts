import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin'

/**
 * Google sign-in, wrapped so the rest of the app never touches the native module
 * directly. Returns an ID token that Supabase exchanges for a session; we never
 * see or store a password for these accounts — Google is the identity, which is
 * also how the customer recovers the account without going through support.
 */

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? ''
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? ''

export const googleConfigured = WEB_CLIENT_ID.length > 0

let configured = false

function configure() {
  if (configured || !googleConfigured) return
  GoogleSignin.configure({
    // The web client is what Supabase validates the ID token against, on both platforms.
    webClientId: WEB_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID || undefined,
    offlineAccess: false,
  })
  configured = true
}

export type GoogleResult =
  | { idToken: string; email: string | null; name: string | null; cancelled?: false; error?: undefined }
  | { cancelled: true; idToken?: undefined; error?: undefined }
  | { error: string; idToken?: undefined; cancelled?: false }

function failure(e: any, en: boolean): GoogleResult {
  const code = e?.code
  if (code === statusCodes.SIGN_IN_CANCELLED) return { cancelled: true }
  if (code === statusCodes.IN_PROGRESS) return { cancelled: true }
  if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    return { error: en ? 'Google Play Services is not available on this device' : 'خدمات Google Play غير متاحة على جهازك' }
  }
  return { error: en ? 'Google sign-in failed. Try again.' : 'تعذّر الدخول بجوجل. جرّب تاني.' }
}

/** Opens the Google account picker. */
export async function signInWithGoogleNative(en: boolean): Promise<GoogleResult> {
  if (!googleConfigured) {
    return { error: en ? 'Google sign-in is not configured' : 'الدخول بجوجل غير مفعّل' }
  }
  try {
    configure()
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
    // A stale cached account makes the picker skip straight to the wrong Gmail.
    await GoogleSignin.signOut().catch(() => {})
    const res: any = await GoogleSignin.signIn()
    const data = res?.data ?? res
    const idToken = data?.idToken ?? res?.idToken
    if (!idToken) {
      if (res?.type === 'cancelled') return { cancelled: true }
      return { error: en ? 'Google did not return a token' : 'جوجل لم ترجع رمز الدخول' }
    }
    return { idToken, email: data?.user?.email ?? null, name: data?.user?.name ?? null }
  } catch (e: any) {
    return failure(e, en)
  }
}

/**
 * Re-authenticates without showing the picker, for the biometric shortcut: the
 * fingerprint is the local check, Google still re-issues the token.
 */
export async function signInWithGoogleSilently(en: boolean): Promise<GoogleResult> {
  if (!googleConfigured) {
    return { error: en ? 'Google sign-in is not configured' : 'الدخول بجوجل غير مفعّل' }
  }
  try {
    configure()
    const res: any = await GoogleSignin.signInSilently()
    const data = res?.data ?? res
    const idToken = data?.idToken ?? res?.idToken
    if (!idToken) return { error: en ? 'Sign in with Google again' : 'ادخل بجوجل تاني' }
    return { idToken, email: data?.user?.email ?? null, name: data?.user?.name ?? null }
  } catch (e: any) {
    return failure(e, en)
  }
}

/** Clears the cached Google account so the next sign-in shows the picker. */
export async function clearGoogleSession() {
  if (!googleConfigured) return
  try {
    configure()
    await GoogleSignin.signOut()
  } catch {}
}
