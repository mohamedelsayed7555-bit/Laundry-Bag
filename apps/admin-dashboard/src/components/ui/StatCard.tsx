'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  change?: string
  changeType?: 'up' | 'down' | 'neutral'
  icon: LucideIcon
  color: 'green' | 'blue' | 'purple' | 'orange' | 'red' | 'cyan' | 'yellow'
  index?: number
}

const colorMap = {
  green: {
    bg: 'bg-primary-50',
    icon: 'text-primary-500',
    gradient: 'from-primary-500/10 to-primary-500/5',
    accent: 'bg-primary-500',
  },
  blue: {
    bg: 'bg-blue-50',
    icon: 'text-blue-500',
    gradient: 'from-blue-500/10 to-blue-500/5',
    accent: 'bg-blue-500',
  },
  purple: {
    bg: 'bg-purple-50',
    icon: 'text-purple-500',
    gradient: 'from-purple-500/10 to-purple-500/5',
    accent: 'bg-purple-500',
  },
  orange: {
    bg: 'bg-orange-50',
    icon: 'text-orange-500',
    gradient: 'from-orange-500/10 to-orange-500/5',
    accent: 'bg-orange-500',
  },
  red: {
    bg: 'bg-red-50',
    icon: 'text-red-500',
    gradient: 'from-red-500/10 to-red-500/5',
    accent: 'bg-red-500',
  },
  cyan: {
    bg: 'bg-cyan-50',
    icon: 'text-cyan-500',
    gradient: 'from-cyan-500/10 to-cyan-500/5',
    accent: 'bg-cyan-500',
  },
  yellow: {
    bg: 'bg-amber-50',
    icon: 'text-amber-500',
    gradient: 'from-amber-500/10 to-amber-500/5',
    accent: 'bg-amber-500',
  },
}

function AnimatedNumber({ value }: { value: string | number }) {
  const [display, setDisplay] = useState('0')
  const prevRef = useRef(value)

  useEffect(() => {
    const str = String(value)
    const num = parseFloat(str.replace(/[^\d.]/g, ''))
    if (isNaN(num)) {
      setDisplay(str)
      return
    }
    const suffix = str.replace(/[\d.,]/g, '').trim()
    const prefix = str.match(/^[^\d]*/)?.[0] ?? ''
    let start = 0
    const duration = 800
    const startTime = performance.now()
    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(eased * num)
      setDisplay(`${prefix}${current.toLocaleString()}${suffix ? ' ' + suffix : ''}`)
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    prevRef.current = value
  }, [value])

  return <>{display}</>
}

export default function StatCard({ label, value, change, changeType = 'neutral', icon: Icon, color, index = 0 }: StatCardProps) {
  const colors = colorMap[color]

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className="relative bg-white rounded-2xl p-5 shadow-premium hover:shadow-premium-lg transition-all duration-300 border border-surface-border/60 overflow-hidden group"
    >
      <div className={cn('absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl rounded-bl-full opacity-60 transition-opacity group-hover:opacity-100', colors.gradient)} />

      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div className={cn('p-2.5 rounded-xl', colors.bg)}>
            <Icon size={19} className={colors.icon} />
          </div>
          {change && (
            <span className={cn(
              'text-[11px] font-semibold px-2 py-0.5 rounded-full',
              changeType === 'up' && 'bg-emerald-50 text-emerald-600',
              changeType === 'down' && 'bg-red-50 text-red-600',
              changeType === 'neutral' && 'bg-gray-50 text-gray-500',
            )}>
              {change}
            </span>
          )}
        </div>
        <p className="text-2xl font-bold text-gray-800 tracking-tight">
          <AnimatedNumber value={value} />
        </p>
        <p className="text-xs text-gray-400 mt-1.5 font-medium">{label}</p>
      </div>
    </motion.div>
  )
}
