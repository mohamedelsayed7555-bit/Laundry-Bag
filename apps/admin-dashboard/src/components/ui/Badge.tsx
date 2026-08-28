import { cn } from '@/lib/utils'

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple'

const variants: Record<BadgeVariant, string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-500/15',
  warning: 'bg-amber-50 text-amber-700 ring-amber-500/15',
  danger: 'bg-red-50 text-red-700 ring-red-500/15',
  info: 'bg-blue-50 text-blue-700 ring-blue-500/15',
  neutral: 'bg-gray-50 text-gray-600 ring-gray-500/10',
  purple: 'bg-purple-50 text-purple-700 ring-purple-500/15',
}

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

export default function Badge({ children, variant = 'neutral', className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-semibold ring-1 ring-inset tracking-wide',
      variants[variant],
      className
    )}>
      {children}
    </span>
  )
}
