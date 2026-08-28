import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking, Platform } from 'react-native'
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps'
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

export default function MapScreen() {
  const { profile } = useAuth()
  const [orders, setOrders] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)

  const load = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, status, total, customer:users!orders_customer_id_fkey(name, phone), address:addresses(label, building, floor, apartment, landmark, lat, lng)')
      .eq('driver_id', profile.id)
      .in('status', ['assigned', 'picked_up', 'ready', 'delivering'])
    setOrders((data ?? []).filter((o: any) => o.address?.lat && o.address?.lng))
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

  const defaultRegion = {
    latitude: orders.length > 0 ? orders[0].address.lat : 30.0444,
    longitude: orders.length > 0 ? orders[0].address.lng : 31.2357,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>الخريطة</Text>
        <Text style={s.subtitle}>{orders.length} طلب نشط</Text>
      </View>

      <View style={s.mapContainer}>
        <MapView
          style={s.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={defaultRegion}
          showsUserLocation
          showsMyLocationButton
        >
          {orders.map(order => (
            <Marker
              key={order.id}
              coordinate={{ latitude: order.address.lat, longitude: order.address.lng }}
              title={`${order.order_number} - ${order.customer?.name}`}
              description={statusLabels[order.status] ?? order.status}
              pinColor={statusColors[order.status] ?? '#999'}
              onPress={() => setSelected(order)}
            />
          ))}
        </MapView>
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
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
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
