'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Inbox, ChevronRight, ChevronLeft } from 'lucide-react'
import Tooltip from '@/components/ui/Tooltip'

interface Column<T> {
  key: string
  label: string
  render?: (item: T) => React.ReactNode
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  emptyMessage?: string
  pageSize?: number
}

export default function DataTable<T extends Record<string, any>>({
  columns,
  data,
  emptyMessage = 'لا توجد بيانات',
  pageSize = 10,
}: DataTableProps<T>) {
  const [page, setPage] = useState(0)
  const totalPages = Math.ceil(data.length / pageSize)
  const paged = data.slice(page * pageSize, (page + 1) * pageSize)

  const canPrev = page > 0
  const canNext = page < totalPages - 1

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="bg-white rounded-2xl shadow-premium border border-surface-border/60 overflow-hidden"
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-navy-900/[0.04] border-b-2 border-navy-900/10">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-5 py-4 text-xs font-bold text-navy-900/70 text-right tracking-wide',
                    col.className
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border/40">
            {paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-surface-muted flex items-center justify-center">
                      <Inbox size={22} className="text-gray-300" />
                    </div>
                    <p className="text-sm text-gray-400">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              paged.map((item, i) => (
                <motion.tr
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.3) }}
                  className="group hover:bg-surface-muted/50 transition-colors duration-150"
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-5 py-3.5 text-sm text-gray-700', col.className)}>
                      {col.render ? col.render(item) : item[col.key]}
                    </td>
                  ))}
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-surface-border/60">
          <span className="text-xs text-gray-400">
            عرض {page * pageSize + 1}–{Math.min((page + 1) * pageSize, data.length)} من {data.length}
          </span>
          <div className="flex items-center gap-1">
            <Tooltip content="الصفحة السابقة">
              <button
                onClick={() => setPage(p => p - 1)}
                disabled={!canPrev}
                className={cn(
                  'w-8 h-8 flex items-center justify-center rounded-lg transition-all text-sm',
                  canPrev ? 'hover:bg-surface-muted text-gray-600' : 'text-gray-300 cursor-not-allowed'
                )}
              >
                <ChevronRight size={16} />
              </button>
            </Tooltip>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={cn(
                  'w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-all',
                  page === i
                    ? 'bg-navy-900 text-white shadow-premium-md'
                    : 'hover:bg-surface-muted text-gray-500'
                )}
              >
                {i + 1}
              </button>
            ))}
            <Tooltip content="الصفحة التالية">
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={!canNext}
                className={cn(
                  'w-8 h-8 flex items-center justify-center rounded-lg transition-all text-sm',
                  canNext ? 'hover:bg-surface-muted text-gray-600' : 'text-gray-300 cursor-not-allowed'
                )}
              >
                <ChevronLeft size={16} />
              </button>
            </Tooltip>
          </div>
        </div>
      )}
    </motion.div>
  )
}
