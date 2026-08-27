import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  change?: string
  changeType?: 'up' | 'down' | 'neutral'
  icon: LucideIcon
  color: 'green' | 'blue' | 'purple' | 'orange' | 'red' | 'cyan'
}

const colorMap = {
  green: { bg: 'bg-primary-50', icon: 'text-primary-500', ring: 'ring-primary-500/20' },
  blue: { bg: 'bg-blue-50', icon: 'text-blue-500', ring: 'ring-blue-500/20' },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-500', ring: 'ring-purple-500/20' },
  orange: { bg: 'bg-orange-50', icon: 'text-orange-500', ring: 'ring-orange-500/20' },
  red: { bg: 'bg-red-50', icon: 'text-red-500', ring: 'ring-red-500/20' },
  cyan: { bg: 'bg-cyan-50', icon: 'text-cyan-500', ring: 'ring-cyan-500/20' },
}

export default function StatCard({ label, value, change, changeType = 'neutral', icon: Icon, color }: StatCardProps) {
  const colors = colorMap[color]

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow duration-300 border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <div className={cn('p-2.5 rounded-xl ring-2', colors.bg, colors.ring)}>
          <Icon size={20} className={colors.icon} />
        </div>
        {change && (
          <span className={cn(
            'text-xs font-semibold px-2 py-0.5 rounded-full',
            changeType === 'up' && 'bg-green-50 text-green-600',
            changeType === 'down' && 'bg-red-50 text-red-600',
            changeType === 'neutral' && 'bg-gray-50 text-gray-500',
          )}>
            {change}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-800">{value.toLocaleString()}</p>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
    </div>
  )
}
