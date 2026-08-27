import type { OrderStatus, OrderItem, ServiceType } from '@cleano/shared-types'
import { ORDER_STATUS_FLOW, CANCELLABLE_STATUSES } from '@cleano/shared-types'
import { MIN_ORDER_ITEMS_DEFAULT } from '@cleano/shared-constants'

export function canTransitionTo(current: OrderStatus, next: OrderStatus): boolean {
  return ORDER_STATUS_FLOW[current]?.includes(next) ?? false
}

export function canCancelOrder(status: OrderStatus): boolean {
  return CANCELLABLE_STATUSES.includes(status)
}

export function calculateOrderTotal(items: OrderItem[], discount = 0): {
  subtotal: number
  discount: number
  total: number
} {
  const subtotal = items.reduce((sum, item) => sum + item.price, 0)
  return {
    subtotal,
    discount,
    total: Math.max(0, subtotal - discount),
  }
}

export function isMinimumItemsMet(
  itemsCount: number,
  minItems = MIN_ORDER_ITEMS_DEFAULT,
): boolean {
  return itemsCount >= minItems
}

export function formatCustomerCode(num: number): string {
  return `CLN-${String(num).padStart(5, '0')}`
}

export function formatOrderNumber(num: number): string {
  return `#${String(num).padStart(4, '0')}`
}

export function formatPrice(amount: number): string {
  return `${amount.toFixed(2)} ج.م`
}

export function getServiceLabel(type: ServiceType): string {
  const labels: Record<ServiceType, string> = {
    wash: 'غسيل',
    iron: 'كوي',
    wash_iron: 'غسيل وكوي',
    dry_clean: 'تنظيف جاف',
  }
  return labels[type]
}

export function generateQRData(orderNumber: string, customerCode: string): string {
  return JSON.stringify({ order: orderNumber, customer: customerCode })
}

export function daysSinceLastOrder(lastOrderAt: string | null): number | null {
  if (!lastOrderAt) return null
  const diff = Date.now() - new Date(lastOrderAt).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}
