'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { motion } from 'framer-motion'
import { Bell, Send, Users, Crown, UserX, Loader2, MessageCircle, Download, ExternalLink } from 'lucide-react'
import Badge from '@/components/ui/Badge'
import DataTable from '@/components/ui/DataTable'
import PermissionGate from '@/components/ui/PermissionGate'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/lib/auth-context'

type Target = 'all' | 'subscribers' | 'non_subscribers'

const targetOptions: { key: Target; label: string; icon: typeof Users }[] = [
  { key: 'all', label: 'كل العملاء', icon: Users },
  { key: 'subscribers', label: 'المشتركين فقط', icon: Crown },
  { key: 'non_subscribers', label: 'غير المشتركين', icon: UserX },
]

export default function NotificationsPage() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [target, setTarget] = useState<Target>('all')
  const [sending, setSending] = useState(false)
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [recipientCount, setRecipientCount] = useState<number | null>(null)
  const [waCustomers, setWaCustomers] = useState<any[]>([])
  const [showWaList, setShowWaList] = useState(false)
  const [loadingWa, setLoadingWa] = useState(false)
  const { toast } = useToast()
  const { user: profile, hasPermission } = useAuth()

  useEffect(() => { loadHistory() }, [])
  useEffect(() => { loadRecipientCount() }, [target])

  async function loadWaCustomers() {
    try {
      setLoadingWa(true)
      let query = supabase.from('users').select('id, name, phone, customer_code').eq('role', 'customer')
      if (target === 'subscribers') {
        const { data: subUsers } = await supabase.from('subscriptions').select('user_id').eq('status', 'active')
        const ids = (subUsers ?? []).map(s => s.user_id)
        if (ids.length > 0) query = query.in('id', ids)
        else { setWaCustomers([]); setLoadingWa(false); setShowWaList(true); return }
      } else if (target === 'non_subscribers') {
        const { data: subUsers } = await supabase.from('subscriptions').select('user_id').eq('status', 'active')
        const ids = (subUsers ?? []).map(s => s.user_id)
        if (ids.length > 0) query = (query as any).not('id', 'in', `(${ids.join(',')})`)
      }
      const { data, error } = await query.not('phone', 'is', null).order('name')
      if (error) { toast('خطأ في تحميل العملاء: ' + error.message, 'error'); setLoadingWa(false); return }
      setWaCustomers((data ?? []).filter(c => c.phone))
      setLoadingWa(false)
      setShowWaList(true)
    } catch (e) {
      toast('حدث خطأ غير متوقع', 'error')
      setLoadingWa(false)
    }
  }

  function getWaLink(phone: string | null) {
    if (!phone) return '#'
    let num = phone.replace(/\D/g, '')
    if (num.startsWith('0')) num = '2' + num
    if (!num.startsWith('20')) num = '20' + num
    const msg = encodeURIComponent(`${title.trim()}\n\n${body.trim()}`)
    return `https://wa.me/${num}?text=${msg}`
  }

  function exportCSV() {
    const header = 'الاسم,الكود,الرقم\n'
    const rows = waCustomers.map(c => `${c.name},${c.customer_code ?? ''},${c.phone}`).join('\n')
    const blob = new Blob(['﻿' + header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `customers_${target}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function loadHistory() {
    const { data } = await supabase
      .from('broadcast_messages')
      .select('*, sender:users!broadcast_messages_sent_by_fkey(name)')
      .order('created_at', { ascending: false })
      .limit(20)
    setHistory(data ?? [])
    setLoading(false)
  }

  async function loadRecipientCount() {
    let query = supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'customer')
      .not('fcm_token', 'is', null)

    if (target === 'subscribers') {
      const { data: subUsers } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('status', 'active')
      const ids = (subUsers ?? []).map(s => s.user_id)
      if (ids.length === 0) { setRecipientCount(0); return }
      query = query.in('id', ids)
    } else if (target === 'non_subscribers') {
      const { data: subUsers } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('status', 'active')
      const ids = (subUsers ?? []).map(s => s.user_id)
      if (ids.length > 0) {
        query = (query as any).not('id', 'in', `(${ids.join(',')})`)
      }
    }

    const { count } = await query
    setRecipientCount(count ?? 0)
  }

  async function handleSend() {
    if (!title.trim() || !body.trim()) {
      toast('اكتب العنوان والرسالة', 'error')
      return
    }

    setSending(true)

    // Get all target customers (for saving notifications)
    let allQuery = supabase.from('users').select('id, fcm_token').eq('role', 'customer')
    if (target === 'subscribers') {
      const { data: subUsers } = await supabase.from('subscriptions').select('user_id').eq('status', 'active')
      const ids = (subUsers ?? []).map(s => s.user_id)
      if (ids.length === 0) { toast('لا يوجد مشتركين حالياً', 'error'); setSending(false); return }
      allQuery = allQuery.in('id', ids)
    } else if (target === 'non_subscribers') {
      const { data: subUsers } = await supabase.from('subscriptions').select('user_id').eq('status', 'active')
      const ids = (subUsers ?? []).map(s => s.user_id)
      if (ids.length > 0) allQuery = (allQuery as any).not('id', 'in', `(${ids.join(',')})`)
    }

    const { data: allUsers } = await allQuery
    if (!allUsers || allUsers.length === 0) { toast('لا يوجد عملاء مستهدفين', 'error'); setSending(false); return }

    // Save notification for each user
    const notifRows = allUsers.map(u => ({
      user_id: u.id,
      title: title.trim(),
      body: body.trim(),
      type: 'offer' as const,
      data: { type: 'broadcast' },
      sent_at: new Date().toISOString(),
    }))
    await supabase.from('notifications').insert(notifRows)

    // Send push to users with tokens
    const tokens = allUsers.map(u => u.fcm_token).filter(Boolean)
    let successCount = 0
    for (let i = 0; i < tokens.length; i += 100) {
      const batch = tokens.slice(i, i + 100)
      try {
        const messages = batch.map(token => ({
          to: token,
          title: title.trim(),
          body: body.trim(),
          sound: 'default',
          data: { type: 'broadcast' },
        }))
        const res = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messages),
        })
        if (res.ok) successCount += batch.length
      } catch {}
    }

    await supabase.from('broadcast_messages').insert({
      title: title.trim(),
      body: body.trim(),
      target,
      sent_by: profile?.id,
      recipients_count: allUsers.length,
    })

    toast(`تم إرسال الإشعار لـ ${allUsers.length} عميل (${successCount} push)`)
    setTitle('')
    setBody('')
    setSending(false)
    loadHistory()
  }

  const targetLabel: Record<string, string> = {
    all: 'كل العملاء',
    subscribers: 'المشتركين',
    non_subscribers: 'غير المشتركين',
  }

  const columns = [
    {
      key: 'title',
      label: 'العنوان',
      render: (item: any) => (
        <div>
          <p className="font-semibold text-gray-800">{item.title}</p>
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{item.body}</p>
        </div>
      ),
    },
    {
      key: 'target',
      label: 'الفئة',
      render: (item: any) => (
        <Badge variant={item.target === 'all' ? 'info' : item.target === 'subscribers' ? 'warning' : 'neutral'}>
          {targetLabel[item.target] ?? item.target}
        </Badge>
      ),
    },
    {
      key: 'recipients_count',
      label: 'عدد المستلمين',
      render: (item: any) => <span className="font-semibold">{item.recipients_count}</span>,
    },
    {
      key: 'sender',
      label: 'المرسل',
      render: (item: any) => <span className="text-gray-600">{item.sender?.name ?? '—'}</span>,
    },
    {
      key: 'created_at',
      label: 'التاريخ',
      render: (item: any) => (
        <div>
          <span className="text-xs text-gray-600">
            {new Date(item.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
          </span>
          <p className="text-[10px] text-gray-400">
            {new Date(item.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      ),
    },
  ]

  const inputClass = 'w-full px-4 py-3 bg-white border border-surface-border/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all text-right'

  return (
    <PermissionGate permission="notifications.view">
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary-500" />
            الإشعارات الجماعية
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">أرسل إشعارات لعملائك</p>
        </motion.div>

        {/* Compose */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-surface-border/60 p-6 space-y-5"
        >
          <h3 className="font-semibold text-gray-700 flex items-center gap-2">
            <Send size={16} className="text-primary-500" />
            إرسال إشعار جديد
          </h3>

          {/* Target */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">الفئة المستهدفة</label>
            <div className="flex gap-2">
              {targetOptions.map(opt => {
                const Icon = opt.icon
                return (
                  <button
                    key={opt.key}
                    onClick={() => setTarget(opt.key)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-medium transition-all ${
                      target === opt.key
                        ? 'bg-navy-900 text-white shadow-premium-md'
                        : 'bg-white text-gray-500 hover:bg-surface-muted border border-surface-border/60'
                    }`}
                  >
                    <Icon size={14} />
                    {opt.label}
                  </button>
                )
              })}
              {recipientCount !== null && (
                <span className="flex items-center text-xs text-gray-400 mr-2">
                  ({recipientCount} مستلم)
                </span>
              )}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">عنوان الإشعار</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="مثال: عرض خاص لعملائنا"
              className={inputClass}
              maxLength={100}
            />
          </div>

          {/* Body */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">نص الرسالة</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="اكتب الرسالة هنا..."
              className={`${inputClass} min-h-[100px] resize-none`}
              maxLength={500}
            />
            <p className="text-[10px] text-gray-400 mt-1 text-left">{body.length}/500</p>
          </div>

          {/* Send */}
          {hasPermission('notifications.create') && (
            <button
              onClick={handleSend}
              disabled={sending || !title.trim() || !body.trim()}
              className="flex items-center justify-center gap-2 w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-premium-md"
            >
              {sending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  جاري الإرسال...
                </>
              ) : (
                <>
                  <Send size={16} />
                  إرسال الإشعار
                </>
              )}
            </button>
          )}
        </motion.div>

        {/* WhatsApp Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl border border-surface-border/60 p-6 space-y-4"
        >
          <h3 className="font-semibold text-gray-700 flex items-center gap-2">
            <MessageCircle size={16} className="text-green-500" />
            إرسال عبر واتساب
          </h3>
          <p className="text-xs text-gray-400">اكتب العنوان والرسالة أعلاه ثم اضغط هنا لإرسالها عبر واتساب للعملاء المستهدفين</p>

          <div className="flex gap-3">
            <button
              onClick={loadWaCustomers}
              disabled={loadingWa || !title.trim() || !body.trim()}
              className="flex items-center gap-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-5 rounded-xl transition-all text-sm"
            >
              {loadingWa ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />}
              عرض قائمة العملاء
            </button>
            {showWaList && waCustomers.length > 0 && (
              <button
                onClick={exportCSV}
                className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium py-2.5 px-5 rounded-xl transition-all text-sm"
              >
                <Download size={14} />
                تصدير CSV ({waCustomers.length})
              </button>
            )}
          </div>

          {showWaList && (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {waCustomers.length === 0 ? (
                <p className="text-center text-gray-400 py-6 text-sm">لا يوجد عملاء في هذه الفئة</p>
              ) : (
                <>
                  <p className="text-xs text-gray-400">{waCustomers.length} عميل — اضغط على أيقونة الواتساب لفتح المحادثة بالرسالة الجاهزة</p>
                  {waCustomers.map(c => (
                    <div key={c.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-700 text-sm truncate">{c.name}</p>
                        <p className="text-xs text-gray-400">{c.phone} {c.customer_code ? `• ${c.customer_code}` : ''}</p>
                      </div>
                      <a
                        href={getWaLink(c.phone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium py-2 px-3 rounded-lg transition-all shrink-0"
                      >
                        <ExternalLink size={12} />
                        واتساب
                      </a>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </motion.div>

        {/* History */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-4">سجل الإشعارات المرسلة</h3>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <DataTable columns={columns} data={history} emptyMessage="لا توجد إشعارات مرسلة بعد" />
          )}
        </motion.div>
      </div>
    </PermissionGate>
  )
}
