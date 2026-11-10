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

  const message = (to: string) => ({
    to, title, body, sound, channelId, priority: 'high',
    data: { type: 'broadcast' },
  })

  // Expo refuses a whole request whose tokens belong to more than one project
  // (PUSH_TOO_MANY_EXPERIENCE_IDS), and our customers' tokens were registered
  // under two. Rather than lose the good ones with the bad, a rejected batch is
  // retried one message at a time so every token gets its own verdict.
  async function post(batch: string[]): Promise<{ handled: boolean; reason?: string }> {
    const res = await fetch(EXPO_PUSH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept-Encoding': 'gzip, deflate' },
      body: JSON.stringify(batch.map(message)),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      let why = `HTTP ${res.status}`
      try {
        const parsed = JSON.parse(text)
        const first = Array.isArray(parsed?.errors) ? parsed.errors[0] : null
        if (first?.code || first?.message) why = first.code ?? first.message
      } catch {
        if (text) why = `HTTP ${res.status}: ${text.slice(0, 120)}`
      }
      return { handled: false, reason: why }
    }
    const json = await res.json().catch(() => null)
    const tickets: Ticket[] = Array.isArray(json?.data) ? json.data : []
    // an answer we do not recognise is not proof of delivery
    if (tickets.length !== batch.length) return { handled: false, reason: 'رد غير مفهوم من Expo' }
    for (const t of tickets) {
      if (t?.status === 'ok') {
        sent++
        if (t.id) ticketIds.push(t.id)
      } else {
        failed++
        note(t?.details?.error ?? t?.message ?? 'سبب غير معروف', 1)
      }
    }
    return { handled: true }
  }

  for (let i = 0; i < tokens.length; i += BATCH) {
    const batch = tokens.slice(i, i + BATCH)
    let outcome: { handled: boolean; reason?: string }
    try {
      outcome = await post(batch)
    } catch (e) {
      outcome = { handled: false, reason: e instanceof Error ? e.message : 'تعذّر الاتصال بـ Expo' }
    }
    if (outcome.handled) continue
    if (batch.length === 1) {
      failed++
      note(outcome.reason ?? 'سبب غير معروف', 1)
      continue
    }
    for (const token of batch) {
      try {
        const one = await post([token])
        if (!one.handled) {
          failed++
          note(one.reason ?? 'سبب غير معروف', 1)
        }
      } catch (e) {
        failed++
        note(e instanceof Error ? e.message : 'تعذّر الاتصال بـ Expo', 1)
      }
    }
  }

  await logAudit(auth.userId, 'broadcast_push', 'notification', '-', {
    title, recipients: tokens.length, sent, failed, reasons,
  })

  return NextResponse.json({ sent, failed, reasons, ticketIds })
}
