import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { setLocale, getCurrentLocale, t as translate, isRTL as checkRTL, applyRTLChange, Locale } from '../i18n'

interface LanguageContextType {
  locale: Locale
  isRTL: boolean
  setLanguage: (locale: Locale) => void
  t: (key: string, options?: Record<string, any>) => string
}

const LanguageContext = createContext<LanguageContextType>({
  locale: 'ar',
  isRTL: true,
  setLanguage: () => {},
  t: translate,
})

const STORAGE_KEY = '@app_language'

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('ar')
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(saved => {
      if (saved === 'ar' || saved === 'en') {
        setLocale(saved)
        setLocaleState(saved)
      }
    })
  }, [])

  const setLanguage = useCallback((lang: Locale) => {
    setLocale(lang)
    setLocaleState(lang)
    AsyncStorage.setItem(STORAGE_KEY, lang).then(() => {
      applyRTLChange()
    })
    forceUpdate(n => n + 1)
  }, [])

  const t = useCallback((key: string, options?: Record<string, any>) => {
    return translate(key, options)
  }, [locale])

  const value = useMemo(() => ({ locale, isRTL: locale === 'ar', setLanguage, t }), [locale, setLanguage, t])

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
