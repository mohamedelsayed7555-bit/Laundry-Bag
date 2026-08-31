'use client'

import { useState, Component, type ReactNode } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import { ToastProvider } from '@/components/ui/Toast'
import { AuthProvider } from '@/lib/auth-context'
import { ThemeProvider } from '@/lib/theme-context'
import { LanguageProvider } from '@/lib/language-context'
import { motion } from 'framer-motion'

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <p className="text-6xl">⚠️</p>
          <h2 className="text-xl font-bold text-gray-800">حدث خطأ غير متوقع</h2>
          <p className="text-gray-500">يرجى تحديث الصفحة أو المحاولة لاحقاً</p>
          <button onClick={() => { this.setState({ hasError: false }); window.location.reload() }}
            className="px-6 py-2.5 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 transition-colors">
            تحديث الصفحة
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
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
                  <ErrorBoundary>
                    {children}
                  </ErrorBoundary>
                </motion.main>
              </div>
            </div>
          </ToastProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  )
}
