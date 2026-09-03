import { createContext, useContext } from 'react'
import { I18nManager } from 'react-native'
import { I18n } from 'i18n-js'
import * as Localization from 'expo-localization'
import ar from './ar'
import en from './en'

const i18n = new I18n({ ar, en })
i18n.defaultLocale = 'ar'
i18n.locale = 'ar'
i18n.enableFallback = true

export type Locale = 'ar' | 'en'

export function setLocale(locale: Locale) {
  i18n.locale = locale
  const isRTL = locale === 'ar'
  if (I18nManager.isRTL !== isRTL) {
    I18nManager.allowRTL(isRTL)
    I18nManager.forceRTL(isRTL)
  }
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
