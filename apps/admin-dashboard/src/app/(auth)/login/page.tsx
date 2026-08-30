'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function FloatingIcon({ children, x, y, size, speed, delay, rotation }: {
  children: React.ReactNode; x: number; y: number; size: number; speed: number; delay: number; rotation: number
}) {
  return (
    <div
      className="floating-icon absolute pointer-events-none select-none"
      data-speed={speed}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        animation: `float ${4 + speed * 2}s ease-in-out ${delay}s infinite`,
        opacity: 0,
        animationFillMode: 'forwards',
      }}
    >
      {children}
    </div>
  )
}

const TShirtSVG = ({ color = '#00AF5F', opacity = 0.15 }: { color?: string; opacity?: number }) => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 8L8 16V28L16 26V56H48V26L56 28V16L44 8C44 8 40 14 32 14C24 14 20 8 20 8Z" stroke={color} strokeWidth="2" fill={color} fillOpacity={opacity} strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const HangerSVG = ({ color = '#8B5CF6', opacity = 0.12 }: { color?: string; opacity?: number }) => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M32 8C32 8 28 8 28 12C28 16 32 16 32 16" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    <path d="M32 16L8 40H56L32 16Z" stroke={color} strokeWidth="2" fill={color} fillOpacity={opacity} strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="8" y1="40" x2="56" y2="40" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
)

const BubbleSVG = ({ color = '#00AF5F', opacity = 0.08 }: { color?: string; opacity?: number }) => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="28" stroke={color} strokeWidth="1.5" fill={color} fillOpacity={opacity}/>
    <ellipse cx="22" cy="22" rx="8" ry="6" fill="white" fillOpacity="0.08" transform="rotate(-30 22 22)"/>
    <circle cx="18" cy="46" r="6" stroke={color} strokeWidth="1" fill={color} fillOpacity={opacity * 0.5}/>
    <circle cx="48" cy="18" r="4" stroke={color} strokeWidth="1" fill={color} fillOpacity={opacity * 0.5}/>
  </svg>
)

const IronSVG = ({ color = '#F59E0B', opacity = 0.12 }: { color?: string; opacity?: number }) => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 24H48L52 44H8L16 24Z" stroke={color} strokeWidth="2" fill={color} fillOpacity={opacity} strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M24 24V16C24 14 26 12 28 12H36C38 12 40 14 40 16V24" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    <line x1="20" y1="36" x2="44" y2="36" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
  </svg>
)

const DropletSVG = ({ color = '#06B6D4', opacity = 0.1 }: { color?: string; opacity?: number }) => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M32 6C32 6 12 30 12 42C12 53 21 58 32 58C43 58 52 53 52 42C52 30 32 6 32 6Z" stroke={color} strokeWidth="2" fill={color} fillOpacity={opacity} strokeLinecap="round" strokeLinejoin="round"/>
    <ellipse cx="24" cy="38" rx="5" ry="8" fill="white" fillOpacity="0.06" transform="rotate(-15 24 38)"/>
  </svg>
)

const SparklesSVG = ({ color = '#00AF5F', opacity = 0.15 }: { color?: string; opacity?: number }) => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M32 4L36 24L56 20L40 32L56 44L36 40L32 60L28 40L8 44L24 32L8 20L28 24L32 4Z" stroke={color} strokeWidth="1.5" fill={color} fillOpacity={opacity} strokeLinejoin="round"/>
  </svg>
)

const WashingMachineSVG = () => (
  <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <rect x="20" y="10" width="160" height="180" rx="16" stroke="rgba(255,255,255,0.15)" strokeWidth="2" fill="rgba(255,255,255,0.03)"/>
    <rect x="30" y="20" width="140" height="40" rx="8" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" fill="rgba(255,255,255,0.02)"/>
    <circle cx="50" cy="40" r="6" fill="#00AF5F" fillOpacity="0.4"/>
    <circle cx="70" cy="40" r="6" fill="#8B5CF6" fillOpacity="0.3"/>
    <circle cx="90" cy="40" r="6" fill="#F59E0B" fillOpacity="0.3"/>
    <rect x="120" y="32" width="40" height="16" rx="4" stroke="rgba(255,255,255,0.1)" strokeWidth="1" fill="rgba(255,255,255,0.02)"/>
    <circle cx="100" cy="125" r="52" stroke="rgba(255,255,255,0.12)" strokeWidth="2" fill="rgba(255,255,255,0.02)"/>
    <circle cx="100" cy="125" r="40" stroke="rgba(0,175,95,0.2)" strokeWidth="1.5" fill="rgba(0,175,95,0.03)">
      <animateTransform attributeName="transform" type="rotate" values="0 100 125;360 100 125" dur="8s" repeatCount="indefinite"/>
    </circle>
    <path d="M80 110 Q90 130 100 115 Q110 100 120 120 Q130 140 115 135" stroke="rgba(0,175,95,0.25)" strokeWidth="2" fill="rgba(0,175,95,0.05)" strokeLinecap="round">
      <animateTransform attributeName="transform" type="rotate" values="0 100 125;360 100 125" dur="8s" repeatCount="indefinite"/>
    </path>
    <circle cx="100" cy="125" r="4" fill="rgba(255,255,255,0.08)">
      <animateTransform attributeName="transform" type="rotate" values="0 100 125;360 100 125" dur="8s" repeatCount="indefinite"/>
    </circle>
  </svg>
)

const features = [
  { icon: '⚡', title: 'Real-time Tracking', desc: 'Monitor every order from pickup to delivery in real-time' },
  { icon: '📊', title: 'Smart Analytics', desc: 'AI-powered insights to optimize your operations' },
  { icon: '🚀', title: 'Fleet Management', desc: 'Assign drivers and manage routes efficiently' },
  { icon: '💎', title: 'Premium Experience', desc: 'White-glove service management for your customers' },
]

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [activeFeature, setActiveFeature] = useState(0)
  const router = useRouter()
  const brandRef = useRef<HTMLDivElement>(null)
  const mouseRef = useRef({ x: 0.5, y: 0.5 })
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature(prev => (prev + 1) % features.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    mouseRef.current = {
      x: e.clientX / window.innerWidth,
      y: e.clientY / window.innerHeight,
    }
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    function animate() {
      const icons = brandRef.current?.querySelectorAll('.floating-icon')
      if (icons) {
        const mx = (mouseRef.current.x - 0.5) * 2
        const my = (mouseRef.current.y - 0.5) * 2
        icons.forEach((el) => {
          const speed = parseFloat((el as HTMLElement).dataset.speed || '1')
          const tx = mx * speed * 25
          const ty = my * speed * 18
          ;(el as HTMLElement).style.transform = `translate(${tx}px, ${ty}px)`
        })
      }
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      cancelAnimationFrame(rafRef.current)
    }
  }, [handleMouseMove])

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
    <div className="min-h-screen flex flex-col lg:flex-row">
      <style jsx>{`
        @keyframes float {
          0%, 100% { opacity: 1; transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .feature-enter {
          animation: fade-up 0.5s ease-out forwards;
        }
      `}</style>

      {/* Left side — Branding */}
      <div ref={brandRef} className="hidden lg:flex lg:w-[55%] relative overflow-hidden flex-col justify-between p-12"
        style={{
          background: 'linear-gradient(135deg, #0a1628 0%, #0e1f3d 30%, #12133a 60%, #0a1628 100%)',
        }}
      >
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary-500/[0.07] rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent-purple/[0.06] rounded-full blur-[100px]" />
          <div className="absolute top-1/2 left-1/3 w-[300px] h-[300px] bg-cyan-500/[0.04] rounded-full blur-[80px]" />
        </div>

        {/* Floating icons */}
        <FloatingIcon x={5} y={8} size={48} speed={1.8} delay={0} rotation={-15}><TShirtSVG /></FloatingIcon>
        <FloatingIcon x={80} y={5} size={40} speed={1.2} delay={0.5} rotation={12}><HangerSVG /></FloatingIcon>
        <FloatingIcon x={8} y={75} size={36} speed={2.2} delay={1} rotation={20}><BubbleSVG /></FloatingIcon>
        <FloatingIcon x={85} y={70} size={44} speed={1.5} delay={0.3} rotation={-10}><IronSVG /></FloatingIcon>
        <FloatingIcon x={20} y={40} size={30} speed={2.5} delay={0.8} rotation={30}><DropletSVG /></FloatingIcon>
        <FloatingIcon x={75} y={35} size={34} speed={1.9} delay={1.2} rotation={-25}><SparklesSVG /></FloatingIcon>
        <FloatingIcon x={50} y={85} size={28} speed={1.4} delay={0.6} rotation={45}><DropletSVG color="#8B5CF6" opacity={0.08} /></FloatingIcon>
        <FloatingIcon x={90} y={50} size={32} speed={2.0} delay={0.9} rotation={-5}><TShirtSVG color="#8B5CF6" opacity={0.1} /></FloatingIcon>
        <FloatingIcon x={60} y={15} size={26} speed={1.6} delay={1.5} rotation={15}><BubbleSVG color="#06B6D4" opacity={0.06} /></FloatingIcon>

        {/* Top — Logo & tagline */}
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl flex items-center justify-center shadow-glow-green">
              <span className="text-xl font-black text-white">LB</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-widest">Laundry Bag</h1>
              <p className="text-xs text-primary-400 font-medium tracking-wider">MANAGEMENT PLATFORM</p>
            </div>
          </div>
        </div>

        {/* Center — Washing machine + headline */}
        <div className="relative z-10 flex flex-col items-center -mt-8">
          <div className="w-52 h-52 mb-8">
            <WashingMachineSVG />
          </div>
          <h2 className="text-4xl font-bold text-white text-center leading-tight mb-3">
            The Future of<br />
            <span className="bg-gradient-to-r from-primary-400 via-emerald-300 to-cyan-400 bg-clip-text text-transparent">
              Laundry Operations
            </span>
          </h2>
          <p className="text-navy-300 text-center max-w-md text-sm leading-relaxed">
            Streamline your entire laundry business with our all-in-one platform.
            From order management to delivery tracking — everything in one place.
          </p>
        </div>

        {/* Bottom — Feature cards carousel */}
        <div className="relative z-10">
          <div className="grid grid-cols-2 gap-3">
            {features.map((f, i) => (
              <div
                key={i}
                className={`p-4 rounded-2xl border transition-all duration-500 ${
                  i === activeFeature
                    ? 'bg-white/[0.06] border-primary-500/30 shadow-[0_0_30px_-5px_rgba(0,175,95,0.15)]'
                    : 'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04]'
                }`}
              >
                <span className="text-xl mb-2 block">{f.icon}</span>
                <h3 className={`text-sm font-semibold mb-1 transition-colors duration-500 ${
                  i === activeFeature ? 'text-primary-400' : 'text-white/80'
                }`}>{f.title}</h3>
                <p className="text-[11px] text-navy-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-2 mt-5">
            {features.map((_, i) => (
              <button key={i} onClick={() => setActiveFeature(i)}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  i === activeFeature ? 'w-8 bg-primary-500' : 'w-1.5 bg-white/20 hover:bg-white/30'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right side — Login form */}
      <div className="flex-1 flex items-center justify-center bg-navy-950 relative overflow-hidden min-h-screen lg:min-h-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-navy-900/50 via-navy-950 to-navy-950" />
        <div className="absolute top-1/4 -right-20 w-72 h-72 bg-primary-500/[0.06] rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -left-20 w-72 h-72 bg-accent-purple/[0.06] rounded-full blur-3xl" />

        {/* Mobile branding (shown on small screens) */}
        <div className="lg:hidden absolute top-0 left-0 right-0 h-32 flex items-center justify-center"
          style={{ background: 'linear-gradient(to bottom, rgba(10,22,40,0.8), transparent)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center shadow-glow-green">
              <span className="text-lg font-black text-white">LB</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-widest">Laundry Bag</h1>
          </div>
        </div>

        <div className="relative w-full max-w-sm px-6 animate-scale-in z-10">
          <div className="text-center mb-8 lg:mb-10">
            <div className="lg:hidden w-14 h-14 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-glow-green">
              <span className="text-xl font-black text-white">LB</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-1">Welcome back</h2>
            <p className="text-navy-400 text-sm">Sign in to your admin dashboard</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm mb-4 text-center animate-slide-in">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-2">Email Address <span className="text-red-400">*</span></label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@cleano.com"
                required
                className="w-full p-3.5 bg-navy-800/40 border border-navy-600/40 rounded-xl text-white placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500/40 transition-all"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-2">Password <span className="text-red-400">*</span></label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full p-3.5 pr-12 bg-navy-800/40 border border-navy-600/40 rounded-xl text-white placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500/40 transition-all"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 hover:text-white transition-colors text-lg"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary-500 to-primary-600 text-white p-3.5 rounded-xl text-base font-semibold hover:shadow-glow-green disabled:opacity-50 transition-all duration-300 mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4" strokeLinecap="round"><animateTransform attributeName="transform" type="rotate" values="0 12 12;360 12 12" dur="1s" repeatCount="indefinite"/></circle></svg>
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/[0.04]">
            <p className="text-center text-navy-500 text-xs">
              Powered by <span className="text-primary-500 font-semibold">Laundry Bag</span> Platform
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
