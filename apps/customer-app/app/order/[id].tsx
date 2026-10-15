import { useEffect, useState, useRef, useMemo } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Linking } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { WebView } from 'react-native-webview'
import { useAuth } from '../../src/contexts/AuthContext'
import { useTheme } from '../../src/contexts/ThemeContext'
import { useLanguage } from '../../src/contexts/LanguageContext'
import { useCustomAlert } from '../../src/components/CustomAlert'
import { ActivityIndicator } from 'react-native'
import { supabase } from '../../src/lib/supabase'
import { SkeletonPage } from '../../src/components/Skeleton'
import { CANCELLABLE_STATUSES } from '../../src/shared/types'
import { serverErrorMessage } from '../../src/lib/serverErrors'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Hourglass, CalendarDays, Car, MapPin, Package, WashingMachine, CircleCheck, Truck, PartyPopper, CircleX, RotateCcw, ChevronDown, ChevronUp, Phone, MessageCircle, Wallet, CreditCard, Banknote, Landmark, Pencil, Gift, Check, type LucideIcon } from 'lucide-react-native'
import { useBrand, Card, IconButton, BackIcon, FlowLines, Segments, Pill, money, F, SIZE, cardShadow } from '../../src/components/brand'
import { SecondaryButton } from '../../src/components/auth/ui'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!

// Driver is shown only while coming to the customer
const TRACK_STATUSES = ['assigned', 'arrived', 'delivering']
function customerPoint(order: any): { lat?: number; lng?: number } {
  const pickup = ['assigned', 'arrived'].includes(order?.status)
  const p = pickup ? (order?.pickup_location ?? order?.delivery_location) : (order?.delivery_location ?? order?.pickup_location)
  return { lat: p?.lat, lng: p?.lng }
}
// Minutes since the driver's last position (null = fresh)
function staleMinutes(at?: string | null) {
  if (!at) return null
  const m = Math.floor((Date.now() - new Date(at).getTime()) / 60000)
  return m >= 5 ? m : null
}

function buildTrackingMapHTML(driverLat: number, driverLng: number, customerLat?: number, customerLng?: number) {
  const centerLat = customerLat ? (driverLat + customerLat) / 2 : driverLat
  const centerLng = customerLng ? (driverLng + customerLng) / 2 : driverLng
  const zoom = customerLat ? 14 : 15
  const customerMarker = customerLat && customerLng
    ? `var custMarker = L.marker([${customerLat}, ${customerLng}], {
        icon: L.divIcon({ className: '', html: '<div style="background:#10b981;width:14px;height:14px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>', iconSize: [14, 14], iconAnchor: [7, 7] })
      }).addTo(map).bindPopup('You');`
    : ''
  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<style>*{margin:0;padding:0}#map{width:100vw;height:100vh}.leaflet-control-attribution{display:none!important}</style>
</head><body>
<div id="map"></div>
<script>
  var map = L.map('map', {zoomControl:false, attributionControl:false}).setView([${centerLat}, ${centerLng}], ${zoom});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19}).addTo(map);
  var driverMarker = L.marker([${driverLat}, ${driverLng}], {
    icon: L.divIcon({ className: '', html: '<div style="background:#3b82f6;width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.5)"></div>', iconSize: [16, 16], iconAnchor: [8, 8] })
  }).addTo(map).bindPopup('Driver');
  ${customerMarker}
  window.updateDriver = function(lat, lng) {
    driverMarker.setLatLng([lat, lng]);
    ${customerLat ? `var bounds = L.latLngBounds([[lat, lng], [${customerLat}, ${customerLng}]]); map.fitBounds(bounds, {padding: [30, 30]});` : `map.setView([lat, lng], 15);`}
  };
<\/script>
</body></html>`
}

const steps = ['pending', 'assigned', 'arrived', 'picked_up', 'processing', 'ready', 'delivering', 'delivered']

export default function OrderDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { profile } = useAuth()
  const { colors } = useTheme()
  const { t, locale } = useLanguage()
  const isEn = locale === 'en'
  const router = useRouter()
  const { showAlert, AlertComponent } = useCustomAlert()

  const statusConfig: Record<string, { label: string; color: string; icon: string; step: number }> = {
    pending:    { label: t('statusPending'),    color: '#f59e0b', icon: '⏳', step: 0 },
    scheduled:  { label: t('statusScheduled'),  color: '#a855f7', icon: '📅', step: 0 },
    assigned:   { label: t('statusAssigned'),   color: '#3b82f6', icon: '🚗', step: 1 },
    arrived:    { label: t('statusArrived') || 'وصل السائق', color: '#6366f1', icon: '📍', step: 2 },
    picked_up:  { label: t('statusPickedUp'),   color: '#8b5cf6', icon: '📦', step: 3 },
    processing: { label: t('statusProcessing'), color: '#06b6d4', icon: '🔄', step: 4 },
    ready:      { label: t('statusReady'),      color: '#10b981', icon: '✅', step: 5 },
    delivering: { label: t('statusDelivering'), color: '#8b5cf6', icon: '🛵', step: 6 },
    delivered:  { label: t('statusDelivered'),  color: '#10b981', icon: '🎉', step: 7 },
    cancelled:  { label: t('statusCancelled'),  color: '#ef4444', icon: '❌', step: -1 },
    refunded:   { label: t('statusRefunded') || 'مسترد', color: '#f97316', icon: '💰', step: -1 },
  }

  const serviceLabel: Record<string, string> = {
    wash: t('wash'), iron: t('ironOnly'), wash_iron: t('washIron'), dry_clean: t('dryClean'), housekeeping: t('housekeeping'),
  }
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showRating, setShowRating] = useState(false)
  const [ratingService, setRatingService] = useState(0)
  const [ratingDriver, setRatingDriver] = useState(0)
  const [ratingNote, setRatingNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [driverLoc, setDriverLoc] = useState<{ lat: number; lng: number; at?: string | null } | null>(null)
  const [mapSeed, setMapSeed] = useState<{ lat: number; lng: number } | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [showWalletInput, setShowWalletInput] = useState(false)
  const [walletPhone, setWalletPhone] = useState('')
  const mapWebviewRef = useRef<WebView>(null)

  useEffect(() => {
    loadOrder()
    const channel = supabase
      .channel(`order-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, () => loadOrder())
      .subscribe((status, err) => {
        if (err) console.warn('order-detail realtime error:', err.message)
      })
    return () => { supabase.removeChannel(channel) }
  }, [id])

  useEffect(() => {
    setMapSeed(null)
    if (!order?.driver_id || !TRACK_STATUSES.includes(order?.status)) {
      setDriverLoc(null)
      return
    }
    supabase.from('driver_locations').select('lat, lng, updated_at').eq('driver_id', order.driver_id).single()
      .then(({ data }) => {
        if (data) {
          setDriverLoc({ lat: data.lat, lng: data.lng, at: data.updated_at })
          setMapSeed(prev => prev ?? { lat: data.lat, lng: data.lng })
        }
      })

    const ch = supabase
      .channel(`driver-loc-${order.driver_id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'driver_locations',
        filter: `driver_id=eq.${order.driver_id}`,
      }, (payload: any) => {
        const loc = payload.new
        if (loc?.lat && loc?.lng) {
          setDriverLoc({ lat: loc.lat, lng: loc.lng, at: loc.updated_at })
          setMapSeed(prev => prev ?? { lat: loc.lat, lng: loc.lng })
        }
      })
      .subscribe((status, err) => {
        if (err) console.warn('driver-loc realtime error:', err.message)
      })
    return () => { supabase.removeChannel(ch) }
  }, [order?.driver_id, order?.status])

  useEffect(() => {
    if (driverLoc && mapWebviewRef.current) {
      mapWebviewRef.current.injectJavaScript(`window.updateDriver && window.updateDriver(${driverLoc.lat}, ${driverLoc.lng}); true;`)
    }
  }, [driverLoc])

  async function loadOrder() {
    if (!profile?.id) return
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, status, service_type, items_count, total, subtotal, discount, coupon_code, delivery_fee, cancellation_fee, notes, payment_method, payment_status, driver_id, rated_at, rating_service, rating_driver, rating_note, gift_included, created_at, pickup_location, delivery_location, subscription_id, order_type, driver:users!orders_driver_id_fkey(name, phone)')
      .eq('id', id)
      .eq('customer_id', profile.id)
      .single()
    setOrder(data)
    setLoading(false)
  }

  async function handleCancel() {
    const driverArrived = ['arrived', 'picked_up'].includes(order.status)
    const fee = driverArrived ? Number(order.delivery_fee ?? 0) : 0

    const message = driverArrived
      ? (isEn ? `Driver already arrived. Delivery fee ${fee.toFixed(2)} EGP will apply.` : `السائق وصل بالفعل. سيتم احتساب رسوم التوصيل ${fee.toFixed(2)} ج.م`)
      : (isEn ? 'Are you sure you want to cancel this order?' : 'هل أنت متأكد من إلغاء هذا الطلب؟')

    showAlert({ title: t('cancelOrderTitle'), message, type: 'confirm', buttons: [
      { text: t('noGoBack'), style: 'cancel' },
      {
        text: driverArrived ? `${t('yesCancelPay')} ${fee.toFixed(2)} ${t('currency')}` : t('yesCancel'),
        style: 'destructive',
        onPress: async () => {
          // The server sets the cancellation fee and returns plan items to the subscription.
          const { error } = await supabase.rpc('cancel_order', { p_order_id: id })
          if (error) {
            showAlert({ title: t('error'), message: serverErrorMessage(error.message, isEn), type: 'error' })
          } else {
            showAlert({
              title: t('cancelledDone'),
              message: driverArrived
                ? `${t('cancelledWithFee')} ${fee.toFixed(2)} ${t('currency')}`
                : t('cancelledFreeMsg'),
              type: driverArrived ? 'warning' : 'success',
              buttons: [{ text: t('ok'), onPress: () => loadOrder() }],
            })
          }
        }
      },
    ] })
  }

  async function handleRate() {
    if (ratingService === 0) { showAlert({ title: t('error'), message: t('chooseServiceRating'), type: 'error' }); return }
    setSubmitting(true)
    const { error } = await supabase.from('orders').update({
      rating_service: ratingService,
      rating_driver: ratingDriver || null,
      rating_note: ratingNote || null,
      rated_at: new Date().toISOString(),
    }).eq('id', id).eq('customer_id', profile!.id)
    setSubmitting(false)
    if (error) showAlert({ title: t('error'), message: t('connectionError'), type: 'error' })
    else { setShowRating(false); loadOrder() }
  }

  function handleRetryPayment() {
    if (order.payment_method === 'e_wallet') {
      setWalletPhone(profile?.phone || '')
      setShowWalletInput(true)
      return
    }
    submitRetryPayment()
  }

  async function submitRetryPayment(phone?: string) {
    setShowWalletInput(false)
    setRetrying(true)
    try {
      const session = (await supabase.auth.getSession()).data.session
      const res = await fetch(`${SUPABASE_URL}/functions/v1/paymob-pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          order_id: order.id,
          payment_method: order.payment_method === 'visa' ? 'card' : 'wallet',
          ...(phone ? { wallet_phone: phone } : {}),
        }),
      })
      const data = await res.json()
      setRetrying(false)
      if (data.iframe_url) {
        router.push({ pathname: '/payment', params: { url: data.iframe_url, kind: 'order', id: order.id } })
      } else {
        showAlert({ title: t('error'), message: data.error || t('connectionError'), type: 'error' })
      }
    } catch {
      setRetrying(false)
      showAlert({ title: t('error'), message: t('connectionError'), type: 'error' })
    }
  }

  function getDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  const { lat: customerLat, lng: customerLng } = customerPoint(order)
  const stale = staleMinutes(driverLoc?.at)
  const mapHtml = useMemo(
    () => (mapSeed ? buildTrackingMapHTML(mapSeed.lat, mapSeed.lng, customerLat, customerLng) : ''),
    [mapSeed, customerLat, customerLng],
  )
  const distanceKm = driverLoc && customerLat && customerLng
    ? getDistance(driverLoc.lat, driverLoc.lng, customerLat, customerLng)
    : null
  const etaMinutes = distanceKm !== null ? Math.max(1, Math.round(distanceKm / 0.5)) : null

  const s = getStyles(colors)
  const b = useBrand()
  const insets = useSafeAreaInsets()
  const [showSteps, setShowSteps] = useState(false)

  if (loading) return <SkeletonPage />
  if (!order) return <View style={s.container}><Text style={s.loadingText}>{t('orderNotFound')}</Text></View>

  const status = statusConfig[order.status] ?? statusConfig.pending
  const canCancel = CANCELLABLE_STATUSES.includes(order.status)
  const canRate = order.status === 'delivered' && !order.rated_at

  const STATUS_ICON: Record<string, LucideIcon> = {
    pending: Hourglass, scheduled: CalendarDays, assigned: Car, arrived: MapPin, picked_up: Package,
    processing: WashingMachine, ready: CircleCheck, delivering: Truck, delivered: PartyPopper, cancelled: CircleX, refunded: RotateCcw,
  }
  const StatusIcon = STATUS_ICON[order.status] ?? Hourglass
  const currentStep = status.step
  const nextKey = steps.find(k => statusConfig[k].step === currentStep + 1)
  const PM_ICON: Record<string, LucideIcon> = { cash: Banknote, visa: CreditCard, e_wallet: Wallet, wallet: Wallet, instapay: Landmark }
  const PayIcon = PM_ICON[order.payment_method] ?? Wallet
  const payLabel = ({ cash: t('pmCash'), visa: t('pmVisa'), e_wallet: t('pmWallet'), instapay: t('pmInstapay'), wallet: t('pmWallet') } as Record<string, string>)[order.payment_method] ?? order.payment_method
  const payStatus = ({ confirmed: t('payStatusConfirmed'), refunded: t('payStatusRefunded'), failed: t('payStatusFailed'), pending: t('payStatusPending') } as Record<string, string>)[order.payment_status] ?? t('payStatusPending')
  const payTone = order.payment_status === 'confirmed' ? 'ok' : order.payment_status === 'failed' ? 'danger' : order.payment_status === 'refunded' ? 'info' : 'warn'
  const cur = t('currency')
  const itemsValue = Number(order.subtotal ?? (Number(order.total) - Number(order.delivery_fee || 0) + Number(order.discount || 0)))
  const showMap = !!driverLoc && !!mapSeed && TRACK_STATUSES.includes(order.status)
  const dateText = new Date(order.created_at).toLocaleDateString(isEn ? 'en-US' : 'ar-EG', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <>
    <ScrollView style={[s.container, { backgroundColor: b.page }]} contentContainerStyle={[s.content, { paddingTop: insets.top + 10, paddingHorizontal: 16 }]}>
      <FlowLines height={280} />

      {/* Header */}
      <View style={n.header}>
        <IconButton onPress={() => router.back()} label={t('goBack')}><BackIcon color={b.ink} /></IconButton>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[n.title, { color: b.ink }]} numberOfLines={1}>{isEn ? 'Order' : 'طلب'} {'\u2066'}#{String(order.order_number ?? '').replace(/^#+/, '')}{'\u2069'}</Text>
          <Text style={[n.date, { color: b.muted }]}>{dateText}</Text>
        </View>
        <View style={[n.statusPill, { backgroundColor: status.color + '22' }]}>
          <StatusIcon size={13} color={status.color} />
          <Text style={[n.statusPillText, { color: status.color }]} numberOfLines={1}>{status.label}</Text>
        </View>
      </View>

      {order.gift_included && (
        <View style={[n.gift, { backgroundColor: b.isDark ? 'rgba(245,158,11,0.14)' : '#FFF4D6' }]}>
          <Gift size={14} color={b.isDark ? '#FBBF24' : '#B45309'} />
          <Text style={[n.giftText, { color: b.isDark ? '#FBBF24' : '#B45309' }]}>{isEn ? 'Includes Welcome Gift' : 'يشمل هدية ترحيبية'}</Text>
        </View>
      )}

      {/* Progress */}
      {currentStep >= 0 && (
        <Card style={n.card}>
          <Text style={[n.eyebrow, { color: b.muted }]}>{t('trackOrder')} · {currentStep + 1} {isEn ? 'of' : 'من'} {steps.length}</Text>
          <View style={{ marginVertical: 10 }}><Segments total={steps.length} done={currentStep} current /></View>
          <View style={n.nowRow}>
            <View style={[n.nowIcon, { backgroundColor: status.color + '22' }]}><StatusIcon size={19} color={status.color} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[n.nowTitle, { color: b.ink }]}>{status.label}</Text>
              {nextKey ? <Text style={[n.nowSub, { color: b.muted }]}>{isEn ? 'Next' : 'التالي'}: {statusConfig[nextKey].label}</Text> : null}
            </View>
          </View>
          {showSteps && (
            <View style={{ marginTop: 10 }}>
              {steps.map((k, i) => {
                const st = statusConfig[k]
                const Ico = STATUS_ICON[k] ?? Hourglass
                const done = currentStep > st.step
                const isCur = currentStep === st.step
                return (
                  <View key={k} style={n.stepRow}>
                    <View style={{ alignItems: 'center' }}>
                      <View style={[n.stepDot, { backgroundColor: done ? '#0EA5E9' : isCur ? '#818CF8' : b.iconTile }]}>
                        <Ico size={14} color={done || isCur ? '#fff' : b.faint} />
                      </View>
                      {i < steps.length - 1 && <View style={[n.stepLine, { backgroundColor: done ? '#0EA5E9' : b.divider }]} />}
                    </View>
                    <Text style={[n.stepText, { color: done || isCur ? b.ink : b.faint }]}>{st.label}</Text>
                  </View>
                )
              })}
            </View>
          )}
          <TouchableOpacity style={[n.more, { borderTopColor: b.divider }]} onPress={() => setShowSteps(v => !v)} accessibilityRole="button">
            <Text style={[n.moreText, { color: b.tintText }]}>{showSteps ? (isEn ? 'Hide steps' : 'إخفاء المراحل') : (isEn ? 'Show all steps' : 'عرض كل المراحل')}</Text>
            {showSteps ? <ChevronUp size={16} color={b.tintText} /> : <ChevronDown size={16} color={b.tintText} />}
          </TouchableOpacity>
        </Card>
      )}

      {/* Map + driver */}
      {order.driver && (
        <Card style={n.card}>
          {showMap && (
            <TouchableOpacity activeOpacity={0.85} onPress={() => router.push(`/tracking/${order.id}`)} style={n.mapWrap}>
              <WebView
                ref={mapWebviewRef}
                source={{ html: mapHtml }}
                onLoadEnd={() => driverLoc && mapWebviewRef.current?.injectJavaScript(`window.updateDriver && window.updateDriver(${driverLoc.lat}, ${driverLoc.lng}); true;`)}
                style={{ flex: 1 }}
                javaScriptEnabled
                domStorageEnabled
                startInLoadingState
                originWhitelist={['*']}
                scrollEnabled={false}
                nestedScrollEnabled
                pointerEvents="none"
              />
              <View style={[n.mapChip, { backgroundColor: b.card }]}>
                <MapPin size={12} color={b.tintText} />
                <Text style={[n.mapChipText, { color: b.ink }]}>{t('tapToExpand')}</Text>
              </View>
            </TouchableOpacity>
          )}
          <View style={[n.driverRow, showMap && { marginTop: 10 }]}>
            <View style={n.avatar}><Text style={n.avatarText}>{order.driver.name?.[0] ?? '؟'}</Text></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[n.driverName, { color: b.ink }]} numberOfLines={1}>{order.driver.name}</Text>
              <Text style={[n.driverSub, { color: b.muted }]} numberOfLines={1}>{t('theDriver')}</Text>
            </View>
            {order.driver.phone ? (
              <IconButton tone="tint" label={isEn ? 'Call driver' : 'اتصل بالسائق'} onPress={() => Linking.openURL(`tel:${order.driver.phone}`)}>
                <Phone size={17} color={b.okText} />
              </IconButton>
            ) : null}
            <IconButton tone="tint" label={t('chatWithDriver')} onPress={() => router.push(`/chat/${order.id}`)}>
              <MessageCircle size={17} color={b.tintText} />
            </IconButton>
          </View>
          {showMap && distanceKm !== null && (
            <View style={n.stats}>
              <View style={[n.stat, { backgroundColor: b.iconTile }]}>
                <Text style={[n.statValue, { color: b.ink }]}>{distanceKm < 1 ? `${Math.round(distanceKm * 1000)} ${isEn ? 'm' : 'م'}` : `${distanceKm.toFixed(1)} ${isEn ? 'km' : 'كم'}`}</Text>
                <Text style={[n.statLabel, { color: b.muted }]}>{t('distanceLabel')}</Text>
              </View>
              {etaMinutes !== null && (
                <View style={[n.stat, { backgroundColor: b.iconTile }]}>
                  <Text style={[n.statValue, { color: stale ? b.muted : b.ink }]}>~{etaMinutes} {isEn ? 'min' : 'د'}</Text>
                  <Text style={[n.statLabel, { color: b.muted }]}>{stale ? (isEn ? `Updated ${stale} min ago` : `آخر تحديث من ${stale} د`) : t('etaLabel')}</Text>
                </View>
              )}
            </View>
          )}
        </Card>
      )}

      {/* Receipt */}
      <Card style={n.card}>
        <Text style={[n.eyebrow, { color: b.muted }]}>{t('orderInfo')}</Text>
        <View style={n.line}>
          <Text style={[n.lineLabel, { color: b.ink2 }]}>{serviceLabel[order.service_type] ?? order.service_type} · {order.items_count} {isEn ? 'items' : 'قطع'}</Text>
          <Text style={[n.lineValue, { color: b.ink }]}>{money(itemsValue)} {cur}</Text>
        </View>
        {order.delivery_fee > 0 && (
          <View style={n.line}><Text style={[n.lineLabel, { color: b.ink2 }]}>{t('deliveryFee')}</Text><Text style={[n.lineValue, { color: b.ink }]}>{money(order.delivery_fee)} {cur}</Text></View>
        )}
        {order.discount > 0 && (
          <View style={n.line}><Text style={[n.lineLabel, { color: b.ink2 }]}>{isEn ? 'Coupon' : 'كوبون'}{order.coupon_code ? ` (${order.coupon_code})` : ''}</Text><Text style={[n.lineValue, { color: b.okText }]}>-{money(order.discount)} {cur}</Text></View>
        )}
        {order.status === 'cancelled' && order.cancellation_fee > 0 && (
          <View style={n.line}><Text style={[n.lineLabel, { color: b.ink2 }]}>{t('cancellationFee')}</Text><Text style={[n.lineValue, { color: b.dangerText }]}>{money(order.cancellation_fee)} {cur}</Text></View>
        )}
        <View style={[n.line, n.totalLine, { borderTopColor: b.cardBorder }]}>
          <Text style={[n.totalLabel, { color: b.ink }]}>{t('total')}</Text>
          <Text style={[n.totalValue, { color: b.accentIcon }]}>{money(order.total)} {cur}</Text>
        </View>
        <View style={[n.payRow, { backgroundColor: b.iconTile }]}>
          <PayIcon size={16} color={b.accentIcon} />
          <Text style={[n.payText, { color: b.ink }]} numberOfLines={1}>{payLabel}</Text>
          <Pill tone={payTone as any} label={payStatus} icon={order.payment_status === 'confirmed' ? <Check size={11} color={b.okText} /> : undefined} />
        </View>
        {order.notes ? <Text style={[n.notes, { color: b.muted }]}>{t('notesLabel')}: {order.notes}</Text> : null}
      </Card>

      {showWalletInput && (
        <View style={{ backgroundColor: colors.navy[800], borderRadius: 16, padding: 16, marginBottom: 12 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', textAlign: isEn ? 'left' : 'right', marginBottom: 10 }}>{t('enterWalletPhone')}</Text>
          <TextInput
            style={{ backgroundColor: colors.navy[700], color: colors.text, borderRadius: 12, padding: 14, fontSize: 18, fontWeight: '600', letterSpacing: 1, textAlign: 'center', borderWidth: 1, borderColor: colors.navy[600] }}
            value={walletPhone}
            onChangeText={setWalletPhone}
            placeholder="01xxxxxxxxx"
            placeholderTextColor={colors.navy[400]}
            keyboardType="phone-pad"
            maxLength={11}
          />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: colors.navy[600], borderRadius: 12, padding: 12, alignItems: 'center' }}
              onPress={() => setShowWalletInput(false)}
            >
              <Text style={{ color: colors.text, fontWeight: '600' }}>{t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: '#f59e0b', borderRadius: 12, padding: 12, alignItems: 'center', opacity: walletPhone.match(/^01[0-9]{9}$/) ? 1 : 0.5 }}
              onPress={() => {
                if (!walletPhone.match(/^01[0-9]{9}$/)) {
                  showAlert({ title: t('warning'), message: t('phoneInvalid'), type: 'warning' })
                  return
                }
                submitRetryPayment(walletPhone)
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>{t('pay')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {['pending', 'failed'].includes(order.payment_status) && ['visa', 'e_wallet'].includes(order.payment_method) && order.status !== 'cancelled' && !showWalletInput && (
        <TouchableOpacity
          style={[s.retryPayBtn, retrying && { opacity: 0.6 }]}
          onPress={handleRetryPayment}
          disabled={retrying}
        >
          {retrying ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={s.retryPayText}>{t('retryPayment')}</Text>
          )}
        </TouchableOpacity>
      )}

      {['pending', 'assigned', 'arrived'].includes(order.status) && (
        <SecondaryButton title={t('editOrder')} icon={<Pencil size={16} color={b.ink} />} onPress={() => router.push(`/edit-order/${order.id}`)} style={{ marginBottom: 6 }} />
      )}

      {order.rated_at && (
        <View style={s.detailsCard}>
          <Text style={s.sectionTitle}>{t('theRating')}</Text>
          <DetailRow colors={colors} label={t('serviceRating')} value={'⭐'.repeat(order.rating_service)} />
          {order.rating_driver && <DetailRow colors={colors} label={t('driverRating')} value={'⭐'.repeat(order.rating_driver)} />}
          {order.rating_note && <DetailRow colors={colors} label={t('notesLabel')} value={order.rating_note} />}
        </View>
      )}

      {canRate && !showRating && (
        <TouchableOpacity style={s.rateBtn} onPress={() => setShowRating(true)}>
          <Text style={s.rateBtnText}>{t('rateOrder')}</Text>
        </TouchableOpacity>
      )}

      {showRating && (
        <View style={s.detailsCard}>
          <Text style={s.sectionTitle}>{t('rateOrderTitle')}</Text>

          <Text style={s.ratingLabel}>{t('serviceRating')}</Text>
          <View style={s.starsRow}>
            {[1, 2, 3, 4, 5].map(n => (
              <TouchableOpacity key={n} onPress={() => setRatingService(n)}>
                <Text style={[s.star, n <= ratingService && s.starActive]}>{n <= ratingService ? '⭐' : '☆'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {order.driver && (
            <>
              <Text style={s.ratingLabel}>{t('driverRating')}</Text>
              <View style={s.starsRow}>
                {[1, 2, 3, 4, 5].map(n => (
                  <TouchableOpacity key={n} onPress={() => setRatingDriver(n)}>
                    <Text style={[s.star, n <= ratingDriver && s.starActive]}>{n <= ratingDriver ? '⭐' : '☆'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <TextInput
            style={s.ratingInput}
            placeholder={t('ratingNotes')}
            placeholderTextColor={colors.navy[400]}
            value={ratingNote}
            onChangeText={setRatingNote}
            multiline
            textAlign={isEn ? 'left' : 'right'}
          />

          <View style={s.ratingActions}>
            <TouchableOpacity style={s.cancelRateBtn} onPress={() => setShowRating(false)}>
              <Text style={s.cancelRateText}>{t('later')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.submitRateBtn, submitting && { opacity: 0.6 }]} onPress={handleRate} disabled={submitting}>
              <Text style={s.submitRateText}>{submitting ? t('submittingRating') : t('submitRating')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {canCancel && (
        <TouchableOpacity style={n.cancelLink} onPress={handleCancel} accessibilityRole="button">
          <Text style={[n.cancelLinkText, { color: b.dangerText }]}>{t('cancelOrder')}</Text>
        </TouchableOpacity>
      )}

      {!canCancel && order.status !== 'cancelled' && order.status !== 'delivered' && (
        <View style={s.noCancelCard}>
          <Text style={s.noCancelText}>⚠️ {t('cannotCancelStatus')} "{status.label}"</Text>
          <Text style={s.noCancelSub}>{t('cannotCancelHint')}</Text>
        </View>
      )}
    </ScrollView>
    {AlertComponent}
    </>
  )
}

const n = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  title: { fontSize: 18, fontFamily: F.display },
  date: { fontSize: 11.5, fontFamily: F.regular, marginTop: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, height: SIZE.S - 4, paddingHorizontal: 10, borderRadius: 13, maxWidth: 150 },
  statusPillText: { fontSize: 11.5, fontFamily: F.bold },
  gift: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', height: 28, paddingHorizontal: 12, borderRadius: 14, marginBottom: 10 },
  giftText: { fontSize: 12, fontFamily: F.bold },
  card: { marginBottom: 12, padding: 14 },
  eyebrow: { fontSize: 11, fontFamily: F.bold },
  nowRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  nowTitle: { fontSize: 15, fontFamily: F.display },
  nowSub: { fontSize: 12, fontFamily: F.regular, marginTop: 1 },
  stepRow: { flexDirection: 'row', gap: 10 },
  stepDot: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  stepLine: { width: 2, height: 14 },
  stepText: { flex: 1, fontSize: 13, fontFamily: F.bold, paddingTop: 4 },
  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderTopWidth: 1, marginTop: 12, paddingTop: 10 },
  moreText: { fontSize: 12.5, fontFamily: F.bold },
  mapWrap: { height: 160, borderRadius: 14, overflow: 'hidden' },
  mapChip: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 24, borderRadius: 9 },
  mapChipText: { fontSize: 10.5, fontFamily: F.bold },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#0EA5E9', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 16, fontFamily: F.display },
  driverName: { fontSize: 14, fontFamily: F.bold },
  driverSub: { fontSize: 11.5, fontFamily: F.regular },
  stats: { flexDirection: 'row', gap: 8, marginTop: 10 },
  stat: { flex: 1, borderRadius: 12, paddingVertical: 7, paddingHorizontal: 10 },
  statValue: { fontSize: 14.5, fontFamily: F.display },
  statLabel: { fontSize: 10.5, fontFamily: F.regular },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  lineLabel: { fontSize: 13, fontFamily: F.medium, flexShrink: 1 },
  lineValue: { fontSize: 13, fontFamily: F.bold },
  totalLine: { borderTopWidth: 1, borderStyle: 'dashed', marginTop: 4, paddingTop: 10 },
  totalLabel: { fontSize: 14, fontFamily: F.display },
  totalValue: { fontSize: 19, fontFamily: F.display },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 10, height: SIZE.M, marginTop: 8 },
  payText: { flex: 1, fontSize: 13, fontFamily: F.bold },
  notes: { fontSize: 12, fontFamily: F.regular, marginTop: 8 },
  cancelLink: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 20, marginTop: 4 },
  cancelLinkText: { fontSize: 13.5, fontFamily: F.bold },
})

function DetailRow({ label, value, highlight, warn, colors: c }: { label: string; value: string; highlight?: boolean; warn?: boolean; colors: any }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.navy[700] }}>
      <Text style={{ fontSize: 13, color: c.navy[300] }}>{label}</Text>
      <Text style={[{ fontSize: 13, color: c.text, fontWeight: '500', maxWidth: '60%', textAlign: 'left' }, highlight && { color: c.primary, fontWeight: '700' as const }, warn && { color: '#ef4444', fontWeight: '700' as const }]}>{value}</Text>
    </View>
  )
}

function getStyles(colors: any) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900] },
  content: { padding: 20, paddingTop: 56, paddingBottom: 40 },
  loadingText: { color: colors.navy[300], textAlign: 'center', marginTop: 100, fontSize: 16 },
  backBtn: { marginBottom: 16 },
  backText: { color: colors.primary, fontSize: 16, fontWeight: '600' },

  headerCard: {
    backgroundColor: colors.navy[800], borderRadius: 20, padding: 24,
    alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.navy[700], marginBottom: 16,
  },
  orderNumber: { fontSize: 22, fontWeight: '800', color: colors.text },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  statusLabel: { fontSize: 14, fontWeight: '700' },

  timelineCard: {
    backgroundColor: colors.navy[800], borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: colors.navy[700], marginBottom: 16,
  },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 40 },
  timelineLeft: { alignItems: 'center', width: 24, marginLeft: 8 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.navy[600], borderWidth: 2, borderColor: colors.navy[500] },
  dotDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  dotCurrent: { backgroundColor: colors.accent, borderColor: colors.accent, width: 16, height: 16, borderRadius: 8 },
  line: { width: 2, flex: 1, backgroundColor: colors.navy[600], marginVertical: 2 },
  lineDone: { backgroundColor: colors.primary },
  timelineLabel: { fontSize: 13, color: colors.navy[400], marginRight: 12, paddingTop: 0 },
  timelineLabelDone: { color: colors.navy[100] },
  timelineLabelCurrent: { color: colors.text, fontWeight: '700' },

  detailsCard: {
    backgroundColor: colors.navy[800], borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: colors.navy[700], marginBottom: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.navy[700] },
  detailLabel: { fontSize: 13, color: colors.navy[300] },
  detailValue: { fontSize: 13, color: colors.text, fontWeight: '500', maxWidth: '60%', textAlign: 'left' },

  driverInfoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.navy[700] },
  driverInfoLeft: { flex: 1, gap: 4 },
  driverInfoName: { fontSize: 15, color: colors.text, fontWeight: '700' },
  driverInfoPhone: { fontSize: 14, color: colors.primary, fontWeight: '500' },

  rateBtn: {
    backgroundColor: colors.accent, borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 16,
  },
  rateBtnText: { color: colors.text, fontSize: 16, fontWeight: '700' },

  ratingLabel: { fontSize: 14, color: colors.navy[100], marginBottom: 8, marginTop: 8 },
  starsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  star: { fontSize: 28, color: colors.navy[400] },
  starActive: { color: '#f59e0b' },
  ratingInput: {
    backgroundColor: colors.navy[700], borderRadius: 12, padding: 12,
    color: colors.text, fontSize: 14, minHeight: 60, marginTop: 8,
  },
  ratingActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelRateBtn: { flex: 1, borderWidth: 1, borderColor: colors.navy[500], borderRadius: 12, padding: 12, alignItems: 'center' },
  cancelRateText: { color: colors.navy[200], fontSize: 14, fontWeight: '600' },
  submitRateBtn: { flex: 2, backgroundColor: colors.accent, borderRadius: 12, padding: 12, alignItems: 'center' },
  submitRateText: { color: colors.text, fontSize: 14, fontWeight: '700' },

  chatBtn: {
    backgroundColor: colors.primary + '15', borderRadius: 12, padding: 12, alignItems: 'center', marginTop: 12,
    borderWidth: 1, borderColor: colors.primary + '30',
  },
  chatBtnText: { color: colors.primary, fontSize: 14, fontWeight: '700' },

  cancelBtn: {
    borderWidth: 1.5, borderColor: colors.danger, borderRadius: 16,
    padding: 16, alignItems: 'center', marginTop: 8,
  },
  cancelText: { color: colors.danger, fontSize: 16, fontWeight: '700' },

  noCancelCard: {
    backgroundColor: colors.warning + '12', borderRadius: 14, padding: 16, marginTop: 8,
    borderWidth: 1, borderColor: colors.warning + '30',
  },
  noCancelText: { fontSize: 14, fontWeight: '700', color: colors.warning, marginBottom: 6 },
  noCancelSub: { fontSize: 12, color: colors.navy[300], lineHeight: 18 },

  retryPayBtn: {
    backgroundColor: '#f59e0b', borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 12,
  },
  retryPayText: { color: colors.text, fontSize: 15, fontWeight: '700' },

  editBtn: {
    backgroundColor: colors.navy[800], borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 16,
    borderWidth: 1.5, borderColor: colors.primary,
  },
  editBtnText: { color: colors.primary, fontSize: 15, fontWeight: '700' },

  trackingCard: {
    backgroundColor: colors.navy[800], borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: colors.primary + '30', marginBottom: 16, overflow: 'hidden',
  },
  trackingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  expandHint: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  mapWrapper: { borderRadius: 14, overflow: 'hidden', height: 240, marginBottom: 14 },
  map: { flex: 1 },
  etaRow: { flexDirection: 'row', justifyContent: 'space-around' },
  etaItem: { alignItems: 'center', gap: 4 },
  etaValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  etaLabel: { fontSize: 11, color: colors.navy[300] },
}) }
