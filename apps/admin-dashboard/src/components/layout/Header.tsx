'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Search, Moon, Sun, Globe } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { User } from '@cleano/shared-types'
import NotificationDropdown from '@/components/ui/NotificationDropdown'
import { useTheme } from '@/lib/theme-context'
import { useLang } from '@/lib/language-context'

export default function Header() {
  const [profile, setProfile] = useState<User | null>(null)
  const { theme, toggleTheme } = useTheme()
  const { lang, t, toggleLang } = useLang()

  const [date] = useState(new Date().toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }))

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const { data } = await supabase.from('users').select('id, name, role, avatar_url').eq('id', user.id).single()
        setProfile(data as unknown as User)
      }
    })
  }, [])

  return (
    <motion.header
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="h-16 bg-white/80 backdrop-blur-xl border-b border-surface-border/60 flex items-center justify-between px-6 sticky top-0 z-40"
    >
      <div className="flex items-center gap-4">
        <div className="relative group">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
          <input
            type="text"
            placeholder={t.header.search}
            className="pr-10 pl-10 py-2 bg-surface-muted/80 border border-transparent rounded-xl text-sm w-72 focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-500/30 focus:bg-white transition-all placeholder:text-gray-400"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-40">
            <kbd className="text-[10px] bg-white border border-gray-200 rounded px-1 py-0.5 font-mono shadow-sm">⌘</kbd>
            <kbd className="text-[10px] bg-white border border-gray-200 rounded px-1 py-0.5 font-mono shadow-sm">K</kbd>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400 hidden lg:block">{date}</span>

        <button
          onClick={toggleLang}
          className="p-2 rounded-xl hover:bg-surface-muted transition-colors text-gray-500 hover:text-primary-500"
          title={lang === 'ar' ? 'English' : 'عربي'}
        >
          <Globe size={18} />
        </button>

        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl hover:bg-surface-muted transition-colors text-gray-500 hover:text-primary-500"
          title={theme === 'light' ? t.theme.dark : t.theme.light}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        <NotificationDropdown />

        <div className="w-px h-8 bg-surface-border mx-1" />

        <div className="flex items-center gap-3">
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-800 leading-tight">{profile?.name ?? '...'}</p>
            <p className="text-[10px] text-gray-400 leading-tight">{t.header.systemAdmin}</p>
          </div>
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-400 to-accent-purple/80 flex items-center justify-center text-white font-bold text-sm shadow-premium-md">
              {profile?.name?.[0] ?? ''}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-white" />
          </div>
        </div>
      </div>
    </motion.header>
  )
}
