'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
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

    const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
      await supabase.auth.signOut()
      setError('غير مصرح لك بالدخول — هذه اللوحة للمسؤولين فقط')
      setLoading(false)
      return
    }

    setLoading(false)
    router.refresh()
    router.push('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-950 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-navy-800/40 via-navy-950 to-navy-950" />
      <div className="absolute top-1/4 -right-32 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -left-32 w-96 h-96 bg-accent-purple/10 rounded-full blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="bg-navy-900/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-navy-700/50">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-500/25">
              <span className="text-2xl font-black text-white">C</span>
            </div>
            <h1 className="text-3xl font-bold text-white">CLEANO</h1>
            <p className="text-navy-400 text-sm mt-1">لوحة التحكم</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm mb-4 text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-2">البريد الإلكتروني</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@cleano.com"
                className="w-full p-3.5 bg-navy-800/50 border border-navy-600/50 rounded-xl text-white text-lg placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500/50 transition"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-2">كلمة المرور</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full p-3.5 bg-navy-800/50 border border-navy-600/50 rounded-xl text-white text-lg placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500/50 transition"
                dir="ltr"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-l from-primary-500 to-primary-600 text-white p-3.5 rounded-xl text-lg font-semibold hover:from-primary-600 hover:to-primary-700 disabled:opacity-50 transition shadow-lg shadow-primary-500/25"
            >
              {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
