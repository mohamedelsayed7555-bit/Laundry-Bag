import { useEffect, useState, useRef, useMemo } from 'react'
import { View, Text, StyleSheet, Linking } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Car, Phone, MessageCircle, MapPin, TriangleAlert } from 'lucide-react-native'
import { useBrand, IconButton, BackIcon, cardShadow, F } from '../../src/components/brand'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { WebView } from 'react-native-webview'
import { supabase } from '../../src/lib/supabase'
import { useLanguage } from '../../src/contexts/LanguageContext'

function buildFullTrackingMapHTML(driverLat: number, driverLng: number, customerLat?: number, customerLng?: number, driverName?: string) {
  const centerLat = customerLat ? (driverLat + customerLat) / 2 : driverLat
  const centerLng = customerLng ? (driverLng + customerLng) / 2 : driverLng
  const zoom = customerLat ? 14 : 15
  const customerMarker = customerLat && customerLng
    ? `var custMarker = L.marker([${customerLat}, ${customerLng}], {
        icon: L.divIcon({ className: '', html: '<div style="background:#10b981;width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4)"></div>', iconSize: [16, 16], iconAnchor: [8, 8] })
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
  var map = L.map('map').setView([${centerLat}, ${centerLng}], ${zoom});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19}).addTo(map);
  var driverMarker = L.marker([${driverLat}, ${driverLng}], {
    icon: L.divIcon({ className: '', html: '<div style="background:#3b82f6;width:18px;height:18px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.5)"></div>', iconSize: [18, 18], iconAnchor: [9, 9] })
  }).addTo(map).bindPopup('${driverName ?? 'السائق'}');
  ${customerMarker}
  window.updateDriver = function(lat, lng) {
    driverMarker.setLatLng([lat, lng]);
    ${customerLat ? `var bounds = L.latLngBounds([[lat, lng], [${customerLat}, ${customerLng}]]); map.fitBounds(bounds, {padding: [40, 40]});` : `map.setView([lat, lng], 15);`}
  };
<\/script>
</body></html>`
}

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

const statusLabels: Record<string, { ar: string; en: string }> = {
  assigned: { ar: 'في الطريق للاستلام', en: 'On the way to pick up' },
  arrived: { ar: 'السائق وصل موقعك', en: 'Driver arrived at your location' },
  picked_up: { ar: 'تم استلام الطلب', en: 'Order picked up' },
  delivering: { ar: 'في الطريق إليك', en: 'On the way to you' },
}

export default function TrackingScreen() {
  const b = useBrand()
  const insets = useSafeAreaInsets()
  const { locale } = useLanguage()
  const isEn = locale === 'en'
  const { orderId } = useLocalSearchParams<{ orderId: string }>()
  const router = useRouter()
  const mapWebviewRef = useRef<WebView>(null)
  const [order, setOrder] = useState<any>(null)
  const [driverLoc, setDriverLoc] = useState<{ lat: number; lng: number; at?: string | null } | null>(null)
  const [mapSeed, setMapSeed] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    loadOrder()
    const ch = supabase
      .channel(`tracking-order-${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, () => loadOrder())
      .subscribe((status, err) => {
        if (err) console.warn('tracking-order realtime error:', err.message)
      })
    return () => { supabase.removeChannel(ch) }
  }, [orderId])

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
      .channel(`tracking-loc-${order.driver_id}`)
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
        if (err) console.warn('tracking-loc realtime error:', err.message)
      })
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
      .select('id, order_number, status, driver_id, pickup_location, delivery_location, driver:users!orders_driver_id_fkey(name, phone)')
      .eq('id', orderId)
      .single()
    setOrder(data)
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
  const distanceKm = driverLoc && customerLat && customerLng
    ? getDistance(driverLoc.lat, driverLoc.lng, customerLat, customerLng)
    : null
  const etaMinutes = distanceKm !== null ? Math.max(1, Math.round(distanceKm / 0.5)) : null

  const showMap = !!driverLoc && !!mapSeed && TRACK_STATUSES.includes(order?.status)
  // Built once per order/phase; later positions go through window.updateDriver
  const mapHtml = useMemo(
    () => (mapSeed ? buildFullTrackingMapHTML(mapSeed.lat, mapSeed.lng, customerLat, customerLng, order?.driver?.name) : ''),
    [mapSeed, customerLat, customerLng, order?.driver?.name],
  )

  const statusText = statusLabels[order?.status] ? (isEn ? statusLabels[order.status].en : statusLabels[order.status].ar) : order?.status

  return (
    <View style={[n.container, { backgroundColor: b.page }]}>
      {/* Map fills the screen; the panel floats over it */}
      {showMap ? (
        <WebView
          ref={mapWebviewRef}
          source={{ html: mapHtml }}
          onLoadEnd={() => driverLoc && mapWebviewRef.current?.injectJavaScript(`window.updateDriver && window.updateDriver(${driverLoc.lat}, ${driverLoc.lng}); true;`)}
          style={n.map}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          originWhitelist={['*']}
        />
      ) : (
        <View style={[n.noMap, { backgroundColor: b.page }]}>
          <View style={[n.noMapIcon, { backgroundColor: b.iconTile }]}><MapPin size={34} color={b.faint} /></View>
          <Text style={[n.noMapTitle, { color: b.ink }]}>{isEn ? 'Driver location unavailable' : 'موقع السائق غير متاح'}</Text>
          <Text style={[n.noMapText, { color: b.muted }]}>
            {isEn ? "We'll show the map as soon as your driver is on the way" : 'الخريطة هتظهر أول ما السائق يتحرك ناحيتك'}
          </Text>
        </View>
      )}

      {/* Floating header */}
      <View style={[n.overlay, { top: insets.top + 8 }]}>
        <IconButton onPress={() => router.back()} label={isEn ? 'Back' : 'رجوع'} style={cardShadow(b)}>
          <BackIcon color={b.ink} />
        </IconButton>
        <View style={[n.statusChip, { backgroundColor: b.card }, cardShadow(b)]}>
          <Car size={15} color={b.tintText} />
          <Text style={[n.statusChipText, { color: b.ink }]} numberOfLines={1}>{statusText}</Text>
        </View>
      </View>

      {/* Driver panel */}
      <View style={[n.panel, { backgroundColor: b.card, borderTopColor: b.cardBorder, paddingBottom: Math.max(insets.bottom, 12) + 14 }]}>
        <View style={[n.grab, { backgroundColor: b.cardBorder }]} />

        {order?.driver && (
          <View style={n.driverRow}>
            <LinearGradient colors={['#38BDF8', '#0284C7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={n.avatar}>
              <Text style={n.avatarText}>{order.driver.name?.[0] ?? '؟'}</Text>
            </LinearGradient>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[n.driverName, { color: b.ink }]} numberOfLines={1}>{order.driver.name}</Text>
              <Text style={[n.driverSub, { color: b.tintText }]} numberOfLines={1}>{statusText}</Text>
            </View>
            {order.driver.phone ? (
              <IconButton tone="tint" label={isEn ? 'Call driver' : 'اتصل بالسائق'} onPress={() => Linking.openURL(`tel:${order.driver.phone}`)}>
                <Phone size={17} color={b.okText} />
              </IconButton>
            ) : null}
            <IconButton tone="tint" label={isEn ? 'Chat' : 'محادثة'} onPress={() => router.push(`/chat/${orderId}`)}>
              <MessageCircle size={17} color={b.tintText} />
            </IconButton>
          </View>
        )}

        <View style={n.stats}>
          <View style={[n.stat, { backgroundColor: b.iconTile }]}>
            <Text style={[n.statValue, { color: b.ink }]}>
              {distanceKm !== null ? (distanceKm < 1 ? `${Math.round(distanceKm * 1000)} ${isEn ? 'm' : 'م'}` : `${distanceKm.toFixed(1)} ${isEn ? 'km' : 'كم'}`) : '—'}
            </Text>
            <Text style={[n.statLabel, { color: b.muted }]}>{isEn ? 'Distance' : 'المسافة'}</Text>
          </View>
          <View style={[n.stat, { backgroundColor: b.iconTile }]}>
            <Text style={[n.statValue, { color: stale ? b.muted : b.ink }]}>{etaMinutes !== null ? `~${etaMinutes} ${isEn ? 'min' : 'د'}` : '—'}</Text>
            <Text style={[n.statLabel, { color: b.muted }]}>{isEn ? 'ETA' : 'الوقت المتوقع'}</Text>
          </View>
          <View style={[n.stat, { backgroundColor: b.iconTile }]}>
            <Text style={[n.statValue, { color: b.ink }]} numberOfLines={1}>{'⁦'}#{String(order?.order_number ?? '').replace(/^#+/, '')}{'⁩'}</Text>
            <Text style={[n.statLabel, { color: b.muted }]}>{isEn ? 'Order' : 'رقم الطلب'}</Text>
          </View>
        </View>

        {stale !== null && (
          <View style={[n.stale, { backgroundColor: b.warnTint }]}>
            <TriangleAlert size={15} color={b.warnText} />
            <Text style={[n.staleText, { color: b.warnText }]}>
              {isEn ? `Driver location last updated ${stale} min ago` : `آخر تحديث لموقع السائق من ${stale} دقيقة`}
            </Text>
          </View>
        )}
      </View>
    </View>
  )
}

const n = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  overlay: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 3 },
  statusChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 36, borderRadius: 12, paddingHorizontal: 12 },
  statusChipText: { fontSize: 12.5, fontFamily: F.bold },
  noMap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  noMapIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  noMapTitle: { fontSize: 16, fontFamily: F.display },
  noMapText: { fontSize: 13, fontFamily: F.regular, textAlign: 'center', marginTop: 4, lineHeight: 21 },
  panel: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, paddingHorizontal: 14, paddingTop: 8, zIndex: 3 },
  grab: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 16, fontFamily: F.display },
  driverName: { fontSize: 14.5, fontFamily: F.bold },
  driverSub: { fontSize: 11.5, fontFamily: F.semibold, marginTop: 1 },
  stats: { flexDirection: 'row', gap: 8, marginTop: 12 },
  stat: { flex: 1, borderRadius: 13, paddingVertical: 8, paddingHorizontal: 8, alignItems: 'center' },
  statValue: { fontSize: 14.5, fontFamily: F.display },
  statLabel: { fontSize: 10.5, fontFamily: F.regular, marginTop: 1 },
  stale: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, marginTop: 10 },
  staleText: { flex: 1, fontSize: 11.5, fontFamily: F.bold },
})
