'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  Crown,
  ScrollText,
  LogOut,
  ChevronLeft,
  Sparkles,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Tooltip from '@/components/ui/Tooltip'
import { useAuth, ROUTE_PERMISSIONS } from '@/lib/auth-context'
import { useLang } from '@/lib/language-context'

function useNavGroups() {
  const { t } = useLang()
  return [
    {
      label: t.sidebar.mainMenu,
      items: [
        { label: t.sidebar.home, href: '/', icon: LayoutDashboard },
        { label: t.sidebar.orders, href: '/orders', icon: ClipboardList },
      ],
    },
    {
      label: t.sidebar.resourceManagement,
      items: [
        { label: t.sidebar.customers, href: '/customers', icon: Users },
        { label: t.sidebar.drivers, href: '/drivers', icon: Truck },
        { label: t.sidebar.branches, href: '/branches', icon: MapPin },
      ],
    },
    {
      label: t.sidebar.financialOps,
      items: [
        { label: t.sidebar.prices, href: '/prices', icon: Tag },
        { label: t.sidebar.plans, href: '/plans', icon: Crown },
        { label: 'الاشتراكات', href: '/subscriptions', icon: Crown },
        { label: t.sidebar.finance, href: '/finance', icon: DollarSign },
        { label: t.sidebar.inventory, href: '/inventory', icon: Package },
      ],
    },
    {
      label: t.sidebar.analytics,
      items: [
        { label: t.sidebar.reports, href: '/reports', icon: BarChart3 },
        { label: t.sidebar.auditLog, href: '/audit', icon: ScrollText },
        { label: t.sidebar.settings, href: '/settings', icon: Settings },
      ],
    },
  ]
}

export default function Sidebar({ collapsed, onToggleCollapse }: { collapsed?: boolean; onToggleCollapse?: () => void } = {}) {
  const pathname = usePathname()
  const router = useRouter()
  const { hasPermission } = useAuth()
  const { t } = useLang()
  const navGroups = useNavGroups()
  const [internalCollapsed, setInternalCollapsed] = useState(false)
  const isCollapsed = collapsed ?? internalCollapsed
  const toggleCollapse = onToggleCollapse ?? (() => setInternalCollapsed(c => !c))

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const sidebarWidth = isCollapsed ? 'w-[72px]' : 'w-[260px]'

  return (
    <motion.aside
      layout
      className={cn(
        'fixed right-0 top-0 h-screen flex flex-col z-50 transition-all duration-300',
        sidebarWidth
      )}
      style={{
        background: 'linear-gradient(180deg, #0e1428 0%, #0a0f1e 50%, #0e1428 100%)',
      }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-accent-purple/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 -left-10 w-40 h-40 bg-primary-500/5 rounded-full blur-3xl" />
      </div>

      <div className={cn(
        'relative flex items-center border-b border-white/[0.06] transition-all duration-300',
        isCollapsed ? 'justify-center p-4 h-[72px]' : 'justify-between p-5 h-[72px]'
      )}>
        <div className={cn('flex items-center gap-3', isCollapsed && 'justify-center')}>
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-glow-green">
              <Sparkles size={18} className="text-white" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-primary-400 rounded-full animate-pulse-slow" />
          </div>
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="overflow-hidden"
              >
                <h1 className="text-lg font-bold text-white tracking-wider whitespace-nowrap">Laundry Bag</h1>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {!isCollapsed && (
          <button
            onClick={toggleCollapse}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] text-navy-400 hover:text-white transition-colors"
          >
            <ChevronLeft size={16} className="rotate-180" />
          </button>
        )}
        {isCollapsed && (
          <button
            onClick={toggleCollapse}
            className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-navy-800 border border-white/10 rounded-full flex items-center justify-center text-navy-400 hover:text-white hover:bg-navy-700 transition-all shadow-md z-10"
          >
            <ChevronLeft size={12} />
          </button>
        )}
      </div>

      <nav className="flex-1 py-3 px-2.5 space-y-4 overflow-y-auto relative">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(item => {
            const perm = ROUTE_PERMISSIONS[item.href]
            return !perm || hasPermission(perm)
          })
          if (visibleItems.length === 0) return null
          return (
          <div key={group.label}>
            <AnimatePresence>
              {!isCollapsed && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-3 mb-1.5 text-[10px] font-semibold text-navy-400 uppercase tracking-wider"
                >
                  {group.label}
                </motion.p>
              )}
            </AnimatePresence>
            <div className="space-y-0.5">
              {visibleItems.map((item) => {
                const isActive = pathname === item.href ||
                  (item.href !== '/' && pathname.startsWith(item.href))
                const Icon = item.icon

                const linkEl = (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200',
                      isCollapsed ? 'justify-center p-2.5' : 'px-3 py-2.5',
                      isActive
                        ? 'text-white'
                        : 'text-navy-300 hover:text-white hover:bg-white/[0.04]'
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active"
                        className="absolute inset-0 rounded-xl bg-gradient-to-l from-primary-500/20 to-accent-purple/10 border border-primary-500/20"
                        style={{ boxShadow: '0 0 20px -5px rgba(0, 175, 95, 0.15)' }}
                        transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
                      />
                    )}
                    <span className={cn(
                      'relative z-10 flex items-center justify-center',
                      isActive && 'text-primary-400'
                    )}>
                      <Icon size={18} />
                    </span>
                    <AnimatePresence>
                      {!isCollapsed && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: 'auto' }}
                          exit={{ opacity: 0, width: 0 }}
                          className="relative z-10 whitespace-nowrap overflow-hidden"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {isActive && !isCollapsed && (
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary-400 z-10" />
                    )}
                  </Link>
                )

                return isCollapsed ? (
                  <Tooltip key={item.href} content={item.label} side="left">
                    {linkEl}
                  </Tooltip>
                ) : linkEl
              })}
            </div>
          </div>
          )
        })}
      </nav>

      <div className="relative p-2.5 border-t border-white/[0.06]">
        {isCollapsed ? (
          <Tooltip content={t.sidebar.signOut} side="left">
            <button
              onClick={handleSignOut}
              className="flex items-center justify-center p-2.5 rounded-xl text-sm text-navy-400 hover:bg-red-500/10 hover:text-red-400 w-full transition-all duration-200"
            >
              <LogOut size={18} />
            </button>
          </Tooltip>
        ) : (
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-navy-400 hover:bg-red-500/10 hover:text-red-400 w-full transition-all duration-200"
          >
            <LogOut size={18} />
            <span className="whitespace-nowrap">{t.sidebar.signOut}</span>
          </button>
        )}
      </div>
    </motion.aside>
  )
}
