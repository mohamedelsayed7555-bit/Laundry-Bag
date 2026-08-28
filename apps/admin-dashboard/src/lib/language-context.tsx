'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { ar } from '@/lib/i18n/ar'
import { en } from '@/lib/i18n/en'

type Lang = 'ar' | 'en'
type Translations = typeof ar

interface LanguageContextType {
  lang: Lang
  t: Translations
  toggleLang: () => void
  dir: 'rtl' | 'ltr'
}

const LanguageContext = createContext<LanguageContextType | null>(null)

const translations: Record<Lang, Translations> = { ar, en }

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('ar')

  useEffect(() => {
    const saved = localStorage.getItem('cleano-lang') as Lang | null
    if (saved) setLang(saved)
  }, [])

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = lang
  }, [lang])

  function toggleLang() {
    const next = lang === 'ar' ? 'en' : 'ar'
    setLang(next)
    localStorage.setItem('cleano-lang', next)
  }

  const dir = lang === 'ar' ? 'rtl' : 'ltr'

  return (
    <LanguageContext.Provider value={{ lang, t: translations[lang], toggleLang, dir }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLang() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLang must be used within LanguageProvider')
  return ctx
}
