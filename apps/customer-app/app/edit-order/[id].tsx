import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useAuth } from '../../src/contexts/AuthContext'
import { useCustomAlert } from '../../src/components/CustomAlert'
import { supabase } from '../../src/lib/supabase'
import { useTheme } from '../../src/contexts/ThemeContext'
import { useLanguage } from '../../src/contexts/LanguageContext'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!

const servicesMap = [
  { key: 'wash', icon: '👔', label: 'غسيل', labelEn: 'Wash' },
  { key: 'dry_clean', icon: '🧹', label: 'تنظيف جاف', labelEn: 'Dry Clean' },
  { key: 'iron', icon: '👕', label: 'كي فقط', labelEn: 'Iron Only' },
  { key: 'wash_iron', icon: '✨', label: 'غسيل وكي', labelEn: 'Wash & Iron' },
  { key: 'tailor', icon: '✂️', label: 'تفصيل وتعديلات', labelEn: 'Tailoring' },
]

type OrderItem = { name: string; service_type: string; quantity: number; price: number }

export default function EditOrderScreen() {
  const { colors } = useTheme()
  const { t, locale } = useLanguage()
  const isEn = locale === 'en'
  const s = getStyles(colors)
  const { id } = useLocalSearchParams<{ id: string }>()
  const { profile } = useAuth()
  const router = useRouter()
  const { showAlert, AlertComponent } = useCustomAlert()
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [cart, setCart] = useState<OrderItem[]>([])
  const [prices, setPrices] = useState<any[]>([])
  const [itemTypes, setItemTypes] = useState<string[]>([])
  const [selectedItemType, setSelectedItemType] = useState('')
  const [selectedService, setSelectedService] = useState('')
  const [itemQty, setItemQty] = useState(1)

  useEffect(() => {
    loadData()
  }, [id])

  async function loadData() {
    const [orderRes, pricesRes] = await Promise.all([
      supabase.from('orders').select('id, order_number, status, items, items_count, subtotal, total, delivery_fee, subscription_id, service_type, payment_method, payment_status').eq('id', id).eq('customer_id', profile!.id).single(),
      supabase.from('prices').select('id, item_type, service_type, price').eq('is_active', true).limit(200),
    ])

    if (orderRes.data) {
      setOrder(orderRes.data)
      setCart(orderRes.data.items ?? [])
    }
    if (pricesRes.data) {
      setPrices(pricesRes.data)
      setItemTypes([...new Set(pricesRes.data.map((p: any) => p.item_type))] as string[])
    }
    setLoading(false)
  }

  const getPrice = (itemType: string, serviceType: string) => {
    return prices.find(p => p.item_type === itemType && p.service_type === serviceType)?.price ?? 0
  }

  const availableServices = () => {
    if (!selectedItemType) return []
    return servicesMap.filter(s => prices.some(p => p.item_type === selectedItemType && p.service_type === s.key))
  }

  const serviceLabel = (key: string) => {
    const svc = servicesMap.find(s => s.key === key)
    return svc ? (isEn ? svc.labelEn : svc.label) : key
  }
  const itemName = (name: string) => isEn ? (t(`item:${name}`) !== `item:${name}` ? t(`item:${name}`) : name) : name

  const addToCart = () => {
    if (!selectedItemType || !selectedService) return
    const unitPrice = getPrice(selectedItemType, selectedService)
    if (unitPrice === 0) return

    const existing = cart.findIndex(c => c.name === selectedItemType && c.service_type === selectedService)
    if (existing >= 0) {
      const updated = [...cart]
      updated[existing] = { ...updated[existing], quantity: updated[existing].quantity + itemQty }
      setCart(updated)
    } else {
      setCart([...cart, { name: selectedItemType, service_type: selectedService, quantity: itemQty, price: unitPrice }])
    }
    setSelectedItemType('')
    setSelectedService('')
    setItemQty(1)
  }

  const removeFromCart = (index: number) => setCart(cart.filter((_, i) => i !== index))

  const updateQty = (index: number, delta: number) => {
    setCart(prev => prev.map((item, i) => {
      if (i !== index) return item
      const newQty = item.quantity + delta
      return newQty < 1 ? item : { ...item, quantity: newQty }
    }))
  }

  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0)

  const fee = order ? (order.delivery_fee ?? 0) : 0
  const isSubOrder = !!order?.subscription_id
  const oldTotal = order?.total ?? 0
  const newTotal = isSubOrder ? 0 : totalPrice + fee
  const priceDiff = newTotal - oldTotal

  async function handleSave() {
    if (cart.length === 0) { showAlert({ title: isEn ? 'Notice' : 'تنبيه', message: isEn ? 'Add at least one item' : 'أضف قطعة واحدة على الأقل', type: 'warning' }); return }

    // If subscription order, check quota — allow partial overflow
    if (isSubOrder) {
      const { data: sub } = await supabase.from('subscriptions').select('items_used, items_limit').eq('id', order.subscription_id).single()
      if (sub) {
        const oldItems = order.items_count ?? 0
        const available = sub.items_limit - sub.items_used + oldItems
        if (totalItems > available) {
          const overflow = totalItems - available
          const overflowPrice = cart.slice().reverse().reduce((acc: { remaining: number; total: number }, item) => {
            if (acc.remaining <= 0) return acc
            const take = Math.min(item.quantity, acc.remaining)
            return { remaining: acc.remaining - take, total: acc.total + take * item.price }
          }, { remaining: overflow, total: 0 }).total
          showAlert({
            title: isEn ? 'Plan limit exceeded' : 'تجاوز رصيد الباقة',
            message: isEn
              ? `Your plan covers ${available} items. The extra ${overflow} items (${overflowPrice.toFixed(2)} EGP) will be charged separately. Continue?`
              : `باقتك تغطي ${available} قطعة. الزيادة ${overflow} قطعة (${overflowPrice.toFixed(2)} ج.م) هتتحاسب منفصلة. متأكد؟`,
            type: 'warning',
            buttons: [
              { text: isEn ? 'Cancel' : 'إلغاء', style: 'cancel' },
              { text: isEn ? 'Continue' : 'متابعة', onPress: () => doSave(available, overflow, overflowPrice) },
            ],
          })
          return
        }
      }
    }

    // For regular orders with price increase, confirm the difference
    if (!isSubOrder && priceDiff > 0 && order.payment_status === 'confirmed') {
      showAlert({
        title: isEn ? 'Additional payment required' : 'مطلوب دفع إضافي',
        message: isEn
          ? `The new total is ${newTotal.toFixed(2)} EGP (was ${oldTotal.toFixed(2)} EGP). You'll need to pay the difference of ${priceDiff.toFixed(2)} EGP. Continue?`
          : `الإجمالي الجديد ${newTotal.toFixed(2)} ج.م (كان ${oldTotal.toFixed(2)} ج.م). محتاج تدفع الفرق ${priceDiff.toFixed(2)} ج.م. متأكد؟`,
        type: 'warning',
        buttons: [
          { text: isEn ? 'Cancel' : 'إلغاء', style: 'cancel' },
          { text: isEn ? 'Continue' : 'متابعة', onPress: () => doSave() },
        ],
      })
      return
    }

    doSave()
  }

  async function doSave(subAvailable?: number, overflow?: number, overflowPrice?: number) {
    setSaving(true)

    const hasOverflow = overflow && overflow > 0
    const finalTotal = isSubOrder ? (hasOverflow ? (overflowPrice ?? 0) + fee : 0) : totalPrice + fee
    const needsPayment = !isSubOrder && finalTotal > oldTotal && order.payment_status === 'confirmed'
    const subOverflowNeedsPayment = isSubOrder && hasOverflow

    const updateData: any = {
      items: cart,
      items_count: totalItems,
      subtotal: totalPrice,
      total: finalTotal,
      service_type: [...new Set(cart.map(i => i.service_type))].join('+'),
    }

    if (needsPayment) {
      updateData.payment_status = 'pending'
      updateData.price_difference = priceDiff
    }

    if (subOverflowNeedsPayment) {
      updateData.payment_status = 'pending'
      updateData.price_difference = overflowPrice
      updateData.order_type = 'mixed'
    }

    const { error } = await supabase.from('orders').update(updateData).eq('id', id).eq('customer_id', profile!.id)

    // Update subscription items_used
    if (!error && isSubOrder) {
      const oldItems = order.items_count ?? 0
      const actualDeduct = hasOverflow ? (subAvailable ?? totalItems) : totalItems
      const diff = actualDeduct - oldItems
      if (diff !== 0) {
        const { data: subData } = await supabase.from('subscriptions').select('items_used').eq('id', order.subscription_id).single()
        if (subData) {
          const currentUsed = subData.items_used ?? 0
          await supabase.from('subscriptions').update({ items_used: currentUsed + diff }).eq('id', order.subscription_id).eq('items_used', currentUsed)
        }
      }
    }

    if (error) {
      setSaving(false)
      showAlert({ title: isEn ? 'Error' : 'خطأ', message: isEn ? 'Failed to update order' : 'حدث خطأ أثناء تعديل الطلب', type: 'error' })
      return
    }

    const amountToPay = needsPayment ? priceDiff : subOverflowNeedsPayment ? (overflowPrice ?? 0) : 0
    const isOnlineMethod = ['visa', 'e_wallet', 'wallet'].includes(order.payment_method)

    // If online payment and there's a difference to pay, open payment gateway
    if (amountToPay > 0 && isOnlineMethod) {
      try {
        const session = (await supabase.auth.getSession()).data.session
        const res = await fetch(`${SUPABASE_URL}/functions/v1/paymob-pay`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            order_id: id,
            amount_override: amountToPay,
            payment_method: order.payment_method === 'visa' ? 'card' : 'wallet',
            ...(order.payment_method === 'e_wallet' ? { wallet_phone: order.wallet_phone } : {}),
          }),
        })
        const paymentData = await res.json()
        setSaving(false)
        if (paymentData.iframe_url) {
          router.push({ pathname: '/payment', params: { url: paymentData.iframe_url } })
        } else if (paymentData.error) {
          showAlert({ title: isEn ? 'Error' : 'خطأ', message: paymentData.error, type: 'error', onConfirm: () => router.back() })
        }
      } catch (e) {
        setSaving(false)
        showAlert({ title: isEn ? 'Error' : 'خطأ', message: isEn ? 'Payment service error' : 'خطأ في خدمة الدفع', type: 'error', onConfirm: () => router.back() })
      }
      return
    }

    setSaving(false)
    const diffMsg = amountToPay > 0
      ? (isEn ? `\nAdditional ${amountToPay.toFixed(2)} EGP will be collected on delivery` : `\nسيتم تحصيل ${amountToPay.toFixed(2)} ج.م إضافي عند الاستلام`)
      : ''
    showAlert({ title: isEn ? 'Done' : 'تم', message: (isEn ? 'Order updated successfully' : 'تم تعديل الطلب بنجاح') + diffMsg, type: 'success', buttons: [
      { text: isEn ? 'OK' : 'حسناً', onPress: () => router.back() },
    ] })
  }

  if (loading) {
    return <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color={colors.primary} /></View>
  }

  const isPaidOnline = order && ['visa', 'e_wallet', 'wallet'].includes(order.payment_method) && order.payment_status === 'confirmed'

  if (!order || !['pending', 'assigned'].includes(order.status) || isPaidOnline) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center', padding: 40 }]}>
        <Text style={{ fontSize: 40, marginBottom: 16 }}>⚠️</Text>
        <Text style={{ color: '#fff', fontSize: 16, textAlign: 'center' }}>
          {isPaidOnline ? (isEn ? 'Cannot edit a paid order — contact support' : 'لا يمكن تعديل طلب مدفوع إلكترونياً — تواصل مع الدعم') : (isEn ? 'This order cannot be edited' : 'لا يمكن تعديل هذا الطلب')}
        </Text>
        <TouchableOpacity style={s.backBtnAlt} onPress={() => router.back()}>
          <Text style={{ color: colors.primary, fontSize: 15, fontWeight: '600' }}>{isEn ? 'Back' : 'رجوع'}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <>
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <View style={s.headerRow}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.backText}>{isEn ? '← Back' : 'رجوع ←'}</Text>
        </TouchableOpacity>
        <Text style={s.title}>{isEn ? 'Edit Order' : 'تعديل الطلب'}</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={s.orderBadge}>
        <Text style={s.orderNumber}>{order.order_number}</Text>
      </View>

      {/* Current items */}
      <Text style={s.sectionTitle}>{isEn ? `Items (${totalItems})` : `القطع (${totalItems})`}</Text>
      {cart.map((item, i) => (
        <View key={i} style={s.cartItem}>
          <View style={{ flex: 1 }}>
            <Text style={s.cartItemName}>{itemName(item.name)} — {serviceLabel(item.service_type)}</Text>
            <Text style={s.cartItemDetail}>{item.quantity} × {item.price} = {item.quantity * item.price} {isEn ? 'EGP' : 'ج.م'}</Text>
          </View>
          <View style={s.qtyActions}>
            <TouchableOpacity style={s.qtyBtn} onPress={() => updateQty(i, -1)}>
              <Text style={s.qtyBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={s.qtyValue}>{item.quantity}</Text>
            <TouchableOpacity style={s.qtyBtn} onPress={() => updateQty(i, 1)}>
              <Text style={s.qtyBtnText}>+</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => removeFromCart(i)} style={s.removeBtn}>
            <Text style={s.removeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* Add new item */}
      <Text style={s.sectionTitle}>{isEn ? 'Add New Item' : 'إضافة قطعة جديدة'}</Text>
      <Text style={s.stepLabel}>{isEn ? 'Item Type' : 'نوع القطعة'}</Text>
      <View style={s.grid}>
        {itemTypes.map(type => (
          <TouchableOpacity key={type} onPress={() => { setSelectedItemType(type); setSelectedService('') }}
            style={[s.optionCard, selectedItemType === type && s.optionSelected]}>
            <Text style={[s.optionLabel, selectedItemType === type && s.optionLabelSelected]}>{itemName(type)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {selectedItemType ? (
        <>
          <Text style={s.stepLabel}>{isEn ? 'Service Type' : 'نوع الخدمة'}</Text>
          <View style={s.grid}>
            {availableServices().map(svc => (
              <TouchableOpacity key={svc.key} onPress={() => setSelectedService(svc.key)}
                style={[s.optionCard, selectedService === svc.key && s.optionSelected]}>
                <Text style={s.optionIcon}>{svc.icon}</Text>
                <Text style={[s.optionLabel, selectedService === svc.key && s.optionLabelSelected]}>{isEn ? svc.labelEn : svc.label}</Text>
                <Text style={s.priceHint}>{getPrice(selectedItemType, svc.key)} {isEn ? 'EGP' : 'ج.م'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : null}

      {selectedService ? (
        <View style={s.addRow}>
          <View style={s.counterRow}>
            <TouchableOpacity style={s.counterBtn} onPress={() => setItemQty(itemQty + 1)}>
              <Text style={s.counterText}>+</Text>
            </TouchableOpacity>
            <Text style={s.counterValue}>{itemQty}</Text>
            <TouchableOpacity style={s.counterBtn} onPress={() => setItemQty(Math.max(1, itemQty - 1))}>
              <Text style={s.counterText}>−</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={addToCart}>
            <Text style={s.addBtnText}>{isEn ? '+ Add' : '+ أضف'}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Total */}
      <View style={s.totalCard}>
        <View>
          <Text style={s.totalLabel}>{isEn ? 'Total' : 'الإجمالي'}</Text>
          {!isSubOrder && priceDiff !== 0 && (
            <Text style={[s.totalLabel, { fontSize: 12, marginTop: 4 }]}>
              {isEn ? `Was: ${oldTotal.toFixed(2)} EGP` : `كان: ${oldTotal.toFixed(2)} ج.م`}
            </Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.totalValue}>
            {isSubOrder ? (isEn ? 'Free (Plan)' : 'مجاناً (باقة)') : `${newTotal.toFixed(2)} ${isEn ? 'EGP' : 'ج.م'}`}
          </Text>
          {!isSubOrder && priceDiff > 0 && (
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#ef4444', marginTop: 2 }}>
              {isEn ? `+${priceDiff.toFixed(2)} EGP difference` : `+${priceDiff.toFixed(2)} ج.م فرق`}
            </Text>
          )}
          {!isSubOrder && priceDiff < 0 && (
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#10b981', marginTop: 2 }}>
              {isEn ? `${priceDiff.toFixed(2)} EGP refund` : `${priceDiff.toFixed(2)} ج.م استرداد`}
            </Text>
          )}
        </View>
      </View>

      <TouchableOpacity
        style={[s.saveBtn, (saving || cart.length === 0) && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving || cart.length === 0}
      >
        <Text style={s.saveBtnText}>{saving ? (isEn ? 'Saving...' : 'جاري الحفظ...') : (isEn ? 'Save Changes' : 'حفظ التعديلات')}</Text>
      </TouchableOpacity>
    </ScrollView>
    {AlertComponent}
    </>
  )
}

function getStyles(colors: any) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900] },
  content: { padding: 20, paddingTop: 56, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  backText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: 'bold', color: colors.text },
  orderBadge: { alignSelf: 'center', backgroundColor: colors.navy[800], borderRadius: 12, paddingHorizontal: 20, paddingVertical: 8, marginBottom: 20, borderWidth: 1, borderColor: colors.navy[700] },
  orderNumber: { fontSize: 16, fontWeight: '700', color: colors.text },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12, marginTop: 20 },
  stepLabel: { fontSize: 13, fontWeight: '600', color: colors.navy[200], marginBottom: 8, marginTop: 12 },

  cartItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.navy[800],
    borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.navy[700],
  },
  cartItemName: { fontSize: 14, fontWeight: '600', color: colors.text },
  cartItemDetail: { fontSize: 12, color: colors.navy[300], marginTop: 2 },
  qtyActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 8 },
  qtyBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.navy[700], justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  qtyValue: { color: colors.text, fontSize: 16, fontWeight: '700', minWidth: 24, textAlign: 'center' },
  removeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.navy[700], justifyContent: 'center', alignItems: 'center' },
  removeBtnText: { color: '#ef4444', fontSize: 14, fontWeight: '700' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  optionCard: {
    minWidth: '30%', backgroundColor: colors.navy[800], borderRadius: 16, padding: 14,
    alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: colors.navy[700],
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '15' },
  optionIcon: { fontSize: 24 },
  optionLabel: { fontSize: 13, fontWeight: '600', color: colors.navy[200], textAlign: 'center' },
  optionLabelSelected: { color: colors.primary },
  priceHint: { fontSize: 11, color: colors.navy[300], marginTop: 2 },

  addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, gap: 12 },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  counterBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.navy[800],
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.navy[700],
  },
  counterText: { fontSize: 20, color: '#fff', fontWeight: '600' },
  counterValue: { fontSize: 24, fontWeight: 'bold', color: colors.text, minWidth: 32, textAlign: 'center' },
  addBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  totalCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.navy[800], borderRadius: 16, padding: 20, marginTop: 24,
    borderWidth: 1, borderColor: colors.navy[700],
  },
  totalLabel: { fontSize: 16, color: colors.navy[200] },
  totalValue: { fontSize: 22, fontWeight: 'bold', color: colors.primary },

  saveBtn: {
    backgroundColor: colors.primary, borderRadius: 16, padding: 18, alignItems: 'center', marginTop: 20,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  saveBtnText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  backBtnAlt: { marginTop: 24, padding: 12 },
}) }
