import { useEffect, useState, useCallback, useRef } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Linking, AppState } from 'react-native'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated'
import { Phone, MessageCircle, Navigation, MapPin, Package, Truck } from 'lucide-react-native'
import * as Location from 'expo-location'
import { useAuth } from '../../src/contexts/AuthContext'
import { supabase } from '../../src/lib/supabase'
import { useRealtimeDriverOrders } from '../../src/hooks/useRealtimeOrders'
import { useDriverLocation } from '../../src/hooks/useDriverLocation'
import { colors } from '../../src/theme'
import { SkeletonOrderCard } from '../../src/components/Skeleton'
import { useCustomAlert } from '../../src/components/CustomAlert'
import { canTransitionTo } from '../../src/shared/utils'

function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
  assigned: { label: 'بانتظار الاستلام', color: '#3b82f6', icon: '📋' },
  picked_up: { label: 'تم الاستلام', color: '#8b5cf6', icon: '📦' },
  processing: { label: 'جاري المعالجة', color: '#06b6d4', icon: '🔄' },
  ready: { label: 'جاهز للتوصيل', color: '#10b981', icon: '✅' },
  delivering: { label: 'جاري التوصيل', color: '#f59e0b', icon: '🛵' },
  delivered: { label: 'تم التوصيل', color: '#10b981', icon: '🎉' },
}

const nextAction: Record<string, { status: string; label: string }> = {
  assigned: { status: 'picked_up', label: 'تأكيد الاستلام من العميل' },
  picked_up: { status: 'processing', label: 'وصلت للمغسلة' },
  ready: { status: 'delivering', label: 'بدأت التوصيل' },
  delivering: { status: 'delivered', label: 'تم التسليم للعميل' },
}

const serviceLabel: Record<string, string> = {
  wash: 'غسيل', iron: 'كي', wash_iron: 'غسيل وكي', dry_clean: 'تنظيف جاف', tailor: 'تفصيل وتعديلات', carpet: 'سجاد وبطاطين',
}

const paymentMethodLabel: Record<string, { label: string; icon: string }> = {
  cash: { label: 'كاش', icon: '💵' },
  visa: { label: 'فيزا', icon: '💳' },
  e_wallet: { label: 'محفظة', icon: '📱' },
  instapay: { label: 'إنستاباي', icon: '🏦' },
}

const paymentStatusLabel: Record<string, { label: string; color: string }> = {
  pending: { label: 'معلق', color: '#f59e0b' },
  confirmed: { label: 'مؤكد', color: '#10b981' },
  paid: { label: 'مدفوع', color: '#10b981' },
  failed: { label: 'فشل', color: '#ef4444' },
  refunded: { label: 'مسترد', color: '#8b5cf6' },
}

type Filter = 'pickup' | 'delivery' | 'completed'
type DateRange = '7' | '14' | '30' | 'all'
const dateRangeLabels: Record<DateRange, string> = { '7': 'آخر 7 أيام', '14': 'آخر 14 يوم', '30': 'آخر 30 يوم', all: 'الكل' }

export default function DriverOrdersScreen() {
  const { profile } = useAuth()
  const router = useRouter()
  const { showAlert, AlertComponent } = useCustomAlert()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<Filter>('pickup')
  const [dateRange, setDateRange] = useState<DateRange>('14')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [pickupSub, setPickupSub] = useState<'all' | 'assigned' | 'picked_up'>('all')
  const driverLocRef = useRef<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    if (!profile) return
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then(loc => { driverLocRef.current = { lat: loc.coords.latitude, lng: loc.coords.longitude } })
      .catch(() => {})
  }, [profile])

  const loadOrders = useCallback(async () => {
    if (!profile) return
    if (!driverLocRef.current) {
      try {
        const { data: dl } = await supabase.from('driver_locations').select('lat, lng').eq('driver_id', profile.id).single()
        if (dl) driverLocRef.current = { lat: dl.lat, lng: dl.lng }
      } catch {}
    }
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, status, service_type, items_count, total, notes, payment_method, payment_status, order_type, pickup_location, delivery_location, created_at, is_scheduled, scheduled_at, rating_driver, rating_note, customer:users!orders_customer_id_fkey(name, phone, customer_code), address:addresses(label, building, floor, apartment, landmark, lat, lng)')
      .eq('driver_id', profile.id)
      .not('status', 'in', '("scheduled","cancelled","refunded")')
      .order('created_at', { ascending: false })
      .limit(50)
    setOrders(data ?? [])
    setLoading(false)
    setRefreshing(false)
  }, [profile])

  useEffect(() => { loadOrders() }, [loadOrders])
  useRealtimeDriverOrders(profile?.id, loadOrders)

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadOrders()
    })
    return () => sub.remove()
  }, [loadOrders])
  const hasActive = orders.some(o => !['delivered'].includes(o.status))
  useDriverLocation(profile?.id, hasActive)

  const onRefresh = () => { setRefreshing(true); loadOrders() }

  function distFromDriver(loc: any): number {
    if (!driverLocRef.current || !loc?.lat || !loc?.lng) return Infinity
    return getDistanceKm(driverLocRef.current.lat, driverLocRef.current.lng, loc.lat, loc.lng)
  }

  // Pickup: assigned, picked_up — sorted by status then distance from driver
  const pickupOrders = orders
    .filter(o => ['assigned', 'picked_up'].includes(o.status))
    .sort((a, b) => {
      const p: Record<string, number> = { assigned: 0, picked_up: 1 }
      const statusDiff = (p[a.status] ?? 9) - (p[b.status] ?? 9)
      if (statusDiff !== 0) return statusDiff
      return distFromDriver(a.pickup_location) - distFromDriver(b.pickup_location)
    })

  // Delivery: ready, delivering — sorted by status then distance from driver
  const deliveryOrders = orders
    .filter(o => ['ready', 'delivering'].includes(o.status))
    .sort((a, b) => {
      const p: Record<string, number> = { ready: 0, delivering: 1 }
      const statusDiff = (p[a.status] ?? 9) - (p[b.status] ?? 9)
      if (statusDiff !== 0) return statusDiff
      return distFromDriver(a.delivery_location) - distFromDriver(b.delivery_location)
    })

  const completedOrders = orders.filter(o => {
    if (o.status !== 'delivered') return false
    if (dateRange === 'all') return true
    const daysAgo = new Date()
    daysAgo.setDate(daysAgo.getDate() - Number(dateRange))
    return new Date(o.created_at) >= daysAgo
  })

  const visiblePickup = pickupSub === 'all' ? pickupOrders : pickupOrders.filter(o => o.status === pickupSub)
  const filteredOrders = filter === 'pickup' ? visiblePickup : filter === 'delivery' ? deliveryOrders : completedOrders

  async function updateStatus(orderId: string, newStatus: string) {
    // Validate transition and ownership
    const currentOrder = orders.find(o => o.id === orderId)
    if (currentOrder && !canTransitionTo(currentOrder.status as any, newStatus as any)) {
      showAlert({ title: 'خطأ', message: 'لا يمكن الانتقال لهذه الحالة', type: 'error' })
      return
    }
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId).eq('driver_id', profile?.id)
    if (error) {
      showAlert({ title: 'خطأ', message: 'حدث خطأ أثناء تحديث الحالة', type: 'error' })
    } else {
      await supabase.from('order_status_history').insert({
        order_id: orderId, status: newStatus, changed_by: profile?.id,
      })
      sendPushToCustomer(orderId, newStatus)
      if (newStatus === 'delivered') {
        showAlert({ title: 'تم التسليم', message: 'تم تسليم الطلب للعميل بنجاح', type: 'success', buttons: [
          { text: 'حسناً', onPress: () => loadOrders() },
        ] })
      } else {
        const statusMsg = statusConfig[newStatus]?.label ?? newStatus
        showAlert({ title: 'تم', message: `تم تحديث الحالة: ${statusMsg}`, type: 'success' })
        loadOrders()
      }
    }
  }

  async function sendPushToCustomer(orderId: string, newStatus: string) {
    try {
      const { data: order } = await supabase.from('orders').select('customer_id, order_number').eq('id', orderId).single()
      if (!order) return
      const { data: customer } = await supabase.from('users').select('fcm_token').eq('id', order.customer_id).single()
      if (!customer?.fcm_token) return
      const statusMessages: Record<string, string> = {
        assigned: 'تم تعيين سائق لطلبك',
        picked_up: 'تم استلام ملابسك من السائق',
        processing: 'ملابسك قيد المعالجة الآن',
        ready: 'ملابسك جاهزة للتوصيل!',
        delivering: 'السائق في طريقه إليك',
        delivered: 'تم توصيل طلبك بنجاح!',
      }
      const message = statusMessages[newStatus]
      if (!message) return
      fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: customer.fcm_token,
          title: `طلب ${order.order_number}`,
          body: message,
          sound: 'default',
          data: { type: 'order_update', order_id: orderId, status: newStatus },
        }),
      }).catch(() => {})
    } catch {}
  }

  function openNavigation(loc: any) {
    if (!loc?.lat || !loc?.lng) {
      showAlert({ title: 'خطأ', message: 'لا يوجد موقع محدد لهذا العنوان', type: 'error' })
      return
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`
    Linking.openURL(url)
  }

  function getRelevantLocation(item: any) {
    const isPickupPhase = ['assigned', 'picked_up'].includes(item.status)
    if (isPickupPhase) {
      return { loc: item.pickup_location ?? item.address ?? item.delivery_location, label: '📦 عنوان الاستلام', phase: 'pickup' }
    }
    return { loc: item.delivery_location ?? item.address ?? item.pickup_location, label: '🚗 عنوان التسليم', phase: 'delivery' }
  }

  const renderOrder = ({ item, index }: { item: any; index: number }) => {
    const status = statusConfig[item.status] ?? { label: item.status, color: '#999', icon: '❓' }
    const action = nextAction[item.status]
    const addr = item.address
    const { loc: relevantLoc, label: locLabel } = getRelevantLocation(item)

    return (
      <Animated.View entering={FadeInRight.duration(400).delay(index * 80)}>
        <View style={[s.orderCard, item.status !== 'delivered' && { borderColor: status.color + '40' }]}>
          <View style={s.orderHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={s.orderNumber}>{item.order_number}</Text>
              {item.order_type === 'bag_offer' && (
                <View style={{ backgroundColor: '#05966920', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                  <Text style={{ fontSize: 10, color: '#059669', fontWeight: '700' }}>👜 شنطة</Text>
                </View>
              )}
              {item.order_type === 'subscription' && (
                <View style={{ backgroundColor: '#8b5cf620', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                  <Text style={{ fontSize: 10, color: '#8b5cf6', fontWeight: '700' }}>👑 باقة</Text>
                </View>
              )}
            </View>
            <View style={[s.statusBadge, { backgroundColor: status.color + '20' }]}>
              <Text style={{ fontSize: 12 }}>{status.icon}</Text>
              <Text style={[s.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>

          <Text style={{ fontSize: 11, color: colors.navy[400], marginTop: 4 }}>📅 {new Date(item.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })} — {new Date(item.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</Text>

          {item.is_scheduled && item.scheduled_at && (
            <View style={s.scheduleBadge}>
              <Text style={s.scheduleBadgeText}>🕐 موعد: {new Date(item.scheduled_at).toLocaleDateString('ar-EG')} - {new Date(item.scheduled_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          )}

          <View style={s.divider} />

          <View style={s.customerInfo}>
            <View style={s.customerAvatar}>
              <Text style={s.customerAvatarText}>{item.customer?.name?.[0] ?? '؟'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.customerName}>{item.customer?.name}</Text>
              {item.customer?.phone && <Text style={s.customerPhone}>{item.customer.phone}</Text>}
            </View>
            {item.customer?.phone && (
              <TouchableOpacity style={s.quickCallBtn} onPress={() => Linking.openURL(`tel:${item.customer.phone}`)}>
                <Phone size={16} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Address — shows pickup or delivery based on order phase */}
          {(relevantLoc?.lat || addr?.lat) && (
            <View style={s.addressBox}>
              <View style={s.addressHeader}>
                <Text style={s.addressLabel}>{locLabel} {relevantLoc?.label || addr?.label || ''}</Text>
                <TouchableOpacity style={s.navBtn} onPress={() => openNavigation(relevantLoc || addr)}>
                  <Navigation size={14} color={colors.primary} />
                  <Text style={s.navBtnText}>اتجاهات</Text>
                </TouchableOpacity>
              </View>
              {addr && ['assigned', 'picked_up'].includes(item.status) && (
                <>
                  <Text style={s.addressDetail}>
                    {[addr.building && `مبنى ${addr.building}`, addr.floor && `ط${addr.floor}`, addr.apartment && `ش${addr.apartment}`].filter(Boolean).join(' - ')}
                  </Text>
                  {addr.landmark && <Text style={s.addressDetail}>📌 {addr.landmark}</Text>}
                </>
              )}
            </View>
          )}

          {/* Show both addresses summary for context */}
          {item.status !== 'delivered' && item.pickup_location?.lat && item.delivery_location?.lat && (
            <View style={s.routeSummary}>
              <TouchableOpacity style={s.routePoint} onPress={() => openNavigation(item.pickup_location)}>
                <Text style={s.routeIcon}>📦</Text>
                <Text style={s.routeText} numberOfLines={1}>{item.pickup_location.label || 'الاستلام'}</Text>
              </TouchableOpacity>
              <Text style={s.routeArrow}>→</Text>
              <TouchableOpacity style={s.routePoint} onPress={() => openNavigation(item.delivery_location)}>
                <Text style={s.routeIcon}>🏠</Text>
                <Text style={s.routeText} numberOfLines={1}>{item.delivery_location.label || 'التسليم'}</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={s.orderDetails}>
            <View style={s.detailChip}>
              <Text style={s.detailChipLabel}>{serviceLabel[item.service_type] ?? item.service_type}</Text>
            </View>
            <View style={s.detailChip}>
              <Text style={s.detailChipLabel}>{item.items_count} قطعة</Text>
            </View>
            <View style={[s.detailChip, { backgroundColor: colors.primaryGlow, borderColor: colors.primary + '30' }]}>
              <Text style={[s.detailChipLabel, { color: colors.primary }]}>{item.total?.toFixed(2)} ج.م</Text>
            </View>
          </View>

          <View style={s.paymentRow}>
            <View style={s.paymentItem}>
              <Text style={s.paymentLabel}>الدفع</Text>
              <Text style={s.paymentValue}>
                {paymentMethodLabel[item.payment_method]?.icon ?? '💰'} {paymentMethodLabel[item.payment_method]?.label ?? item.payment_method}
              </Text>
            </View>
            <View style={s.paymentItem}>
              <Text style={s.paymentLabel}>الحالة</Text>
              <View style={[s.paymentStatusBadge, { backgroundColor: (paymentStatusLabel[item.payment_status]?.color ?? '#999') + '20' }]}>
                <Text style={[s.paymentStatusText, { color: paymentStatusLabel[item.payment_status]?.color ?? '#999' }]}>
                  {paymentStatusLabel[item.payment_status]?.label ?? item.payment_status}
                </Text>
              </View>
            </View>
          </View>

          {item.order_type === 'subscription' && item.total > 0 && (
            <View style={{ backgroundColor: '#f59e0b15', borderColor: '#f59e0b30', borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 6 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#f59e0b' }}>💰 مطلوب تحصيل: {item.total.toFixed(2)} ج.م</Text>
              <Text style={{ fontSize: 10, color: colors.navy[400], marginTop: 2 }}>قطع التفصيل خارج الباقة</Text>
            </View>
          )}

          {item.notes && <Text style={s.notes}>📝 {item.notes}</Text>}

          {item.status === 'delivered' && item.rating_driver != null && (
            <View style={s.ratingRow}>
              <Text style={s.ratingLabel}>تقييم العميل:</Text>
              <Text style={s.ratingStars}>{'⭐'.repeat(item.rating_driver)}</Text>
              {item.rating_note ? <Text style={s.ratingNote}>{item.rating_note}</Text> : null}
            </View>
          )}

          {action && (
            <TouchableOpacity
              style={s.actionBtnWrap}
              onPress={() => showAlert({ title: 'تأكيد', message: `${action.label}؟`, type: 'confirm', buttons: [
                { text: 'إلغاء', style: 'cancel' },
                { text: 'تأكيد', onPress: () => updateStatus(item.id, action.status) },
              ] })}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[status.color, status.color + 'cc']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.actionBtn}
              >
                <Text style={s.actionText}>{action.label}</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          <View style={s.contactRow}>
            {(relevantLoc?.lat || addr?.lat) && (
              <TouchableOpacity style={s.mapBtn} onPress={() => openNavigation(relevantLoc || addr)} activeOpacity={0.7}>
                <MapPin size={16} color="#f59e0b" />
                <Text style={s.mapBtnText}>الخريطة</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.msgBtn} onPress={() => router.push(`/chat/${item.id}`)} activeOpacity={0.7}>
              <MessageCircle size={16} color={colors.primary} />
              <Text style={s.msgBtnText}>رسالة</Text>
            </TouchableOpacity>
            {item.customer?.phone && (
              <TouchableOpacity style={s.callBtn} onPress={() => Linking.openURL(`tel:${item.customer.phone}`)} activeOpacity={0.7}>
                <Phone size={16} color={colors.accent} />
                <Text style={s.callBtnText}>اتصال</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Animated.View>
    )
  }

  return (
    <>
    <View style={s.container}>
      <Animated.View entering={FadeInDown.duration(500)} style={s.header}>
        <View>
          <Text style={s.title}>الطلبات</Text>
          <Text style={s.subtitle}>{pickupOrders.length} استلام · {orders.filter(o => o.status === 'processing').length} مغسلة · {deliveryOrders.length} توصيل · {completedOrders.length} مكتمل</Text>
        </View>
        <View style={s.headerAvatar}>
          <Text style={s.headerAvatarText}>{profile?.name?.[0] ?? '؟'}</Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(500).delay(100)} style={s.filterRow}>
        <TouchableOpacity style={[s.filterBtn, filter === 'pickup' && s.filterActive]} onPress={() => { setFilter('pickup'); setPickupSub('all') }}>
          <View style={s.filterInner}>
            <Package size={14} color={filter === 'pickup' ? colors.primary : colors.navy[300]} />
            <Text style={[s.filterText, filter === 'pickup' && s.filterTextActive]}>استلام</Text>
            {pickupOrders.length > 0 && <View style={s.filterBadge}><Text style={s.filterBadgeText}>{pickupOrders.length}</Text></View>}
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={[s.filterBtn, filter === 'delivery' && { backgroundColor: '#10b98120', borderColor: '#10b981' }]} onPress={() => setFilter('delivery')}>
          <View style={s.filterInner}>
            <Truck size={14} color={filter === 'delivery' ? '#10b981' : colors.navy[300]} />
            <Text style={[s.filterText, filter === 'delivery' && { color: '#10b981' }]}>توصيل</Text>
            {deliveryOrders.length > 0 && <View style={[s.filterBadge, { backgroundColor: '#10b981' }]}><Text style={s.filterBadgeText}>{deliveryOrders.length}</Text></View>}
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={[s.filterBtn, filter === 'completed' && { backgroundColor: colors.navy[600] + '40', borderColor: colors.navy[400] }]} onPress={() => setFilter('completed')}>
          <Text style={[s.filterText, filter === 'completed' && { color: colors.navy[100] }]}>مكتمل</Text>
        </TouchableOpacity>
      </Animated.View>

      {filter === 'pickup' && pickupOrders.length > 0 && (
        <View style={s.subFilterRow}>
          {([
            { key: 'all' as const, label: 'الكل', count: pickupOrders.length },
            { key: 'assigned' as const, label: '📋 بانتظار الاستلام', count: pickupOrders.filter(o => o.status === 'assigned').length },
            { key: 'picked_up' as const, label: '📦 في الطريق للمغسلة', count: pickupOrders.filter(o => o.status === 'picked_up').length },
          ]).filter(f => f.count > 0 || f.key === 'all').map(f => (
            <TouchableOpacity key={f.key} onPress={() => setPickupSub(f.key)}
              style={[s.subFilterBtn, pickupSub === f.key && s.subFilterBtnActive]}>
              <Text style={[s.subFilterText, pickupSub === f.key && s.subFilterTextActive]}>{f.label} ({f.count})</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {filter === 'completed' && (
        <View style={s.dateFilterRow}>
          <TouchableOpacity style={s.dateFilterBtn} onPress={() => setShowDatePicker(!showDatePicker)}>
            <Text style={s.dateFilterBtnText}>📅 {dateRangeLabels[dateRange]}</Text>
            <Text style={s.dateFilterArrow}>{showDatePicker ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <View style={s.dateDropdown}>
              {(Object.keys(dateRangeLabels) as DateRange[]).map(key => (
                <TouchableOpacity key={key} style={[s.dateDropdownItem, dateRange === key && s.dateDropdownItemActive]}
                  onPress={() => { setDateRange(key); setShowDatePicker(false) }}>
                  <Text style={[s.dateDropdownText, dateRange === key && s.dateDropdownTextActive]}>{dateRangeLabels[key]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {loading ? (
        <Animated.View entering={FadeInDown.duration(400).delay(300)} style={{ gap: 12 }}>
          <SkeletonOrderCard />
          <SkeletonOrderCard />
          <SkeletonOrderCard />
        </Animated.View>
      ) : filteredOrders.length === 0 ? (
        <Animated.View entering={FadeInDown.duration(500).delay(300)} style={s.emptyCard}>
          <Text style={s.emptyIcon}>{filter === 'pickup' ? '📦' : filter === 'delivery' ? '🚗' : '📋'}</Text>
          <Text style={s.emptyText}>{filter === 'pickup' ? 'لا توجد طلبات للاستلام' : filter === 'delivery' ? 'لا توجد طلبات للتوصيل' : 'لا توجد طلبات مكتملة'}</Text>
          {filter === 'delivery' && orders.some(o => o.status === 'processing') && (
            <Text style={s.emptyHint}>⏳ {orders.filter(o => o.status === 'processing').length} طلبات في المغسلة — ستظهر هنا لما تجهز</Text>
          )}
        </Animated.View>
      ) : (
        <FlatList
          data={filteredOrders}
          renderItem={renderOrder}
          keyExtractor={item => item.id}
          contentContainerStyle={{ gap: 14, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
    {AlertComponent}
    </>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900], padding: 20, paddingTop: 56 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#fff' },
  subtitle: { fontSize: 13, color: colors.navy[300], marginTop: 2 },
  headerAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center',
  },
  headerAvatarText: { fontSize: 18, color: '#fff', fontWeight: '800' },

  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  filterBtn: { flex: 1, paddingVertical: 10, borderRadius: 14, alignItems: 'center', backgroundColor: colors.navy[800], borderWidth: 1, borderColor: colors.navy[700] },
  filterActive: { backgroundColor: colors.primary + '20', borderColor: colors.primary },
  filterInner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  filterText: { fontSize: 13, color: colors.navy[300], fontWeight: '600' },
  filterTextActive: { color: colors.primary },
  filterBadge: { backgroundColor: colors.primary, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  filterBadgeText: { fontSize: 10, color: '#fff', fontWeight: '800' },

  orderCard: {
    backgroundColor: colors.navy[800], borderRadius: 22, padding: 20,
    borderWidth: 1, borderColor: colors.navy[700],
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNumber: { fontSize: 16, fontWeight: '800', color: '#fff' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '700' },

  divider: { height: 1, backgroundColor: colors.navy[700], marginVertical: 14 },

  customerInfo: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10,
  },
  customerAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.accent + '25', justifyContent: 'center', alignItems: 'center',
  },
  customerAvatarText: { fontSize: 16, fontWeight: '700', color: colors.accent },
  customerName: { fontSize: 14, color: '#fff', fontWeight: '700' },
  customerPhone: { fontSize: 12, color: colors.navy[300], marginTop: 2 },
  quickCallBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primaryGlow, justifyContent: 'center', alignItems: 'center',
  },

  addressBox: {
    backgroundColor: colors.navy[700] + '40', borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: colors.navy[600],
  },
  addressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  addressLabel: { fontSize: 13, color: '#fff', fontWeight: '600', flex: 1 },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primaryGlow, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
  navBtnText: { fontSize: 11, color: colors.primary, fontWeight: '700' },
  addressDetail: { fontSize: 11, color: colors.navy[200], marginTop: 2 },

  routeSummary: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12,
    backgroundColor: colors.navy[700] + '30', borderRadius: 10, padding: 10,
  },
  routePoint: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  routeIcon: { fontSize: 14 },
  routeText: { fontSize: 11, color: colors.navy[200], flex: 1 },
  routeArrow: { fontSize: 14, color: colors.navy[400] },

  orderDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  detailChip: {
    backgroundColor: colors.navy[700], paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 10, borderWidth: 1, borderColor: colors.navy[600],
  },
  detailChipLabel: { fontSize: 12, color: colors.navy[100], fontWeight: '600' },

  paymentRow: {
    flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 4,
    backgroundColor: colors.navy[700] + '40', borderRadius: 12, padding: 12,
  },
  paymentItem: { flex: 1, gap: 4 },
  paymentLabel: { fontSize: 10, color: colors.navy[400], fontWeight: '600' },
  paymentValue: { fontSize: 13, color: '#fff', fontWeight: '700' },
  paymentStatusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  paymentStatusText: { fontSize: 12, fontWeight: '700' },

  scheduleBadge: {
    backgroundColor: '#f59e0b15', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, marginTop: 8,
    borderWidth: 1, borderColor: '#f59e0b30',
  },
  scheduleBadgeText: { fontSize: 12, color: '#f59e0b', fontWeight: '600' },
  notes: { fontSize: 12, color: colors.navy[200], marginTop: 4, marginBottom: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.navy[700] },
  ratingLabel: { fontSize: 11, color: colors.navy[300] },
  ratingStars: { fontSize: 12 },
  ratingNote: { fontSize: 11, color: colors.navy[300], fontStyle: 'italic', flex: 1 },

  actionBtnWrap: { borderRadius: 16, overflow: 'hidden', marginTop: 12 },
  actionBtn: { padding: 14, alignItems: 'center', borderRadius: 16 },
  actionText: { fontSize: 15, fontWeight: '800', color: '#fff' },

  contactRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  msgBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: colors.primary + '40', borderRadius: 14, padding: 11,
    backgroundColor: colors.primaryGlow,
  },
  msgBtnText: { fontSize: 13, color: colors.primary, fontWeight: '700' },
  callBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: colors.accent + '40', borderRadius: 14, padding: 11,
    backgroundColor: colors.accentGlow,
  },
  callBtnText: { fontSize: 13, color: colors.accent, fontWeight: '700' },
  mapBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: '#f59e0b40', borderRadius: 14, padding: 11,
    backgroundColor: '#f59e0b10',
  },
  mapBtnText: { fontSize: 13, color: '#f59e0b', fontWeight: '700' },

  emptyCard: {
    backgroundColor: colors.navy[800], borderRadius: 22, padding: 40,
    alignItems: 'center', borderWidth: 1, borderColor: colors.navy[700],
  },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 14, color: colors.navy[300] },
  emptyHint: { fontSize: 12, color: colors.navy[400], marginTop: 8, textAlign: 'center' },

  subFilterRow: { flexDirection: 'row', gap: 6, marginBottom: 10, flexWrap: 'wrap' },
  subFilterBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
    backgroundColor: colors.navy[800], borderWidth: 1, borderColor: colors.navy[700],
  },
  subFilterBtnActive: { backgroundColor: colors.primary + '20', borderColor: colors.primary },
  subFilterText: { fontSize: 11, color: colors.navy[300], fontWeight: '600' },
  subFilterTextActive: { color: colors.primary },

  dateFilterRow: { marginBottom: 12, zIndex: 10 },
  dateFilterBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.navy[800], borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: colors.navy[700],
  },
  dateFilterBtnText: { fontSize: 13, color: colors.navy[200], fontWeight: '600' },
  dateFilterArrow: { fontSize: 10, color: colors.navy[400] },
  dateDropdown: {
    backgroundColor: colors.navy[800], borderRadius: 12, marginTop: 6,
    borderWidth: 1, borderColor: colors.navy[700], overflow: 'hidden',
  },
  dateDropdownItem: { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.navy[700] },
  dateDropdownItemActive: { backgroundColor: colors.primary + '20' },
  dateDropdownText: { fontSize: 13, color: colors.navy[200], fontWeight: '600' },
  dateDropdownTextActive: { color: colors.primary },
})
