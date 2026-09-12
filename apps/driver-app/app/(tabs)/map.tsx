import { useEffect, useState, useCallback, useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native'
import { WebView } from 'react-native-webview'
import { useAuth } from '../../src/contexts/AuthContext'
import { supabase } from '../../src/lib/supabase'
import { colors } from '../../src/theme'

const statusColors: Record<string, string> = {
  assigned: '#3b82f6',
  picked_up: '#8b5cf6',
  ready: '#10b981',
  delivering: '#f59e0b',
}

const statusLabels: Record<string, string> = {
  assigned: 'بانتظار الاستلام',
  picked_up: 'تم الاستلام',
  ready: 'جاهز للتوصيل',
  delivering: 'جاري التوصيل',
}

function buildMapHTML(orders: any[], center: { lat: number; lng: number }) {
  const markers = orders.map(o => {
    const color = statusColors[o.status] ?? '#999'
    const label = statusLabels[o.status] ?? o.status
    return `L.circleMarker([${o.address.lat}, ${o.address.lng}], {
      radius: 10, fillColor: '${color}', color: '#fff', weight: 2, fillOpacity: 0.9
    }).addTo(map).bindPopup('<b>${o.order_number}</b><br>${o.customer?.name ?? ""}<br>${label}')
    .on('click', function() { window.ReactNativeWebView.postMessage(JSON.stringify({type:'select',id:'${o.id}'})); });`
  }).join('\n')

  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  * { margin: 0; padding: 0; }
  #map { width: 100vw; height: 100vh; }
  .leaflet-control-attribution { display: none !important; }
</style>
</head><body>
<div id="map"></div>
<script>
  var map = L.map('map').setView([${center.lat}, ${center.lng}], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(map);
  ${markers}
</script>
</body></html>`
}

export default function MapScreen() {
  const { profile } = useAuth()
  const [orders, setOrders] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const webviewRef = useRef<WebView>(null)

  const load = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, status, total, delivery_location, customer:users!orders_customer_id_fkey(name, phone), address:addresses(label, building, floor, apartment, landmark, lat, lng)')
      .eq('driver_id', profile.id)
      .in('status', ['assigned', 'arrived', 'picked_up', 'ready', 'delivering'])
    const mapped = (data ?? []).map((o: any) => {
      if (o.address?.lat && o.address?.lng) return o
      const dl = o.delivery_location
      if (dl?.lat && dl?.lng) {
        return { ...o, address: { lat: dl.lat, lng: dl.lng, label: dl.address || dl.label || 'موقع التوصيل', building: null, floor: null, apartment: null, landmark: null } }
      }
      return null
    }).filter(Boolean)
    setOrders(mapped)
  }, [profile])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [load])

  function openNavigation(lat: number, lng: number) {
    const url = Platform.OS === 'ios'
      ? `maps:?daddr=${lat},${lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    Linking.openURL(url)
  }

  const center = orders.length > 0
    ? { lat: orders[0].address.lat, lng: orders[0].address.lng }
    : { lat: 30.0444, lng: 31.2357 }

  const handleMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data)
      if (msg.type === 'select') {
        const order = orders.find(o => o.id === msg.id)
        if (order) setSelected(order)
      }
    } catch {}
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>الخريطة</Text>
        <Text style={s.subtitle}>{orders.length} طلب نشط</Text>
      </View>

      <View style={s.mapContainer}>
        {orders.length > 0 || true ? (
          <WebView
            ref={webviewRef}
            source={{ html: buildMapHTML(orders, center) }}
            style={s.map}
            onMessage={handleMessage}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            originWhitelist={['*']}
          />
        ) : null}
      </View>

      {selected && (
        <View style={s.detailCard}>
          <View style={s.detailHeader}>
            <View>
              <Text style={s.detailOrder}>{selected.order_number}</Text>
              <Text style={s.detailCustomer}>👤 {selected.customer?.name}</Text>
            </View>
            <TouchableOpacity onPress={() => setSelected(null)}>
              <Text style={s.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={s.detailInfo}>
            <Text style={s.detailAddress}>📍 {selected.address.label}</Text>
            {selected.address.building && (
              <Text style={s.detailSub}>
                {[selected.address.building && `مبنى ${selected.address.building}`, selected.address.floor && `ط${selected.address.floor}`, selected.address.apartment && `ش${selected.address.apartment}`].filter(Boolean).join(' - ')}
              </Text>
            )}
            {selected.address.landmark && <Text style={s.detailSub}>📌 {selected.address.landmark}</Text>}
          </View>

          <View style={s.detailActions}>
            <TouchableOpacity style={s.navButton} onPress={() => openNavigation(selected.address.lat, selected.address.lng)}>
              <Text style={s.navButtonText}>🧭 اتجاهات</Text>
            </TouchableOpacity>
            {selected.customer?.phone && (
              <TouchableOpacity style={s.callButton} onPress={() => Linking.openURL(`tel:${selected.customer.phone}`)}>
                <Text style={s.callButtonText}>📞 اتصال</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {orders.length === 0 && (
        <View style={s.emptyOverlay}>
          <Text style={s.emptyIcon}>📍</Text>
          <Text style={s.emptyText}>لا توجد طلبات نشطة بعناوين</Text>
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900] },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12, backgroundColor: colors.navy[900] },
  title: { fontSize: 24, fontWeight: '800', color: '#fff' },
  subtitle: { fontSize: 13, color: colors.navy[300], marginTop: 2 },

  mapContainer: { flex: 1, borderRadius: 20, overflow: 'hidden', margin: 12 },
  map: { flex: 1 },

  detailCard: {
    position: 'absolute', bottom: 100, left: 12, right: 12,
    backgroundColor: colors.navy[800], borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: colors.navy[700],
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 10,
  },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  detailOrder: { fontSize: 16, fontWeight: '700', color: '#fff' },
  detailCustomer: { fontSize: 13, color: colors.navy[200], marginTop: 2 },
  closeBtn: { fontSize: 20, color: colors.navy[400], padding: 4 },
  detailInfo: { marginBottom: 12 },
  detailAddress: { fontSize: 14, color: '#fff', fontWeight: '600' },
  detailSub: { fontSize: 12, color: colors.navy[300], marginTop: 2 },
  detailActions: { flexDirection: 'row', gap: 10 },
  navButton: { flex: 1, backgroundColor: colors.primary, borderRadius: 12, padding: 12, alignItems: 'center' },
  navButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  callButton: { flex: 1, borderWidth: 1, borderColor: colors.accent, borderRadius: 12, padding: 12, alignItems: 'center' },
  callButtonText: { color: colors.accent, fontSize: 14, fontWeight: '600' },

  emptyOverlay: {
    position: 'absolute', top: '50%', left: '20%', right: '20%',
    backgroundColor: colors.navy[800] + 'E0', borderRadius: 16, padding: 24, alignItems: 'center',
  },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyText: { fontSize: 14, color: colors.navy[200], textAlign: 'center' },
})
