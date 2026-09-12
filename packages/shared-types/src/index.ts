// ── Enums & Unions ──

export type OrderStatus =
  | 'scheduled'
  | 'pending'
  | 'assigned'
  | 'arrived'
  | 'picked_up'
  | 'processing'
  | 'ready'
  | 'delivering'
  | 'delivered'
  | 'cancelled'
  | 'refunded'

export type PaymentMethod = 'cash' | 'instapay' | 'wallet'
export type PaymentStatus = 'pending' | 'confirmed' | 'refunded'
export type ServiceType = 'wash' | 'iron' | 'wash_iron' | 'dry_clean' | 'tailor' | 'carpet'
export type UserRole = 'customer' | 'driver' | 'admin'
export type UserTier = 'bronze' | 'silver' | 'gold' | 'platinum'
export type ChurnRisk = 'low' | 'medium' | 'high'
export type CustomerSegment = 'new' | 'regular' | 'vip' | 'inactive'
export type NotificationType = 'order' | 'offer' | 'reminder' | 'system'
export type SubscriptionDuration = 'monthly' | 'quarterly' | 'biannual' | 'annual'
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'expired'
export type PlanTier = 'individual' | 'couple' | 'family' | 'premium'

// ── Models ──

export interface User {
  id: string
  customer_code?: string
  branch_id: string
  name: string
  phone: string
  email?: string
  role: UserRole
  tier: UserTier
  points: number
  fcm_token?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Address {
  id: string
  user_id: string
  label: string
  lat: number
  lng: number
  building?: string
  floor?: string
  apartment?: string
  gate?: string
  landmark?: string
  notes?: string
  is_default: boolean
  created_at: string
}

export interface OrderItem {
  id: string
  service_type: ServiceType
  item_type: string
  photo_url?: string
  note?: string
  price: number
}

export interface DeliveryLocation {
  lat: number
  lng: number
  address_label?: string
  building?: string
  floor?: string
  apartment?: string
  gate?: string
  landmark?: string
  notes?: string
}

export interface Order {
  id: string
  order_number: string
  branch_id: string
  customer_id: string
  driver_id?: string
  subscription_id?: string
  status: OrderStatus
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  payment_ref?: string
  items: OrderItem[]
  items_count: number
  confirmed_count?: number
  subtotal: number
  discount: number
  total: number
  delivery_location: DeliveryLocation
  address_id?: string
  scheduled_at?: string
  label_qr_data?: string
  label_generated_at?: string
  cancellation_reason?: string
  cancelled_at?: string
  rating_service?: number
  rating_driver?: number
  rating_note?: string
  rated_at?: string
  created_at: string
  updated_at: string
}

export interface Branch {
  id: string
  name: string
  address?: string
  lat?: number
  lng?: number
  phone?: string
  is_active: boolean
  settings: Record<string, unknown>
  created_at: string
}

export interface Price {
  id: string
  item_type: string
  service_type: ServiceType
  price: number
  is_active: boolean
  updated_at: string
}

export interface Plan {
  id: string
  name: string
  description?: string
  tier: PlanTier
  items_per_month: number
  includes_all_services: boolean
  covered_services?: ServiceType[]
  monthly_price: number
  quarterly_price?: number
  biannual_price?: number
  annual_price?: number
  is_active: boolean
  created_at: string
}

export interface Subscription {
  id: string
  user_id: string
  plan_id: string
  branch_id?: string
  duration: SubscriptionDuration
  status: SubscriptionStatus
  items_used: number
  items_limit: number
  start_date: string
  end_date: string
  auto_renew: boolean
  payment_method?: string
  total_paid?: number
  cancelled_at?: string
  created_at: string
}

export interface Notification {
  id: string
  branch_id?: string
  user_id: string
  title: string
  body: string
  type: NotificationType
  data: Record<string, unknown>
  sent_at?: string
  read_at?: string
  created_at: string
}

export interface OrderStatusHistory {
  id: string
  order_id: string
  status: OrderStatus
  changed_by?: string
  note?: string
  created_at: string
}

export interface AiProfile {
  user_id: string
  avg_cycle_days?: number
  preferred_day?: number
  preferred_time?: 'morning' | 'afternoon' | 'evening'
  churn_risk: ChurnRisk
  segment: CustomerSegment
  total_orders: number
  total_spent: number
  last_offer_at?: string
  last_order_at?: string
  updated_at: string
}

export interface Setting {
  id: string
  key: string
  value: unknown
  description?: string
  updated_at: string
}

// ── API Types ──

export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  per_page: number
}

// ── Order Flow Helpers ──

export const ORDER_STATUS_FLOW: Record<OrderStatus, OrderStatus[]> = {
  scheduled: ['pending', 'cancelled'],
  pending: ['assigned', 'cancelled'],
  assigned: ['arrived', 'cancelled'],
  arrived: ['picked_up', 'cancelled'],
  picked_up: ['processing', 'cancelled'],
  processing: ['ready'],
  ready: ['delivering'],
  delivering: ['delivered'],
  delivered: [],
  cancelled: [],
  refunded: [],
}

export const CANCELLABLE_STATUSES: OrderStatus[] = ['pending', 'assigned', 'arrived', 'picked_up']

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  wash: 'غسيل',
  iron: 'كوي',
  wash_iron: 'غسيل وكوي',
  dry_clean: 'تنظيف جاف',
  tailor: 'تفصيل وتعديلات',
  carpet: 'سجاد وبطاطين',
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  scheduled: 'مجدول',
  pending: 'في الانتظار',
  assigned: 'تم التعيين',
  arrived: 'وصل السائق',
  picked_up: 'تم الاستلام',
  processing: 'جاري المعالجة',
  ready: 'جاهز',
  delivering: 'جاري التوصيل',
  delivered: 'تم التوصيل',
  cancelled: 'ملغي',
  refunded: 'مسترد',
}
