'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Truck,
  MapPin,
  DollarSign,
  BarChart3,
  Settings,
  Tag,
  Package,
  LogOut,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const navItems = [
  { label: 'الرئيسية', href: '/', icon: LayoutDashboard },
  { label: 'الطلبات', href: '/orders', icon: ClipboardList },
  { label: 'العملاء', href: '/customers', icon: Users },
  { label: 'السائقين', href: '/drivers', icon: Truck },
  { label: 'الأسعار', href: '/prices', icon: Tag },
  { label: 'الفروع', href: '/branches', icon: MapPin },
  { label: 'المالية', href: '/finance', icon: DollarSign },
  { label: 'التقارير', href: '/reports', icon: BarChart3 },
  { label: 'المخزون', href: '/inventory', icon: Package },
  { label: 'الإعدادات', href: '/settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="fixed right-0 top-0 h-screen w-[240px] bg-navy-900 flex flex-col z-50">
      <div className="p-6 flex items-center justify-center border-b border-navy-700/50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white tracking-wide">CLEANO</h1>
          <p className="text-[10px] text-navy-300 mt-0.5">لوحة التحكم</p>
        </div>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25'
                  : 'text-navy-300 hover:bg-navy-800 hover:text-white'
              )}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-navy-700/50">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-navy-400 hover:bg-navy-800 hover:text-red-400 w-full transition-all duration-200"
        >
          <LogOut size={18} />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </aside>
  )
}
