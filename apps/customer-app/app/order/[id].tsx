import { useEffect, useState, useRef } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Linking } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { WebView } from 'react-native-webview'
import { useAuth } from '../../src/contexts/AuthContext'
import { useTheme } from '../../src/contexts/ThemeContext'
import { useLanguage } from '../../src/contexts/LanguageContext'
import { useCustomAlert } from '../../src/components/CustomAlert'
import { ActivityIndicator } from 'react-native'
import { supabase } from '../../src/lib/supabase'
import { CANCELLABLE_STATUSES } from '../../src/shared/types'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!

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
  }

  const serviceLabel: Record<string, string> = {
    wash: t('wash'), iron: t('ironOnly'), wash_iron: t('washIron'), dry_clean: t('dryClean'), tailor: t('tailor'),
  }
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showRating, setShowRating] = useState(false)
  const [ratingService, setRatingService] = useState(0)
  const [ratingDriver, setRatingDriver] = useState(0)
  const [ratingNote, setRatingNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [driverLoc, setDriverLoc] = useState<{ lat: number; lng: number } | null>(null)
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
    if (!order?.driver_id || !['assigned', 'arrived', 'picked_up', 'delivering'].includes(order?.status)) {
      setDriverLoc(null)
      return
    }
    supabase.from('driver_locations').select('lat, lng').eq('driver_id', order.driver_id).single()
      .then(({ data }) => { if (data) setDriverLoc(data) })

    const ch = supabase
      .channel(`driver-loc-${order.driver_id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'driver_locations',
        filter: `driver_id=eq.${order.driver_id}`,
      }, (payload: any) => {
        const loc = payload.new
        if (loc?.lat && loc?.lng) setDriverLoc({ lat: loc.lat, lng: loc.lng })
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
      .select('id, order_number, status, service_type, items_count, total, delivery_fee, cancellation_fee, notes, payment_method, payment_status, driver_id, rated_at, rating_service, rating_driver, rating_note, created_at, delivery_location, subscription_id, order_type, driver:users!orders_driver_id_fkey(name, phone)')
      .eq('id', id)
      .eq('customer_id', profile.id)
      .single()
    setOrder(data)
    setLoading(false)
  }

  async function handleCancel() {
    const driverArrived = ['picked_up'].includes(order.status)
    const fee = driverArrived ? Number(order.delivery_fee ?? 0) : 0

    const message = driverArrived
      ? `${t('driverPickedUp')} ${fee.toFixed(2)} ${t('currency')}`
      : t('cancelFree')

    showAlert({ title: t('cancelOrderTitle'), message, type: 'confirm', buttons: [
      { text: t('noGoBack'), style: 'cancel' },
      {
        text: driverArrived ? `${t('yesCancelPay')} ${fee.toFixed(2)} ${t('currency')}` : t('yesCancel'),
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('orders').update({
            status: 'cancelled',
            cancellation_reason: driverArrived ? 'إلغاء بعد الاستلام — رسوم توصيل' : 'إلغاء بواسطة العميل',
            cancellation_fee: fee,
            cancelled_at: new Date().toISOString(),
          }).eq('id', id).eq('customer_id', profile!.id)
          if (error) {
            showAlert({ title: t('error'), message: t('connectionError'), type: 'error' })
          } else {
            if (order.subscription_id && order.items_count > 0) {
              const { data: sub } = await supabase.from('subscriptions').select('items_used').eq('id', order.subscription_id).single()
              if (sub) {
                const currentUsed = sub.items_used ?? 0
                const newUsed = Math.max(0, currentUsed - order.items_count)
                await supabase.from('subscriptions').update({ items_used: newUsed }).eq('id', order.subscription_id).eq('items_used', currentUsed)
              }
            }
            if (driverArrived) {
              showAlert({
                title: t('cancelledDone'),
                message: `${t('cancelledWithFee')} ${fee.toFixed(2)} ${t('currency')}`,
                type: 'warning',
                buttons: [{ text: t('ok'), onPress: () => loadOrder() }],
              })
            } else {
              showAlert({
                title: t('cancelledDone'),
                message: t('cancelledFreeMsg'),
                type: 'success',
                buttons: [{ text: t('ok'), onPress: () => loadOrder() }],
              })
            }
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
        router.push({ pathname: '/payment', params: { url: data.iframe_url } })
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

  const customerLat = order?.delivery_location?.lat
  const customerLng = order?.delivery_location?.lng
  const distanceKm = driverLoc && customerLat && customerLng
    ? getDistance(driverLoc.lat, driverLoc.lng, customerLat, customerLng)
    : null
  const etaMinutes = distanceKm !== null ? Math.max(1, Math.round(distanceKm / 0.5)) : null

  const s = getStyles(colors)

  if (loading) return <View style={s.container}><Text style={s.loadingText}>{t('loadingText')}</Text></View>
  if (!order) return <View style={s.container}><Text style={s.loadingText}>{t('orderNotFound')}</Text></View>

  const status = statusConfig[order.status] ?? statusConfig.pending
  const canCancel = CANCELLABLE_STATUSES.includes(order.status)
  const canRate = order.status === 'delivered' && !order.rated_at

  return (
    <>
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
        <Text style={s.backText}>{t('goBack')}</Text>
      </TouchableOpacity>

      <View style={s.headerCard}>
        <Text style={s.orderNumber}>{order.order_number}</Text>
        <View style={[s.statusBadge, { backgroundColor: status.color + '20' }]}>
          <Text style={{ fontSize: 16 }}>{status.icon}</Text>
          <Text style={[s.statusLabel, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      {order.status !== 'cancelled' && (
        <View style={s.timelineCard}>
          <Text style={s.sectionTitle}>{t('trackOrder')}</Text>
          {steps.map((stepKey, i) => {
            const stepStatus = statusConfig[stepKey]
            const currentStep = statusConfig[order.status]?.step ?? 0
            const isDone = currentStep >= stepStatus.step
            const isCurrent = order.status === stepKey
            return (
              <View key={stepKey} style={s.timelineRow}>
                <View style={s.timelineLeft}>
                  <View style={[s.dot, isDone && s.dotDone, isCurrent && s.dotCurrent]} />
                  {i < steps.length - 1 && <View style={[s.line, isDone && s.lineDone]} />}
                </View>
                <Text style={[s.timelineLabel, isDone && s.timelineLabelDone, isCurrent && s.timelineLabelCurrent]}>
                  {stepStatus.icon} {stepStatus.label}
                </Text>
              </View>
            )
          })}
        </View>
      )}

      {driverLoc && ['assigned', 'arrived', 'picked_up', 'delivering'].includes(order.status) && (
        <TouchableOpacity
          style={s.trackingCard}
          activeOpacity={0.8}
          onPress={() => router.push(`/tracking/${order.id}`)}
        >
          <View style={s.trackingHeader}>
            <Text style={s.sectionTitle}>{t('trackDriver')}</Text>
            <Text style={s.expandHint}>{t('tapToExpand')}</Text>
          </View>
          <View style={s.mapWrapper}>
            <WebView
              ref={mapWebviewRef}
              source={{ html: buildTrackingMapHTML(driverLoc.lat, driverLoc.lng, customerLat, customerLng) }}
              style={s.map}
              javaScriptEnabled
              domStorageEnabled
              startInLoadingState
              originWhitelist={['*']}
              scrollEnabled={false}
              nestedScrollEnabled
            />
          </View>
          <View style={s.etaRow}>
            {distanceKm !== null && (
              <View style={s.etaItem}>
                <Text style={s.etaValue}>{distanceKm < 1 ? `${Math.round(distanceKm * 1000)} ${isEn ? 'm' : 'م'}` : `${distanceKm.toFixed(1)} ${isEn ? 'km' : 'كم'}`}</Text>
                <Text style={s.etaLabel}>{t('distanceLabel')}</Text>
              </View>
            )}
            {etaMinutes !== null && (
              <View style={s.etaItem}>
                <Text style={[s.etaValue, { color: colors.primary }]}>{etaMinutes} {isEn ? 'min' : 'د'}</Text>
                <Text style={s.etaLabel}>{t('etaLabel')}</Text>
              </View>
            )}
            <View style={s.etaItem}>
              <Text style={s.etaValue}>{statusConfig[order.status]?.icon}</Text>
              <Text style={s.etaLabel}>{statusConfig[order.status]?.label}</Text>
            </View>
          </View>
        </TouchableOpacity>
      )}

      <View style={s.detailsCard}>
        <Text style={s.sectionTitle}>{t('orderInfo')}</Text>
        <DetailRow colors={colors} label={t('service')} value={serviceLabel[order.service_type] ?? order.service_type} />
        <DetailRow colors={colors} label={t('itemsCount')} value={String(order.items_count)} />
        {order.delivery_fee > 0 && <DetailRow colors={colors} label={t('deliveryFee')} value={`${Number(order.delivery_fee).toFixed(2)} ${t('currency')}`} />}
        <DetailRow colors={colors} label={t('total')} value={`${order.total?.toFixed(2)} ${t('currency')}`} highlight />
        <DetailRow colors={colors} label={t('paymentMethodLabel')} value={({ cash: t('pmCash'), visa: t('pmVisa'), e_wallet: t('pmWallet'), instapay: t('pmInstapay'), wallet: t('pmWallet') } as Record<string, string>)[order.payment_method] ?? order.payment_method} />
        <DetailRow colors={colors} label={t('paymentStatusLabel')} value={({ confirmed: t('payStatusConfirmed'), refunded: t('payStatusRefunded'), failed: t('payStatusFailed'), pending: t('payStatusPending') } as Record<string, string>)[order.payment_status] ?? t('payStatusPending')} warn={order.payment_status === 'failed'} />
        {order.status === 'cancelled' && order.cancellation_fee > 0 && (
          <DetailRow colors={colors} label={t('cancellationFee')} value={`${Number(order.cancellation_fee).toFixed(2)} ${t('currency')}`} highlight />
        )}
        <DetailRow colors={colors} label={t('date')} value={new Date(order.created_at).toLocaleDateString(isEn ? 'en-US' : 'ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} />
        {order.notes && <DetailRow colors={colors} label={t('notesLabel')} value={order.notes} />}
      </View>

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

      {['pending', 'assigned'].includes(order.status) && (
        <TouchableOpacity style={s.editBtn} onPress={() => router.push(`/edit-order/${order.id}`)}>
          <Text style={s.editBtnText}>{t('editOrder')}</Text>
        </TouchableOpacity>
      )}

      {order.driver && (
        <View style={s.detailsCard}>
          <Text style={s.sectionTitle}>{t('theDriver')}</Text>
          <View style={s.driverInfoRow}>
            <View style={s.driverInfoLeft}>
              <Text style={s.driverInfoName}>{order.driver.name}</Text>
              {order.driver.phone && (
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${order.driver.phone}`)}>
                  <Text style={s.driverInfoPhone}>{order.driver.phone} 📞</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          <TouchableOpacity style={s.chatBtn} onPress={() => router.push(`/chat/${order.id}`)}>
            <Text style={s.chatBtnText}>{t('chatWithDriver')}</Text>
          </TouchableOpacity>
        </View>
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
        <TouchableOpacity style={s.cancelBtn} onPress={handleCancel}>
          <Text style={s.cancelText}>{t('cancelOrder')}</Text>
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
