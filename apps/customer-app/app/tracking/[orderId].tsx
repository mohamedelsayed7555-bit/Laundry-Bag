import { useEffect, useState, useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import MapView, { Marker } from 'react-native-maps'
import { supabase } from '../../src/lib/supabase'
import { colors } from '../../src/theme'

const statusLabels: Record<string, string> = {
  assigned: 'في الطريق للاستلام',
  picked_up: 'تم استلام الطلب',
  delivering: 'في الطريق إليك',
}

export default function TrackingScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>()
  const router = useRouter()
  const mapRef = useRef<MapView>(null)
  const [order, setOrder] = useState<any>(null)
  const [driverLoc, setDriverLoc] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    loadOrder()
    const ch = supabase
      .channel(`tracking-order-${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, () => loadOrder())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [orderId])

  useEffect(() => {
    if (!order?.driver_id || !['assigned', 'picked_up', 'delivering'].includes(order?.status)) {
      setDriverLoc(null)
      return
    }
    supabase.from('driver_locations').select('lat, lng').eq('driver_id', order.driver_id).single()
      .then(({ data }) => { if (data) setDriverLoc(data) })

    const ch = supabase
      .channel(`tracking-loc-${order.driver_id}`)
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

  async function loadOrder() {
    const { data } = await supabase
      .from('orders')
      .select('*, driver:users!orders_driver_id_fkey(name, phone)')
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

  function openNavigation() {
    if (!driverLoc) return
    const url = Platform.OS === 'ios'
      ? `maps:?daddr=${driverLoc.lat},${driverLoc.lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${driverLoc.lat},${driverLoc.lng}`
    Linking.openURL(url)
  }

  const customerLat = order?.delivery_location?.lat
  const customerLng = order?.delivery_location?.lng
  const distanceKm = driverLoc && customerLat && customerLng
    ? getDistance(driverLoc.lat, driverLoc.lng, customerLat, customerLng)
    : null
  const etaMinutes = distanceKm !== null ? Math.max(1, Math.round(distanceKm / 0.5)) : null

  const showMap = driverLoc && ['assigned', 'picked_up', 'delivering'].includes(order?.status)

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>→ رجوع</Text>
        </TouchableOpacity>
        <Text style={s.title}>تتبع السائق</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Map */}
      <View style={s.mapContainer}>
        {showMap ? (
          <MapView
            ref={mapRef}
            style={s.map}
            initialRegion={{
              latitude: driverLoc.lat,
              longitude: driverLoc.lng,
              latitudeDelta: 0.03,
              longitudeDelta: 0.03,
            }}
            region={driverLoc ? {
              latitude: (driverLoc.lat + (customerLat ?? driverLoc.lat)) / 2,
              longitude: (driverLoc.lng + (customerLng ?? driverLoc.lng)) / 2,
              latitudeDelta: Math.max(0.02, Math.abs(driverLoc.lat - (customerLat ?? driverLoc.lat)) * 2.5),
              longitudeDelta: Math.max(0.02, Math.abs(driverLoc.lng - (customerLng ?? driverLoc.lng)) * 2.5),
            } : undefined}
            showsUserLocation
            showsMyLocationButton
          >
            <Marker
              coordinate={{ latitude: driverLoc.lat, longitude: driverLoc.lng }}
              title={order?.driver?.name ?? 'السائق'}
              description={statusLabels[order?.status] ?? ''}
              pinColor="#3b82f6"
            />
            {customerLat && customerLng && (
              <Marker
                coordinate={{ latitude: customerLat, longitude: customerLng }}
                title="موقعك"
                pinColor="#10b981"
              />
            )}
          </MapView>
        ) : (
          <View style={s.noMap}>
            <Text style={s.noMapIcon}>📍</Text>
            <Text style={s.noMapText}>موقع السائق غير متاح حالياً</Text>
          </View>
        )}
      </View>

      {/* Info Panel */}
      <View style={s.panel}>
        {order?.driver && (
          <View style={s.driverRow}>
            <View style={s.driverAvatar}>
              <Text style={s.driverAvatarText}>{order.driver.name?.[0] ?? '؟'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.driverName}>{order.driver.name}</Text>
              <Text style={s.statusText}>{statusLabels[order?.status] ?? order?.status}</Text>
            </View>
            {order.driver.phone && (
              <TouchableOpacity style={s.callBtn} onPress={() => Linking.openURL(`tel:${order.driver.phone}`)}>
                <Text style={s.callBtnText}>📞</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.chatBtn} onPress={() => router.push(`/chat/${orderId}`)}>
              <Text style={s.chatBtnText}>💬</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={s.etaRow}>
          {distanceKm !== null && (
            <View style={s.etaItem}>
              <Text style={s.etaValue}>{distanceKm < 1 ? `${Math.round(distanceKm * 1000)} م` : `${distanceKm.toFixed(1)} كم`}</Text>
              <Text style={s.etaLabel}>المسافة</Text>
            </View>
          )}
          {etaMinutes !== null && (
            <View style={s.etaItem}>
              <Text style={[s.etaValue, { color: colors.primary }]}>{etaMinutes} دقيقة</Text>
              <Text style={s.etaLabel}>الوقت المتوقع</Text>
            </View>
          )}
          <View style={s.etaItem}>
            <Text style={s.etaValue}>{order?.order_number}</Text>
            <Text style={s.etaLabel}>رقم الطلب</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900] },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12,
    backgroundColor: colors.navy[900],
  },
  backBtn: { width: 60 },
  backText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '800', color: '#fff' },

  mapContainer: { flex: 1 },
  map: { flex: 1 },
  noMap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.navy[800] },
  noMapIcon: { fontSize: 48, marginBottom: 12 },
  noMapText: { fontSize: 16, color: colors.navy[300] },

  panel: {
    backgroundColor: colors.navy[800], borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 36,
    borderTopWidth: 1, borderColor: colors.navy[600],
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 16,
  },
  driverRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20,
    paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.navy[700],
  },
  driverAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.primary + '25', justifyContent: 'center', alignItems: 'center',
  },
  driverAvatarText: { fontSize: 20, fontWeight: '700', color: colors.primary },
  driverName: { fontSize: 16, fontWeight: '700', color: '#fff' },
  statusText: { fontSize: 12, color: colors.primary, marginTop: 2, fontWeight: '600' },
  callBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primaryGlow, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.primary + '30',
  },
  callBtnText: { fontSize: 20 },
  chatBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.accentGlow, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.accent + '30',
  },
  chatBtnText: { fontSize: 20 },

  etaRow: { flexDirection: 'row', justifyContent: 'space-around' },
  etaItem: { alignItems: 'center', gap: 4 },
  etaValue: { fontSize: 20, fontWeight: '800', color: '#fff' },
  etaLabel: { fontSize: 11, color: colors.navy[300] },
})
