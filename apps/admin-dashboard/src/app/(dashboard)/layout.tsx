'use client'

import { useState } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import { ToastProvider } from '@/components/ui/Toast'
import { motion } from 'framer-motion'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <ToastProvider>
      <div className="min-h-screen bg-surface">
        <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed(c => !c)} />
        <div className={`${collapsed ? 'mr-[72px]' : 'mr-[260px]'} transition-all duration-300`}>
          <Header />
          <motion.main
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="p-6"
          >
            {children}
          </motion.main>
        </div>
      </div>
    </ToastProvider>
  )
}
