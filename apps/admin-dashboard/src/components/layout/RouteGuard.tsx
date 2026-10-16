'use client'

import { usePathname } from 'next/navigation'
import { ShieldAlert, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useAuth, ROUTE_PERMISSIONS } from '@/lib/auth-context'

/**
 * The sidebar only hides links; typing a URL still opened the page.
 * This checks the same permission map for whatever route is open, so every
 * page is covered at once instead of each page guarding itself.
 */
export default function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, loading, hasPermission } = useAuth()

  // Match the longest configured prefix, so /orders/123 uses the /orders rule.
  const route = Object.keys(ROUTE_PERMISSIONS)
    .filter(r => pathname === r || pathname.startsWith(r + '/'))
    .sort((a, b) => b.length - a.length)[0]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-primary-500" size={28} />
      </div>
    )
  }

  if (user && route && !hasPermission(ROUTE_PERMISSIONS[route])) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20 px-6">
        <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mb-5">
          <ShieldAlert className="text-red-500" size={34} />
        </div>
        <h2 className="text-lg font-bold text-gray-800">لا تملك صلاحية لهذه الصفحة</h2>
        <p className="text-sm text-gray-500 mt-2 leading-7">
          لو محتاج تدخل عليها، كلّم مدير النظام عشان يضيف لك الصلاحية.
        </p>
        <Link
          href="/"
          className="mt-6 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm py-2.5 px-6 rounded-xl transition-colors"
        >
          الرجوع للرئيسية
        </Link>
      </div>
    )
  }

  return <>{children}</>
}
