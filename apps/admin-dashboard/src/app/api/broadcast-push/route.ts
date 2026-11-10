import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { requireAdmin, logAudit } from '@/lib/api-auth'

/**
 * Expo's push endpoint sends no Access-Control-Allow-Origin, so a browser
 * refuses the request before it leaves the page. The dashboard called it
 * straight from the client, which meant no broadcast ever reached anyone —
 * the failure was swallowed and reported as a success. The call belongs on
 * the server, where CORS does not apply.
 */

const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send'
const BATCH = 100
const MAX_TOKENS = 5000
const TOKEN_RE = /^Expo(nent)?PushToken\[[^\]]+\]$/

type Ticket = { status?: string; id?: string; message?: string; details?: { error?: string } }

export async function POST(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth

  let payload: { tokens?: unknown; title?: unknown; body?: unknown; sound?: unknown; channelId?: unknown }
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
  }

  const title = typeof payload.title === 'string' ? payload.title.trim() : ''
  const body = typeof payload.body === 'string' ? payload.body.trim() : ''
  if (!title || !body) {
    return NextResponse.json({ error: 'العنوان والرسالة مطلوبين' }, { status: 400 })
  }

  const tokens = Array.isArray(payload.tokens)
    ? Array.from(new Set(payload.tokens.filter((t): t is string => typeof t === 'string' && TOKEN_RE.test(t))))
    : []
  if (tokens.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, reasons: {}, ticketIds: [] })
  }
  if (tokens.length > MAX_TOKENS) {
    return NextResponse.json({ error: 'عدد المستلمين كبير جداً' }, { status: 400 })
  }

  const sound = typeof payload.sound === 'string' ? payload.sound : 'offer.wav'
  const channelId = typeof payload.channelId === 'string' ? payload.channelId : 'offers-v1'

  let sent = 0
  let failed = 0
  const reasons: Record<string, number> = {}
  const ticketIds: string[] = []
  const note = (why: string, n: number) => { reasons[why] = (reasons[why] ?? 0) + n }

  for (let i = 0; i < tokens.length; i += BATCH) {
    const batch = tokens.slice(i, i + BATCH)
    const messages = batch.map(to => ({
      to, title, body, sound, channelId, priority: 'high',
      data: { type: 'broadcast' },
    }))
    try {
      const res = await fetch(EXPO_PUSH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept-Encoding': 'gzip, deflate' },
        body: JSON.stringify(messages),
      })
      if (!res.ok) {
        failed += batch.length
        note(`HTTP ${res.status}`, batch.length)
        continue
      }
      const json = await res.json().catch(() => null)
      const tickets: Ticket[] = Array.isArray(json?.data) ? json.data : []
      if (tickets.length === 0) {
        // an answer we do not recognise is not proof of delivery
        failed += batch.length
        note('رد غير مفهوم من Expo', batch.length)
        continue
      }
      for (const t of tickets) {
        if (t?.status === 'ok') {
          sent++
          if (t.id) ticketIds.push(t.id)
        } else {
          failed++
          note(t?.details?.error ?? t?.message ?? 'سبب غير معروف', 1)
        }
      }
    } catch (e) {
      failed += batch.length
      note(e instanceof Error ? e.message : 'تعذّر الاتصال بـ Expo', batch.length)
    }
  }

  await logAudit(auth.userId, 'broadcast_push', 'notification', '-', {
    title, recipients: tokens.length, sent, failed, reasons,
  })

  return NextResponse.json({ sent, failed, reasons, ticketIds })
}
