'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

/**
 * Staff sign-in.
 *
 * Two panels that fill the viewport exactly, so the page never scrolls on a desktop:
 * the floor photo with the figures a shift lead actually watches, and the credentials
 * column. There is no "forgot password" here on purpose — staff passwords are issued,
 * and only a super admin can reset one, which the page says instead of implying a
 * self-service flow that does not exist.
 */

const SHIFT = [
  { value: '148', unit: '', label: 'طلبات اليوم' },
  { value: '6', unit: '/8', label: 'سائق على الطريق' },
  { value: '21', unit: 'س', label: 'متوسط التسليم' },
  { value: '3', unit: '', label: 'بانتظار الاستلام', alert: true },
]

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email.includes('@')) { setError('أدخل بريد إلكتروني صحيح'); return }
    if (!password) { setError('أدخل كلمة المرور'); return }

    setLoading(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) { setError(signInError.message); setLoading(false); return }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('حدث خطأ'); setLoading(false); return }

    const { data: profile } = await supabase.from('users').select('role, is_active').eq('id', user.id).single()
    const allowedRoles = ['admin', 'super_admin', 'manager', 'accountant']
    if (!allowedRoles.includes(profile?.role)) {
      await supabase.auth.signOut()
      setError('غير مصرح لك بالدخول — هذه اللوحة للمسؤولين فقط')
      setLoading(false)
      return
    }
    if (profile?.is_active === false) {
      await supabase.auth.signOut()
      setError('تم تعطيل حسابك — تواصل مع المسؤول')
      setLoading(false)
      return
    }

    setLoading(false)
    router.refresh()
    router.push('/')
  }

  return (
    <div className="h-screen w-full bg-[#061021] text-[#EAF1FA] lg:overflow-hidden grid grid-cols-1 lg:grid-cols-[1.15fr_1fr]">

      {/* ---------- The floor ---------- */}
      <section className="relative isolate flex flex-col justify-between overflow-hidden p-7 min-h-[42vh] lg:min-h-0 lg:p-12">
        <img
          src="/login-floor.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        />
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              'linear-gradient(200deg, rgba(6,16,33,.62) 0%, rgba(6,16,33,.80) 46%, rgba(6,16,33,.97) 100%), radial-gradient(90% 60% at 18% 8%, rgba(56,189,248,.22), transparent 62%)',
          }}
        />

        <div className="flex items-center gap-3.5">
          <div
            role="img"
            aria-label="Laundry Bag"
            className="h-[52px] w-[52px] flex-none rounded-2xl border border-sky-400/35 bg-white shadow-[0_10px_28px_rgba(2,132,199,.34)]"
            style={{
              backgroundImage: 'url(/logo.jpg)',
              backgroundSize: '175%',
              backgroundPosition: '50% 24%',
              backgroundRepeat: 'no-repeat',
            }}
          />
          <div>
            <div className="text-lg font-semibold tracking-[0.14em]">LAUNDRY BAG</div>
            <div className="mt-0.5 text-[10.5px] font-semibold tracking-[0.26em] text-sky-400">MANAGEMENT PLATFORM</div>
          </div>
        </div>

        <div className="max-w-[22ch]">
          <h1 className="text-balance text-[30px] font-bold leading-[1.05] tracking-tight lg:text-[46px]">
            كل شنطة <span className="text-sky-400">محسوبة.</span>
          </h1>
          <p className="mt-3.5 hidden max-w-[36ch] text-sm leading-relaxed text-[#B7C7DA] lg:block">
            الاستلام والغسيل والسواقين والفواتير — شاشة واحدة من لحظة ما الشنطة تتاخد لحد ما ترجع لباب العميل.
          </p>
        </div>

        <div className="border-t border-white/10 pt-[18px]">
          <div className="mb-3.5 flex items-center gap-2 text-[10.5px] font-medium uppercase tracking-[0.16em] text-[#7F94AE]">
            <span className="h-[7px] w-[7px] flex-none rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,.16)]" />
            حالة الوردية · بيانات توضيحية
          </div>
          <div className="flex flex-wrap gap-x-7 gap-y-4 lg:gap-x-10">
            {SHIFT.map((m) => (
              <div key={m.label}>
                <div className={`text-[22px] font-bold leading-none tabular-nums lg:text-[29px] ${m.alert ? 'text-amber-400' : ''}`}>
                  {m.value}
                  {m.unit && <span className="ms-0.5 text-[0.5em] font-medium text-[#7F94AE]">{m.unit}</span>}
                </div>
                <div className="mt-1.5 text-[11.5px] text-[#7F94AE]">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Sign in ---------- */}
      <section className="grid place-items-center border-t border-[#1E3350] bg-[#0C182C] px-5 py-9 lg:border-s lg:border-t-0 lg:px-12 lg:py-0">
        <form onSubmit={handleLogin} className="w-full max-w-[372px]" noValidate>
          <h2 className="text-2xl font-semibold tracking-tight">أهلاً بعودتك</h2>
          <p className="mb-6 mt-1.5 text-[13.5px] text-[#7F94AE]">سجّل دخولك إلى لوحة تحكم Laundry Bag.</p>

          {error && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-[13px] leading-relaxed text-red-200"
            >
              {error}
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="email" className="mb-1.5 block text-[11.5px] font-semibold uppercase tracking-[0.07em] text-[#7F94AE]">
              البريد الإلكتروني
            </label>
            <div className="relative flex items-center">
              <svg className="pointer-events-none absolute start-3.5 text-[#7F94AE]" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 7 10 6 10-6" />
              </svg>
              <input
                id="email"
                type="email"
                dir="ltr"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@laundrybag.com"
                className="w-full rounded-xl border border-[#1E3350] bg-[#122238] py-3.5 pe-3.5 ps-11 text-left text-[14.5px] font-medium text-[#EAF1FA] placeholder:font-normal placeholder:text-[#51657E] transition focus:border-sky-400 focus:bg-[#142741] focus:outline-none focus:ring-[3px] focus:ring-sky-400/20"
              />
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="password" className="mb-1.5 block text-[11.5px] font-semibold uppercase tracking-[0.07em] text-[#7F94AE]">
              كلمة المرور
            </label>
            <div className="relative flex items-center">
              <svg className="pointer-events-none absolute start-3.5 text-[#7F94AE]" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                dir="ltr"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                className="w-full rounded-xl border border-[#1E3350] bg-[#122238] py-3.5 pe-11 ps-11 text-left text-[14.5px] font-medium text-[#EAF1FA] placeholder:text-[#51657E] transition focus:border-sky-400 focus:bg-[#142741] focus:outline-none focus:ring-[3px] focus:ring-sky-400/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                className="absolute end-1.5 grid place-items-center rounded-lg p-2 text-[#7F94AE] transition hover:text-[#EAF1FA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
              >
                {showPassword ? (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3l18 18" /><path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
                    <path d="M9.4 5.2A9.5 9.5 0 0 1 12 5c6.4 0 10 7 10 7a18 18 0 0 1-2.9 3.8" />
                    <path d="M6.2 6.6A17.6 17.6 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 3.6-.7" />
                  </svg>
                ) : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 py-3.5 text-[15px] font-semibold text-[#04121F] shadow-[0_10px_26px_rgba(2,132,199,.34)] transition hover:brightness-105 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <svg className="h-[18px] w-[18px] animate-spin" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4" strokeLinecap="round" />
                </svg>
                جاري الدخول…
              </>
            ) : (
              <>
                دخول
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5" /><path d="m11 6-6 6 6 6" />
                </svg>
              </>
            )}
          </button>

          <p className="mt-4 text-center text-[12.5px] leading-relaxed text-[#7F94AE]">
            اتقفل عليك الحساب؟ الـ Super Admin وحده يقدر يعيد تعيين كلمة مرور موظف، من الإعدادات ← المستخدمين.
          </p>

          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-sky-400/20 bg-sky-400/[0.055] px-3.5 py-3 text-xs leading-relaxed text-[#9DB2C8]">
            <svg className="mt-0.5 flex-none text-sky-400" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6Z" /><path d="m9 12 2 2 4-4" />
            </svg>
            <span>الدخول للموظفين فقط. كل عملية دخول وكل تعديل على حساب عميل بيتسجّل في سجل التدقيق.</span>
          </div>

          <div className="mt-6 text-center text-[11.5px] text-[#55697F]">
            Powered by <b className="font-semibold text-[#7F94AE]">Laundry Bag</b> Platform
          </div>
        </form>
      </section>
    </div>
  )
}
