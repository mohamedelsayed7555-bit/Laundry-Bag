'use client'

import { useState, useRef, useEffect, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface TooltipProps {
  content: string
  children: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}

export default function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!show || !triggerRef.current || !tipRef.current) return
    const tr = triggerRef.current.getBoundingClientRect()
    const tip = tipRef.current.getBoundingClientRect()
    let x = 0, y = 0

    switch (side) {
      case 'top':
        x = tr.left + tr.width / 2 - tip.width / 2
        y = tr.top - tip.height - 6
        break
      case 'bottom':
        x = tr.left + tr.width / 2 - tip.width / 2
        y = tr.bottom + 6
        break
      case 'left':
        x = tr.left - tip.width - 6
        y = tr.top + tr.height / 2 - tip.height / 2
        break
      case 'right':
        x = tr.right + 6
        y = tr.top + tr.height / 2 - tip.height / 2
        break
    }

    x = Math.max(4, Math.min(x, window.innerWidth - tip.width - 4))
    y = Math.max(4, Math.min(y, window.innerHeight - tip.height - 4))

    setPos({ x, y })
  }, [show, side])

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className={cn('inline-flex', className)}
      >
        {children}
      </div>
      {show && (
        <div
          ref={tipRef}
          className="fixed z-[9999] px-2.5 py-1.5 text-[11px] font-medium text-white bg-navy-900 rounded-lg shadow-lg pointer-events-none whitespace-nowrap"
          style={{ left: pos.x, top: pos.y }}
        >
          {content}
        </div>
      )}
    </>
  )
}
