import { useState, useEffect, useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TriangleAlert, Shirt, Plus, Minus, Check } from 'lucide-react-native'
import { useBrand, Card, Chip, Stepper, IconButton, BackIcon, FlowLines, money, F, SIZE, HIT } from '../../src/components/brand'
import { PrimaryButton, SecondaryButton } from '../../src/components/auth/ui'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useAuth } from '../../src/contexts/AuthContext'
import { useCustomAlert } from '../../src/components/CustomAlert'
import { supabase } from '../../src/lib/supabase'
import { serverErrorMessage } from '../../src/lib/serverErrors'
import { useLanguage } from '../../src/contexts/LanguageContext'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://kjqtrmedkvqfofwymoni.supabase.co'

const servicesMap = [
  { key: 'wash', label: 'غسيل', labelEn: 'Wash' },
  { key: 'dry_clean', label: 'تنظيف جاف', labelEn: 'Dry Clean' },
  { key: 'iron', label: 'كي فقط', labelEn: 'Iron Only' },
  { key: 'wash_iron', label: 'غسيل وكي', labelEn: 'Wash & Iron' },
  { key: 'housekeeping', label: 'تنظيف منازل', labelEn: 'House Keeping' },
  { key: 'carpet', label: 'سجاد وبطاطين', labelEn: 'Carpets & Blankets' },
  { key: 'accessories', label: 'منتجات وإكسسوارات', labelEn: 'Accessories & Products' },
]

const SERVICE_IMG: Record<string, any> = {
  wash: require('../../assets/services/wash.webp'),
  dry_clean: require('../../assets/services/dry.webp'),
  iron: require('../../assets/services/iron.webp'),
  wash_iron: require('../../assets/services/washiron.webp'),
  housekeeping: require('../../assets/services/home.webp'),
  carpet: require('../../assets/services/carpet.webp'),
  accessories: require('../../assets/services/shop.webp'),
}

type OrderItem = { name: string; service_type: string; quantity: number; price: number }

export default function EditOrderScreen() {
  const b = useBrand()
  const insets = useSafeAreaInsets()
  const { t, locale } = useLanguage()
  const isEn = locale === 'en'
  const { id } = useLocalSearchParams<{ id: string }>()
  const { profile } = useAuth()
  const router = useRouter()
  const { showAlert, AlertComponent } = useCustomAlert()
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [cart, setCart] = useState<OrderItem[]>([])
  const [prices, setPrices] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [selectedService, setSelectedService] = useState('')
  const [activeCatId, setActiveCatId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [id])

  async function loadData() {
    const [orderRes, pricesRes, catsRes] = await Promise.all([
      supabase.from('orders').select('id, order_number, status, items, items_count, subtotal, total, discount, delivery_fee, subscription_id, service_type, payment_method, payment_status').eq('id', id).eq('customer_id', profile!.id).single(),
      supabase.from('prices').select('id, item_type, service_type, price, category_id').eq('is_active', true).limit(200),
      supabase.from('categories').select('id, name, icon, sort_order').eq('is_active', true).order('sort_order'),
    ])

    if (orderRes.data) {
      setOrder(orderRes.data)
      setCart(orderRes.data.items ?? [])
      // Start on the order's own service so its items are front and centre.
      const svc = orderRes.data.service_type || (orderRes.data.items ?? [])[0]?.service_type || ''
      if (svc) setSelectedService(svc)
    }
    if (pricesRes.data) setPrices(pricesRes.data)
    if (catsRes.data) setCategories(catsRes.data)
    setLoading(false)
  }

  const getPrice = (itemType: string, serviceType: string) => {
    return prices.find(p => p.item_type === itemType && p.service_type === serviceType)?.price ?? 0
  }

  // Services that actually have prices, and the categories/items for the chosen service —
  // mirrors the new-order screen so editing feels like the same flow.
  const availableServicesForScreen = useMemo(() => {
    const keys = new Set(prices.map(p => p.service_type))
    return servicesMap.filter(s => keys.has(s.key))
  }, [prices])

  const categoriesWithItems = useMemo(() => {
    if (!selectedService) return [] as { id: string; name: string; icon: string | null; itemTypes: string[] }[]
    return categories
      .map(cat => ({
        id: cat.id as string,
        name: cat.name as string,
        icon: (cat.icon ?? null) as string | null,
        itemTypes: [...new Set(prices.filter(p => p.category_id === cat.id && p.service_type === selectedService).map((p: any) => p.item_type))] as string[],
      }))
      .filter(c => c.itemTypes.length > 0)
  }, [selectedService, categories, prices])

  useEffect(() => {
    if (categoriesWithItems.length === 0) { setActiveCatId(null); return }
    setActiveCatId(prev => (prev && categoriesWithItems.some(c => c.id === prev)) ? prev : categoriesWithItems[0].id)
  }, [categoriesWithItems])

  const serviceLabel = (key: string) => {
    const svc = servicesMap.find(s => s.key === key)
    return svc ? (isEn ? svc.labelEn : svc.label) : key
  }
  const itemName = (name: string) => isEn ? (t(`item:${name}`) !== `item:${name}` ? t(`item:${name}`) : name) : name

  const addItemInline = (itemType: string) => {
    const unitPrice = getPrice(itemType, selectedService)
    if (!selectedService || unitPrice === 0) return
    setCart(prev => {
      const existing = prev.findIndex(c => c.name === itemType && c.service_type === selectedService)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = { ...updated[existing], quantity: updated[existing].quantity + 1 }
        return updated
      }
      return [...prev, { name: itemType, service_type: selectedService, quantity: 1, price: unitPrice }]
    })
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
  const newTotal = isSubOrder ? 0 : Math.max(0, totalPrice + fee - Number(order?.discount ?? 0))
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
              { text: isEn ? 'Continue' : 'متابعة', onPress: () => doSave() },
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

  async function doSave() {
    setSaving(true)

    // The server re-prices the items, adjusts the plan balance and works out any amount still due.
    const { data: result, error } = await supabase.rpc('edit_order_items', {
      p_order_id: id,
      p_items: cart.map(i => ({ name: i.name, service_type: i.service_type, quantity: i.quantity })),
    })

    if (error || !result) {
      setSaving(false)
      showAlert({ title: isEn ? 'Error' : 'خطأ', message: serverErrorMessage(error?.message, isEn), type: 'error' })
      return
    }

    const amountToPay = Number(result.amount_to_pay ?? 0)
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
            payment_method: order.payment_method === 'visa' ? 'card' : 'wallet',
            ...(order.payment_method === 'e_wallet' ? { wallet_phone: order.wallet_phone } : {}),
          }),
        })
        const paymentData = await res.json()
        setSaving(false)
        if (paymentData.iframe_url) {
          router.push({ pathname: '/payment', params: { url: paymentData.iframe_url, kind: 'order', id } })
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
    return <View style={[n.container, { backgroundColor: b.page, justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color={b.primary} /></View>
  }

  const isPaidOnline = order && ['visa', 'e_wallet', 'wallet'].includes(order.payment_method) && order.payment_status === 'confirmed'

  if (!order || !['pending', 'assigned'].includes(order.status) || isPaidOnline) {
    return (
      <View style={[n.container, { backgroundColor: b.page, justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
        <View style={[n.blockIcon, { backgroundColor: b.warnTint }]}>
          <TriangleAlert size={30} color={b.warnText} />
        </View>
        <Text style={[n.blockText, { color: b.ink }]}>
          {isPaidOnline ? (isEn ? 'Cannot edit a paid order — contact support' : 'لا يمكن تعديل طلب مدفوع إلكترونياً — تواصل مع الدعم') : (isEn ? 'This order cannot be edited' : 'لا يمكن تعديل هذا الطلب')}
        </Text>
        <SecondaryButton title={isEn ? 'Back' : 'رجوع'} onPress={() => router.back()} style={{ alignSelf: 'stretch', marginTop: 18 }} />
      </View>
    )
  }

  const cur = isEn ? 'EGP' : 'ج.م'

  return (
    <>
    <View style={[n.container, { backgroundColor: b.page }]}>
      <ScrollView contentContainerStyle={[n.content, { paddingTop: insets.top + 10 }]} keyboardShouldPersistTaps="handled">
        <FlowLines height={260} />

        <View style={n.header}>
          <IconButton onPress={() => router.back()} label={isEn ? 'Back' : 'رجوع'}><BackIcon color={b.ink} /></IconButton>
          <Text style={[n.title, { color: b.ink }]} numberOfLines={1}>{isEn ? 'Edit Order' : 'تعديل الطلب'}</Text>
          <View style={[n.numPill, { backgroundColor: b.tint }]}>
            <Text style={[n.numPillText, { color: b.tintText }]}>{'⁦'}#{String(order.order_number ?? '').replace(/^#+/, '')}{'⁩'}</Text>
          </View>
        </View>

        {/* Current items */}
        <Card style={n.card}>
          <Text style={[n.eyebrow, { color: b.muted }]}>{isEn ? `Items (${totalItems})` : `القطع (${totalItems})`}</Text>
          {cart.map((item, i) => (
            <View key={i} style={[n.item, i > 0 && { borderTopWidth: 1, borderTopColor: b.divider }]}>
              <View style={[n.thumb, { backgroundColor: b.iconTile }]}><Shirt size={18} color={b.accentIcon} /></View>
              <View style={n.itemInfo}>
                <Text style={[n.itemName, { color: b.ink }]} numberOfLines={1}>{itemName(item.name)} — {serviceLabel(item.service_type)}</Text>
                <Text style={[n.itemSub, { color: b.muted }]}>{item.quantity} × {money(item.price)} = {money(item.quantity * item.price)} {cur}</Text>
              </View>
              <Stepper
                qty={item.quantity}
                onMinus={() => updateQty(i, -1)}
                onPlus={() => updateQty(i, 1)}
                onRemove={() => removeFromCart(i)}
              />
            </View>
          ))}
        </Card>

        {/* Service type */}
        <View style={n.secRow}>
          <View style={[n.secDot, { backgroundColor: b.primary }]} />
          <Text style={[n.secTitle, { color: b.ink }]}>{isEn ? 'Service type' : 'نوع الخدمة'}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={n.bleed} contentContainerStyle={n.svcRow}>
          {availableServicesForScreen.map(svc => {
            const on = selectedService === svc.key
            const name = isEn ? svc.labelEn : svc.label
            return (
              <TouchableOpacity
                key={svc.key}
                onPress={() => setSelectedService(svc.key)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={name}
                style={n.svcCol}
              >
                <View style={[n.svcPhoto, { borderColor: on ? b.primary : 'transparent', backgroundColor: b.iconTile }]}>
                  {SERVICE_IMG[svc.key] ? <Image source={SERVICE_IMG[svc.key]} style={n.svcImg} resizeMode="cover" /> : null}
                </View>
                {on ? (
                  <View style={[n.svcCheck, { backgroundColor: b.primary, borderColor: b.page }]}>
                    <Check size={11} color="#fff" />
                  </View>
                ) : null}
                <Text style={[n.svcName, { color: on ? b.primary : b.ink2 }]} numberOfLines={2}>{name}</Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>

        {/* Choose item */}
        {selectedService && categoriesWithItems.length > 0 && (
          <>
            <View style={n.secRow}>
              <View style={[n.secDot, { backgroundColor: b.primary }]} />
              <Text style={[n.secTitle, { color: b.ink }]}>{isEn ? 'Choose item' : 'اختر القطعة'}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={n.bleed} contentContainerStyle={n.catRow}>
              {categoriesWithItems.map(cat => (
                <Chip
                  key={cat.id}
                  label={cat.name}
                  active={activeCatId === cat.id}
                  onPress={() => setActiveCatId(cat.id)}
                  icon={cat.icon ? <Text style={n.catEmoji}>{cat.icon}</Text> : undefined}
                />
              ))}
            </ScrollView>
            {categoriesWithItems.filter(cat => cat.id === activeCatId).map(cat => (
              <Card key={cat.id} pad={false} style={n.itemsCard}>
                {cat.itemTypes.map((itemType, idx) => {
                  const price = getPrice(itemType, selectedService)
                  const inCartIdx = cart.findIndex(c => c.name === itemType && c.service_type === selectedService)
                  const inCart = inCartIdx >= 0 ? cart[inCartIdx] : null
                  return (
                    <View key={itemType} style={[n.pickRow, idx > 0 && { borderTopWidth: 1, borderTopColor: b.divider }, inCart ? { backgroundColor: b.isDark ? 'rgba(14,165,233,0.08)' : '#F0F8FF' } : null]}>
                      <View style={n.pickBody}>
                        <Text style={[n.pickName, { color: b.ink }]} numberOfLines={1}>{itemName(itemType)}</Text>
                        <Text style={[n.pickPrice, { color: b.muted }]} numberOfLines={1}>
                          <Text style={[n.pickPriceNum, { color: b.isDark ? '#38BDF8' : '#0284C7' }]}>{money(price)}</Text> {cur} · {isEn ? 'per piece' : 'لكل قطعة'}
                        </Text>
                      </View>
                      {inCart ? (
                        <Stepper
                          qty={inCart.quantity}
                          onMinus={() => updateQty(inCartIdx, -1)}
                          onPlus={() => updateQty(inCartIdx, 1)}
                          onRemove={() => removeFromCart(inCartIdx)}
                        />
                      ) : (
                        <TouchableOpacity
                          onPress={() => addItemInline(itemType)}
                          hitSlop={HIT}
                          accessibilityRole="button"
                          accessibilityLabel={`+ ${itemName(itemType)}`}
                          style={[n.plusBtn, { backgroundColor: b.primary }]}
                        >
                          <Plus size={18} color="#fff" />
                        </TouchableOpacity>
                      )}
                    </View>
                  )
                })}
              </Card>
            ))}
          </>
        )}

        <View style={{ height: 8 }} />
      </ScrollView>

      {/* Total + save */}
      <View style={[n.foot, { backgroundColor: b.card, borderTopColor: b.cardBorder, paddingBottom: Math.max(insets.bottom, 10) + 10 }]}>
        {!isSubOrder && priceDiff !== 0 && (
          <View style={[n.diff, { backgroundColor: priceDiff > 0 ? b.warnTint : b.okTint }]}>
            {priceDiff > 0 ? <Plus size={14} color={b.warnText} /> : <Minus size={14} color={b.okText} />}
            <Text style={[n.diffText, { color: priceDiff > 0 ? b.warnText : b.okText }]}>
              {priceDiff > 0
                ? (isEn ? `You will pay ${money(priceDiff)} ${cur} more after saving` : `هتدفع فرق ${money(priceDiff)} ${cur} بعد الحفظ`)
                : (isEn ? `${money(Math.abs(priceDiff))} ${cur} will be refunded` : `هيترد لك ${money(Math.abs(priceDiff))} ${cur}`)}
            </Text>
          </View>
        )}
        <View style={n.footRow}>
          <View style={{ flex: 1 }}>
            <Text style={[n.totalLabel, { color: b.muted }]}>{isEn ? 'New total' : 'الإجمالي الجديد'}</Text>
            <Text style={[n.totalValue, { color: b.accentIcon }]} numberOfLines={1}>
              {isSubOrder ? (isEn ? 'Free (Plan)' : 'مجاناً (باقة)') : `${money(newTotal)} ${cur}`}
            </Text>
          </View>
          <PrimaryButton
            title={isEn ? 'Save Changes' : 'حفظ التعديلات'}
            loadingTitle={isEn ? 'Saving...' : 'جاري الحفظ...'}
            loading={saving}
            disabled={cart.length === 0}
            onPress={handleSave}
            style={{ flex: 0, width: 160 }}
          />
        </View>
      </View>
    </View>
    {AlertComponent}
    </>
  )
}

const n = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 30 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  title: { flex: 1, fontSize: 18, fontFamily: F.display },
  numPill: { height: 28, paddingHorizontal: 11, borderRadius: 14, justifyContent: 'center' },
  numPillText: { fontSize: 12.5, fontFamily: F.bold },
  card: { marginBottom: 12, padding: 14 },
  eyebrow: { fontSize: 11, fontFamily: F.bold, marginBottom: 6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54, paddingVertical: 6 },
  thumb: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  itemInfo: { flex: 1, minWidth: 0 },
  itemName: { fontSize: 13, fontFamily: F.bold },
  itemSub: { fontSize: 11, fontFamily: F.regular, marginTop: 1 },
  label: { fontSize: 12, fontFamily: F.semibold, marginTop: 12, marginHorizontal: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 },
  tile: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minWidth: '31%', flexGrow: 1, height: SIZE.M, borderRadius: SIZE.rM, borderWidth: 1, paddingHorizontal: 8 },
  tileDot: { width: 6, height: 6, borderRadius: 3 },
  tileText: { fontSize: 12.5, fontFamily: F.bold, flexShrink: 1 },
  svcTile: { alignItems: 'center', justifyContent: 'center', gap: 1, minWidth: '31%', flexGrow: 1, minHeight: SIZE.M + 10, borderRadius: SIZE.rM, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 6 },
  svcPrice: { fontSize: 11, fontFamily: F.semibold },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  addBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: SIZE.M, borderRadius: SIZE.rM },
  addBtnText: { fontSize: 13.5, fontFamily: F.bold },
  foot: { borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 11 },
  footRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  diff: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10 },
  diffText: { flex: 1, fontSize: 11.5, fontFamily: F.bold, lineHeight: 18 },
  totalLabel: { fontSize: 10.5, fontFamily: F.regular },
  totalValue: { fontSize: 19, fontFamily: F.display },
  blockIcon: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  blockText: { fontSize: 14.5, fontFamily: F.semibold, textAlign: 'center', lineHeight: 24 },
  secRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, marginBottom: 10, marginHorizontal: 2 },
  secDot: { width: 9, height: 9, borderRadius: 5 },
  secTitle: { fontFamily: F.display, fontSize: 16 },
  bleed: { marginHorizontal: -16 },
  svcRow: { gap: 10, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 2 },
  svcCol: { width: 76, alignItems: 'center' },
  svcPhoto: { width: 76, height: 76, borderRadius: 18, borderWidth: 2, overflow: 'hidden' },
  svcImg: { width: '100%', height: '100%' },
  svcCheck: { position: 'absolute', top: -4, start: -4, width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  svcName: { fontSize: 11.5, fontFamily: F.semibold, lineHeight: 16, textAlign: 'center', marginTop: 6 },
  catRow: { gap: 7, paddingHorizontal: 16, paddingVertical: 2 },
  catEmoji: { fontSize: 13 },
  itemsCard: { marginTop: 12, overflow: 'hidden' },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 58, paddingHorizontal: 12, paddingVertical: 9 },
  pickBody: { flex: 1, minWidth: 0 },
  pickName: { fontSize: 14, fontFamily: F.bold, flexShrink: 1 },
  pickPrice: { fontSize: 11.5, fontFamily: F.medium, marginTop: 2 },
  pickPriceNum: { fontSize: 13.5, fontFamily: F.display },
  plusBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
})
