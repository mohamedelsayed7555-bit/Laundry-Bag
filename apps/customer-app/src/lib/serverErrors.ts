type Msg = { ar: string; en: string }

const MESSAGES: Record<string, Msg> = {
  not_authenticated: { ar: 'سجّل دخولك الأول', en: 'Please sign in first' },
  empty_cart: { ar: 'السلة فاضية', en: 'Your cart is empty' },
  too_many_items: { ar: 'عدد الأصناف كبير جداً', en: 'Too many different items' },
  invalid_quantity: { ar: 'كمية غير صحيحة', en: 'Invalid quantity' },
  unknown_item: { ar: 'فيه قطعة في السلة مبقتش متاحة. شيلها وجرّب تاني.', en: 'An item in your cart is no longer available. Remove it and try again.' },
  address_required: { ar: 'اختار عنوان صحيح', en: 'Select a valid address' },
  out_of_zone: { ar: 'عنوان الاستلام خارج نطاق التوصيل', en: 'Pickup address is outside our delivery zone' },
  delivery_out_of_zone: { ar: 'عنوان التسليم خارج نطاق التوصيل', en: 'Delivery address is outside our delivery zone' },
  invalid_payment_method: { ar: 'طريقة الدفع غير صحيحة', en: 'Invalid payment method' },
  invalid_schedule: { ar: 'اختار ميعاد في المستقبل', en: 'Choose a time in the future' },
  coupon_invalid: { ar: 'كود الخصم غير صالح', en: 'This coupon code is invalid' },
  coupon_expired: { ar: 'كود الخصم منتهي الصلاحية', en: 'This coupon has expired' },
  coupon_limit: { ar: 'كود الخصم نفذت مرات استخدامه', en: 'This coupon has reached its usage limit' },
  coupon_used: { ar: 'انت استخدمت الكوبون ده قبل كده', en: 'You already used this coupon' },
  offer_unavailable: { ar: 'العرض مش متاح دلوقتي', en: 'This offer is not available right now' },
  order_not_found: { ar: 'الطلب مش موجود', en: 'Order not found' },
  cannot_edit: { ar: 'الطلب مينفعش يتعدل في المرحلة دي', en: 'This order can no longer be edited' },
  cannot_cancel: { ar: 'الطلب مينفعش يتلغي في المرحلة دي', en: 'This order can no longer be cancelled' },
  invalid_duration: { ar: 'مدة الاشتراك غير صحيحة', en: 'Invalid subscription duration' },
  plan_not_found: { ar: 'الباقة مش متاحة', en: 'This plan is not available' },
  already_pending: { ar: 'عندك طلب اشتراك قيد المراجعة للباقة دي', en: 'You already have a pending request for this plan' },
  already_active: { ar: 'انت مشترك في الباقة دي بالفعل', en: 'You are already subscribed to this plan' },
}

export function serverErrorMessage(raw: string | undefined | null, isEn: boolean): string {
  const text = (raw ?? '').trim()
  const [code, arg] = text.split(':')
  if (code === 'min_items') {
    return isEn ? `Minimum order is ${arg} items` : `الحد الأدنى للطلب ${arg} قطع`
  }
  if (code === 'coupon_min') {
    return isEn ? `Minimum order for this coupon is ${arg} EGP` : `الحد الأدنى للطلب مع الكوبون ده ${arg} ج.م`
  }
  const m = MESSAGES[code]
  if (m) return isEn ? m.en : m.ar
  return isEn ? 'Something went wrong. Try again.' : 'حصلت مشكلة. جرّب تاني.'
}
