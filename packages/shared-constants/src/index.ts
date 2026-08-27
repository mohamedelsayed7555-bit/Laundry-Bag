export const APP_NAME = 'CLEANO'
export const CUSTOMER_CODE_PREFIX = 'CLN-'
export const ORDER_NUMBER_START = 1000
export const MIN_ORDER_ITEMS_DEFAULT = 4
export const DELIVERY_FEE_DEFAULT = 20

export const WORKING_HOURS = {
  from: '09:00',
  to: '22:00',
} as const

export const CHURN_THRESHOLDS = {
  low: 14,
  medium: 28,
} as const

export const SUBSCRIPTION_REMINDER_DAYS = 7

export const TIER_THRESHOLDS = {
  silver: { orders: 10, spent: 1000 },
  gold: { orders: 25, spent: 3000 },
  platinum: { orders: 50, spent: 7000 },
} as const

export const RATING_MIN = 1
export const RATING_MAX = 5

export const SUPABASE_TABLES = {
  SETTINGS: 'settings',
  BRANCHES: 'branches',
  USERS: 'users',
  ADDRESSES: 'addresses',
  PRICES: 'prices',
  PLANS: 'plans',
  SUBSCRIPTIONS: 'subscriptions',
  ORDERS: 'orders',
  ORDER_STATUS_HISTORY: 'order_status_history',
  NOTIFICATIONS: 'notifications',
  AI_PROFILES: 'ai_profiles',
} as const
