import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CLEANO - لوحة التحكم',
  description: 'لوحة تحكم إدارة خدمات الغسيل والكوي',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  )
}
