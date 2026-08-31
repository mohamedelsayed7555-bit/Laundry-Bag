import { NextRequest, NextResponse } from 'next/server'

const requests = new Map<string, { count: number; resetAt: number }>()

const WINDOW_MS = 60_000
const MAX_REQUESTS = 15

export function rateLimit(req: NextRequest): NextResponse | null {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const now = Date.now()
  const entry = requests.get(ip)

  if (!entry || now > entry.resetAt) {
    requests.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return null
  }

  entry.count++
  if (entry.count > MAX_REQUESTS) {
    return NextResponse.json(
      { error: 'تم تجاوز الحد المسموح — حاول بعد دقيقة' },
      { status: 429 }
    )
  }

  return null
}

setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of requests) {
    if (now > entry.resetAt) requests.delete(ip)
  }
}, 60_000)
