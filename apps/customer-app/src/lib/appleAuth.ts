import { Platform } from 'react-native'
import * as AppleAuthentication from 'expo-apple-authentication'

/**
 * Sign in with Apple.
 *
 * Apple requires this alongside any third-party login (guideline 4.8), because Google
 * cannot offer Hide My Email and Apple's rule asks for an option that can. It is iOS
 * only — the button must never appear on Android.
 *
 * Like Google, this produces an identity token Supabase exchanges for a session, and the
 * account ends up with no password at all, so there is nothing to forget or reset.
 */

export type AppleResult =
  | { idToken: string; fullName: string | null; email: string | null; cancelled?: false; error?: undefined }
  | { cancelled: true; idToken?: undefined; error?: undefined }
  | { error: string; idToken?: undefined; cancelled?: false }

/** False on Android, and on iOS versions too old to offer it. */
export async function appleAuthAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false
  try {
    return await AppleAuthentication.isAvailableAsync()
  } catch {
    return false
  }
}

export async function signInWithAppleNative(en: boolean): Promise<AppleResult> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    })

    if (!credential.identityToken) {
      return { error: en ? 'Apple did not return a token' : 'Apple لم ترجع رمز الدخول' }
    }

    // Apple sends the name only on the very first authorisation, never again, so it is
    // passed straight through to the profile step rather than being looked up later.
    const name = [credential.fullName?.givenName, credential.fullName?.familyName]
      .filter(Boolean)
      .join(' ')
      .trim()

    return {
      idToken: credential.identityToken,
      fullName: name || null,
      email: credential.email ?? null,
    }
  } catch (e: any) {
    if (e?.code === 'ERR_REQUEST_CANCELED' || e?.code === 'ERR_CANCELED') {
      return { cancelled: true }
    }
    return { error: en ? 'Apple sign-in failed. Try again.' : 'تعذّر الدخول بـ Apple. جرّب تاني.' }
  }
}
