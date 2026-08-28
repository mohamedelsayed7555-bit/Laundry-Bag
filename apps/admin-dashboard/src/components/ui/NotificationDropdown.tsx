'use client'

import { useEffect, useState, useRef } from 'react'
import { Bell, ShoppingBag, Truck, CreditCard, Users, CheckCheck, X, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Notification {
  id: string
  title: string
  body: string
  type: string
  data: any
  read_at: string | null
  created_at: string
}

const subtypeConfig: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  new_order: { icon: ShoppingBag, color: 'text-primary-500', bg: 'bg-primary-500/10' },
  status_change: { icon: Truck, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  payment: { icon: CreditCard, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
}
const typeConfig: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  order: { icon: ShoppingBag, color: 'text-primary-500', bg: 'bg-primary-500/10' },
  offer: { icon: Bell, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  reminder: { icon: Bell, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  system: { icon: Bell, color: 'text-gray-500', bg: 'bg-gray-100' },
  default: { icon: Bell, color: 'text-gray-500', bg: 'bg-gray-100' },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'الآن'
  if (mins < 60) return `منذ ${mins} د`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `منذ ${hours} س`
  const days = Math.floor(hours / 24)
  return `منذ ${days} يوم`
}

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [adminId, setAdminId] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter(n => !n.read_at).length

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setAdminId(user.id)
    })
  }, [])

  useEffect(() => {
    if (!adminId) return
    loadNotifications()

    const channel = supabase
      .channel('admin-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${adminId}`,
      }, (payload) => {
        setNotifications(prev => [payload.new as Notification, ...prev])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [adminId])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function loadNotifications() {
    if (!adminId) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', adminId)
      .order('created_at', { ascending: false })
      .limit(30)
    setNotifications(data ?? [])
    setLoading(false)
  }

  async function markAsRead(id: string) {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
  }

  async function markAllRead() {
    if (!adminId) return
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', adminId).is('read_at', null)
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })))
  }

  async function clearAll() {
    if (!adminId) return
    await supabase.from('notifications').delete().eq('user_id', adminId)
    setNotifications([])
  }

  const cfg = (type: string, data: any) => {
    const subtype = data?.subtype
    if (subtype && subtypeConfig[subtype]) return subtypeConfig[subtype]
    return typeConfig[type] || typeConfig.default
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl hover:bg-surface-muted transition-colors group"
      >
        <Bell size={17} className={`transition-colors ${open ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-600'}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-accent-rose text-white text-[10px] font-bold rounded-full ring-2 ring-white px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-premium-lg border border-surface-border/60 overflow-hidden z-50 animate-scale-in"
          style={{ maxHeight: '480px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-surface-border/60">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-800 text-sm">الإشعارات</h3>
              {unreadCount > 0 && (
                <span className="bg-accent-rose/10 text-accent-rose text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} جديد
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="p-1.5 rounded-lg hover:bg-surface-muted transition-colors" title="قراءة الكل">
                  <CheckCheck size={14} className="text-primary-500" />
                </button>
              )}
              {notifications.length > 0 && (
                <button onClick={clearAll} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="مسح الكل">
                  <Trash2 size={14} className="text-gray-400 hover:text-red-400" />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto" style={{ maxHeight: '380px' }}>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <div className="w-12 h-12 rounded-2xl bg-surface-muted flex items-center justify-center mb-3">
                  <Bell size={20} className="text-gray-300" />
                </div>
                <p className="text-sm font-medium">لا توجد إشعارات</p>
                <p className="text-xs mt-1">ستظهر هنا عند وصول إشعارات جديدة</p>
              </div>
            ) : (
              notifications.map((n) => {
                const { icon: Icon, color, bg } = cfg(n.type, n.data)
                return (
                  <button
                    key={n.id}
                    onClick={() => { if (!n.read_at) markAsRead(n.id) }}
                    className={`w-full flex items-start gap-3 px-5 py-3.5 text-right transition-colors hover:bg-surface-muted/50 ${
                      !n.read_at ? 'bg-primary-500/[0.03]' : ''
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      <Icon size={16} className={color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm leading-tight ${!n.read_at ? 'font-semibold text-gray-800' : 'font-medium text-gray-600'}`}>
                          {n.title}
                        </p>
                        {!n.read_at && (
                          <div className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0 mt-1.5" />
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 leading-relaxed line-clamp-2">{n.body}</p>
                      <p className="text-[10px] text-gray-300 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
