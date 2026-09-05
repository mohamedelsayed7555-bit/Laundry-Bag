import { useEffect, useState, useRef } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Linking } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { WebView } from 'react-native-webview'
import { useAuth } from '../../src/contexts/AuthContext'
import { useTheme } from '../../src/contexts/ThemeContext'
import { useCustomAlert } from '../../src/components/CustomAlert'
import { ActivityIndicator } from 'react-native'
import { supabase } from '../../src/lib/supabase'
import { CANCELLABLE_STATUSES } from '../../src/shared/types'

const SUPABASE_URL = 'https://kjqtrmedkvqfofwymoni.supabase.co'

function buildTrackingMapHTML(driverLat: number, driverLng: number, customerLat?: number, customerLng?: number) {
  const centerLat = customerLat ? (driverLat + customerLat) / 2 : driverLat
  const centerLng = customerLng ? (driverLng + customerLng) / 2 : driverLng
  const zoom = customerLat ? 14 : 15
  const customerMarker = customerLat && customerLng
    ? `var custMarker = L.marker([${customerLat}, ${customerLng}], {
        icon: L.divIcon({ className: '', html: '<div style="background:#10b981;width:14px;height:14px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>', iconSize: [14, 14], iconAnchor: [7, 7] })
      }).addTo(map).bindPopup('موقعك');`
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
  }).addTo(map).bindPopup('السائق');
  ${customerMarker}
  window.updateDriver = function(lat, lng) {
    driverMarker.setLatLng([lat, lng]);
    ${customerLat ? `var bounds = L.latLngBounds([[lat, lng], [${customerLat}, ${customerLng}]]); map.fitBounds(bounds, {padding: [30, 30]});` : `map.setView([lat, lng], 15);`}
  };
<\/script>
</body></html>`
}

const statusConfig: Record<string, { label: string; color: string; icon: string; step: number }> = {
  pending:    { label: 'في الانتظار',     color: '#f59e0b', icon: '⏳', step: 0 },
  assigned:   { label: 'تم تعيين سائق',   color: '#3b82f6', icon: '🚗', step: 1 },
  picked_up:  { label: 'تم الاستلام',     color: '#8b5cf6', icon: '📦', step: 2 },
  processing: { label: 'جاري المعالجة',   color: '#06b6d4', icon: '🔄', step: 3 },
  ready:      { label: 'جاهز للتوصيل',   color: '#10b981', icon: '✅', step: 4 },
  delivering: { label: 'جاري التوصيل',   color: '#8b5cf6', icon: '🛵', step: 5 },
  delivered:  { label: 'تم التوصيل',     color: '#10b981', icon: '🎉', step: 6 },
  cancelled:  { label: 'ملغي',           color: '#ef4444', icon: '❌', step: -1 },
}

const serviceLabel: Record<string, string> = {
  wash: 'غسيل', iron: 'كي', wash_iron: 'غسيل وكي', dry_clean: 'تنظيف جاف',
}

const steps = ['pending', 'assigned', 'picked_up', 'processing', 'ready', 'delivering', 'delivered']

export default function OrderDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { profile } = useAuth()
  const { colors } = useTheme()
  const router = useRouter()
  const { showAlert, AlertComponent } = useCustomAlert()
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showRating, setShowRating] = useState(false)
  const [ratingService, setRatingService] = useState(0)
  const [ratingDriver, setRatingDriver] = useState(0)
  const [ratingNote, setRatingNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [driverLoc, setDriverLoc] = useState<{ lat: number; lng: number } | null>(null)
  const [retrying, setRetrying] = useState(false)
  const mapWebviewRef = useRef<WebView>(null)

  useEffect(() => {
    loadOrder()
    const channel = supabase
      .channel(`order-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, () => loadOrder())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id])

  useEffect(() => {
    if (!order?.driver_id || !['assigned', 'picked_up', 'delivering'].includes(order?.status)) {
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
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [order?.driver_id, order?.status])

  useEffect(() => {
    if (driverLoc && mapWebviewRef.current) {
      mapWebviewRef.current.injectJavaScript(`window.updateDriver && window.updateDriver(${driverLoc.lat}, ${driverLoc.lng}); true;`)
    }
  }, [driverLoc])

  async function loadOrder() {
    const { data } = await supabase
      .from('orders')
      .select('*, driver:users!orders_driver_id_fkey(name, phone)')
      .eq('id', id)
      .single()
    setOrder(data)
    setLoading(false)
  }

  async function handleCancel() {
    const driverArrived = ['picked_up'].includes(order.status)
    const fee = driverArrived ? Number(order.delivery_fee ?? 0) : 0

    const message = driverArrived
      ? `السائق استلم الطلب بالفعل.\n\nفي حالة الإلغاء هتدفع رسوم التوصيل فقط:\n💰 ${fee.toFixed(2)} ج.م\n\nهل تريد الإلغاء؟`
      : 'هل أنت متأكد من إلغاء هذا الطلب؟\n\nالإلغاء مجاني قبل استلام السائق.'

    showAlert({ title: 'إلغاء الطلب', message, type: 'confirm', buttons: [
      { text: 'لا، رجوع', style: 'cancel' },
      {
        text: driverArrived ? `إلغاء ودفع ${fee.toFixed(2)} ج.م` : 'نعم، إلغاء',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('orders').update({
            status: 'cancelled',
            cancellation_reason: driverArrived ? 'إلغاء بعد الاستلام — رسوم توصيل' : 'إلغاء بواسطة العميل',
            cancellation_fee: fee,
            cancelled_at: new Date().toISOString(),
          }).eq('id', id)
          if (error) {
            showAlert({ title: 'خطأ', message: 'حدث خطأ أثناء الإلغاء', type: 'error' })
          } else {
            if (driverArrived) {
              showAlert({
                title: 'تم الإلغاء',
                message: `تم إلغاء الطلب.\nرسوم التوصيل: ${fee.toFixed(2)} ج.م`,
                type: 'warning',
                buttons: [{ text: 'حسناً', onPress: () => loadOrder() }],
              })
            } else {
              showAlert({
                title: 'تم الإلغاء',
                message: 'تم إلغاء طلبك بنجاح بدون أي رسوم.',
                type: 'success',
                buttons: [{ text: 'حسناً', onPress: () => loadOrder() }],
              })
            }
          }
        }
      },
    ] })
  }

  async function handleRate() {
    if (ratingService === 0) { showAlert({ title: 'خطأ', message: 'اختر تقييم الخدمة', type: 'error' }); return }
    setSubmitting(true)
    const { error } = await supabase.from('orders').update({
      rating_service: ratingService,
      rating_driver: ratingDriver || null,
      rating_note: ratingNote || null,
      rated_at: new Date().toISOString(),
    }).eq('id', id)
    setSubmitting(false)
    if (error) showAlert({ title: 'خطأ', message: 'حدث خطأ', type: 'error' })
    else { setShowRating(false); loadOrder() }
  }

  async function handleRetryPayment() {
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
        }),
      })
      const data = await res.json()
      setRetrying(false)
      if (data.iframe_url) {
        router.push({ pathname: '/payment', params: { url: data.iframe_url } })
      } else {
        showAlert({ title: 'خطأ', message: data.error || 'حدث خطأ في الاتصال بخدمة الدفع', type: 'error' })
      }
    } catch {
      setRetrying(false)
      showAlert({ title: 'خطأ', message: 'حدث خطأ في الاتصال بخدمة الدفع', type: 'error' })
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

  if (loading) return <View style={s.container}><Text style={s.loadingText}>جاري التحميل...</Text></View>
  if (!order) return <View style={s.container}><Text style={s.loadingText}>الطلب غير موجود</Text></View>

  const status = statusConfig[order.status] ?? statusConfig.pending
  const canCancel = CANCELLABLE_STATUSES.includes(order.status)
  const canRate = order.status === 'delivered' && !order.rated_at

  return (
    <>
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
        <Text style={s.backText}>→ رجوع</Text>
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
          <Text style={s.sectionTitle}>تتبع الطلب</Text>
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

      {driverLoc && ['assigned', 'picked_up', 'delivering'].includes(order.status) && (
        <TouchableOpacity
          style={s.trackingCard}
          activeOpacity={0.8}
          onPress={() => router.push(`/tracking/${order.id}`)}
        >
          <View style={s.trackingHeader}>
            <Text style={s.sectionTitle}>تتبع السائق</Text>
            <Text style={s.expandHint}>اضغط للتكبير ←</Text>
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
                <Text style={s.etaValue}>{distanceKm < 1 ? `${Math.round(distanceKm * 1000)} م` : `${distanceKm.toFixed(1)} كم`}</Text>
                <Text style={s.etaLabel}>المسافة</Text>
              </View>
            )}
            {etaMinutes !== null && (
              <View style={s.etaItem}>
                <Text style={[s.etaValue, { color: colors.primary }]}>{etaMinutes} د</Text>
                <Text style={s.etaLabel}>الوقت المتوقع</Text>
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
        <Text style={s.sectionTitle}>تفاصيل الطلب</Text>
        <DetailRow colors={colors} label="الخدمة" value={serviceLabel[order.service_type] ?? order.service_type} />
        <DetailRow colors={colors} label="عدد القطع" value={String(order.items_count)} />
        {order.delivery_fee > 0 && <DetailRow colors={colors} label="رسوم التوصيل" value={`${Number(order.delivery_fee).toFixed(2)} ج.م`} />}
        <DetailRow colors={colors} label="الإجمالي" value={`${order.total?.toFixed(2)} ج.م`} highlight />
        <DetailRow colors={colors} label="طريقة الدفع" value={{ cash: 'كاش', visa: 'فيزا', e_wallet: 'محفظة إلكترونية', instapay: 'إنستاباي', wallet: 'محفظة' }[order.payment_method] ?? order.payment_method} />
        <DetailRow colors={colors} label="حالة الدفع" value={{ confirmed: 'مؤكد', refunded: 'مسترد', failed: 'فشل', pending: 'معلق' }[order.payment_status] ?? 'معلق'} />
        {order.status === 'cancelled' && order.cancellation_fee > 0 && (
          <DetailRow colors={colors} label="رسوم الإلغاء" value={`${Number(order.cancellation_fee).toFixed(2)} ج.م`} highlight />
        )}
        <DetailRow colors={colors} label="التاريخ" value={new Date(order.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} />
        {order.notes && <DetailRow colors={colors} label="ملاحظات" value={order.notes} />}
      </View>

      {order.payment_status === 'pending' && ['visa', 'e_wallet'].includes(order.payment_method) && order.status !== 'cancelled' && (
        <TouchableOpacity
          style={[s.retryPayBtn, retrying && { opacity: 0.6 }]}
          onPress={handleRetryPayment}
          disabled={retrying}
        >
          {retrying ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={s.retryPayText}>💳 إعادة الدفع</Text>
          )}
        </TouchableOpacity>
      )}

      {['pending', 'assigned'].includes(order.status) && (
        <TouchableOpacity style={s.editBtn} onPress={() => router.push(`/edit-order/${order.id}`)}>
          <Text style={s.editBtnText}>✏️ تعديل الطلب</Text>
        </TouchableOpacity>
      )}

      {order.driver && (
        <View style={s.detailsCard}>
          <Text style={s.sectionTitle}>السائق</Text>
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
            <Text style={s.chatBtnText}>💬 محادثة مع السائق</Text>
          </TouchableOpacity>
        </View>
      )}

      {order.rated_at && (
        <View style={s.detailsCard}>
          <Text style={s.sectionTitle}>التقييم</Text>
          <DetailRow colors={colors} label="تقييم الخدمة" value={'⭐'.repeat(order.rating_service)} />
          {order.rating_driver && <DetailRow colors={colors} label="تقييم السائق" value={'⭐'.repeat(order.rating_driver)} />}
          {order.rating_note && <DetailRow colors={colors} label="ملاحظات" value={order.rating_note} />}
        </View>
      )}

      {canRate && !showRating && (
        <TouchableOpacity style={s.rateBtn} onPress={() => setShowRating(true)}>
          <Text style={s.rateBtnText}>⭐ قيّم الطلب</Text>
        </TouchableOpacity>
      )}

      {showRating && (
        <View style={s.detailsCard}>
          <Text style={s.sectionTitle}>تقييم الطلب</Text>

          <Text style={s.ratingLabel}>تقييم الخدمة</Text>
          <View style={s.starsRow}>
            {[1, 2, 3, 4, 5].map(n => (
              <TouchableOpacity key={n} onPress={() => setRatingService(n)}>
                <Text style={[s.star, n <= ratingService && s.starActive]}>{n <= ratingService ? '⭐' : '☆'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {order.driver && (
            <>
              <Text style={s.ratingLabel}>تقييم السائق</Text>
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
            placeholder="ملاحظاتك (اختياري)..."
            placeholderTextColor={colors.navy[400]}
            value={ratingNote}
            onChangeText={setRatingNote}
            multiline
            textAlign="right"
          />

          <View style={s.ratingActions}>
            <TouchableOpacity style={s.cancelRateBtn} onPress={() => setShowRating(false)}>
              <Text style={s.cancelRateText}>إلغاء</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.submitRateBtn, submitting && { opacity: 0.6 }]} onPress={handleRate} disabled={submitting}>
              <Text style={s.submitRateText}>{submitting ? 'جاري الإرسال...' : 'إرسال التقييم'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {canCancel && (
        <TouchableOpacity style={s.cancelBtn} onPress={handleCancel}>
          <Text style={s.cancelText}>إلغاء الطلب</Text>
        </TouchableOpacity>
      )}

      {!canCancel && order.status !== 'cancelled' && order.status !== 'delivered' && (
        <View style={s.noCancelCard}>
          <Text style={s.noCancelText}>⚠️ لا يمكن إلغاء الطلب في حالة "{status.label}"</Text>
          <Text style={s.noCancelSub}>يمكن الإلغاء فقط قبل بدء المعالجة. بعد استلام السائق يتم خصم رسوم التوصيل فقط. تواصل مع الدعم لأي مساعدة.</Text>
        </View>
      )}
    </ScrollView>
    {AlertComponent}
    </>
  )
}

function DetailRow({ label, value, highlight, colors: c }: { label: string; value: string; highlight?: boolean; colors: any }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.navy[700] }}>
      <Text style={{ fontSize: 13, color: c.navy[300] }}>{label}</Text>
      <Text style={[{ fontSize: 13, color: c.text, fontWeight: '500', maxWidth: '60%', textAlign: 'left' }, highlight && { color: c.primary, fontWeight: '700' as const }]}>{value}</Text>
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
