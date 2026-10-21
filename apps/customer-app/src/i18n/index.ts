import { Alert, I18nManager } from 'react-native'
import RNRestart from 'react-native-restart'
import { I18n } from 'i18n-js'
import ar from './ar'
import en from './en'

const i18n = new I18n({ ar, en })
i18n.defaultLocale = 'ar'
i18n.locale = 'ar'
i18n.enableFallback = true

export type Locale = 'ar' | 'en'

let pendingReload = false

export function setLocale(locale: Locale) {
  i18n.locale = locale
  const shouldBeRTL = locale === 'ar'
  if (I18nManager.isRTL !== shouldBeRTL) {
    I18nManager.allowRTL(shouldBeRTL)
    I18nManager.forceRTL(shouldBeRTL)
    pendingReload = true
  }
}

/**
 * Switching between Arabic and English flips the layout direction, and on Android that
 * flag is read when the Activity is created. A JS-level reload only swaps the bundle
 * inside the same Activity, which showed a white flash and changed nothing — the text
 * turned English while the layout stayed right-to-left.
 *
 * RNRestart recreates the Activity, which is the same thing as swiping the app away and
 * opening it again, so the new direction is picked up without asking the customer to do
 * anything. If it ever fails we say what to do rather than leaving a broken layout.
 */
export function applyRTLChange(): Promise<void> {
  if (!pendingReload) return Promise.resolve()
  pendingReload = false
  const en = i18n.locale === 'en'
  return new Promise(resolve => {
    setTimeout(() => {
      try {
        if (__DEV__) {
          const { DevSettings } = require('react-native')
          DevSettings?.reload?.()
        } else {
          RNRestart.restart()
        }
      } catch {
        Alert.alert(
          en ? 'One last step' : 'فاضل خطوة واحدة',
          en
            ? 'Close the app completely and open it again so the layout switches to English.'
            : 'اقفل التطبيق تماماً وافتحه تاني عشان الواجهة تتظبط على العربي.',
          [{ text: en ? 'Got it' : 'تمام' }],
        )
      }
      resolve()
    }, 300)
  })
}

export function t(key: string, options?: Record<string, any>): string {
  return i18n.t(key, options)
}

export function getCurrentLocale(): Locale {
  return i18n.locale as Locale
}

export function isRTL(): boolean {
  return i18n.locale === 'ar'
}

export { i18n }
