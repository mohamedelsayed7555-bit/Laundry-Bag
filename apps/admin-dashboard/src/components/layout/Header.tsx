'use client'

import { useEffect, useState } from 'react'
import { Bell, Search, Moon, Sun } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { User } from '@cleano/shared-types'

export default function Header() {
  const [profile, setProfile] = useState<User | null>(null)
  const [date] = useState(new Date().toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }))

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const { data } = await supabase.from('users').select('*').eq('id', user.id).single()
        setProfile(data as User)
      }
    })
  }, [])

  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="بحث..."
            className="pr-10 pl-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm w-72 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400 hidden lg:block">{date}</span>

        <button className="relative p-2 rounded-xl hover:bg-gray-100 transition">
          <Bell size={18} className="text-gray-500" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        <div className="flex items-center gap-3 mr-2 pr-4 border-r border-gray-200">
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-800">{profile?.name ?? '...'}</p>
            <p className="text-[10px] text-gray-400">مدير النظام</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold text-sm">
            {profile?.name?.[0] ?? ''}
          </div>
        </div>
      </div>
    </header>
  )
}
