'use client'

import { useState, createContext, useContext, useCallback, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning'

interface Toast {
  id: number
  message: string
  type: ToastType
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = nextId++
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const dismiss = (id: number) => setToasts(prev => prev.filter(t => t.id !== id))

  const icons = { success: CheckCircle, error: XCircle, warning: AlertTriangle }
  const styles = {
    success: 'bg-white border-emerald-200/80 text-gray-800',
    error: 'bg-white border-red-200/80 text-gray-800',
    warning: 'bg-white border-amber-200/80 text-gray-800',
  }
  const iconColors = { success: 'text-emerald-500', error: 'text-red-500', warning: 'text-amber-500' }
  const accentLine = { success: 'bg-emerald-500', error: 'bg-red-500', warning: 'bg-amber-500' }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 left-4 z-[200] flex flex-col gap-2 max-w-sm">
        <AnimatePresence>
          {toasts.map(t => {
            const Icon = icons[t.type]
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: -30, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.95 }}
                transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
                className={`relative flex items-center gap-3 p-4 rounded-xl border shadow-premium-lg overflow-hidden ${styles[t.type]}`}
              >
                <div className={`absolute right-0 top-0 bottom-0 w-1 ${accentLine[t.type]}`} />
                <Icon size={18} className={iconColors[t.type]} />
                <span className="text-sm font-medium flex-1">{t.message}</span>
                <button onClick={() => dismiss(t.id)} className="opacity-40 hover:opacity-100 transition-opacity"><X size={14} /></button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
