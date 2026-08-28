'use client'

import { useAuth } from '@/lib/auth-context'
import { ShieldX } from 'lucide-react'

interface PermissionGateProps {
  permission: string
  children: React.ReactNode
}

export default function PermissionGate({ permission, children }: PermissionGateProps) {
  const { hasPermission, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-7 h-7 border-[3px] border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!hasPermission(permission)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
          <ShieldX size={32} className="text-red-400" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-bold text-gray-800 mb-1">غير مصرح لك</h3>
          <p className="text-sm text-gray-400">ليس لديك صلاحية للوصول إلى هذه الصفحة</p>
          <p className="text-xs text-gray-300 mt-2">تواصل مع المسؤول لتعديل صلاحياتك</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
