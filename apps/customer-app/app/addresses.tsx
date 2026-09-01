import { useEffect, useState, useRef } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, ActivityIndicator, Platform, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../src/contexts/AuthContext'
import { useCustomAlert } from '../src/components/CustomAlert'
import { supabase } from '../src/lib/supabase'
import { colors } from '../src/theme'
import { WebView } from 'react-native-webview'
import * as Location from 'expo-location'

const CAIRO = { latitude: 30.0444, longitude: 31.2357 }

function buildPickerMapHTML(lat: number, lng: number) {
  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<style>
  * { margin: 0; padding: 0; }
  #map { width: 100vw; height: 100vh; }
  .leaflet-control-attribution { display: none !important; }
</style>
</head><body>
<div id="map"></div>
<script>
  var map = L.map('map').setView([${lat}, ${lng}], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  var marker = L.marker([${lat}, ${lng}], { draggable: true }).addTo(map);
  marker.on('dragend', function(e) {
    var ll = e.target.getLatLng();
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'pin', lat: ll.lat, lng: ll.lng }));
  });
  map.on('click', function(e) {
    marker.setLatLng(e.latlng);
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'pin', lat: e.latlng.lat, lng: e.latlng.lng }));
  });
  window.setCenter = function(lat, lng) {
    marker.setLatLng([lat, lng]);
    map.setView([lat, lng], 17);
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'pin', lat: lat, lng: lng }));
  };
<\/script>
</body></html>`
}

export default function AddressesScreen() {
  const { profile } = useAuth()
  const router = useRouter()
  const { showAlert, AlertComponent } = useCustomAlert()
  const [addresses, setAddresses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ label: '', building: '', floor: '', apartment: '', landmark: '', notes: '' })
  const [pin, setPin] = useState({ latitude: CAIRO.latitude, longitude: CAIRO.longitude })
  const [locatingMe, setLocatingMe] = useState(false)
  const webviewRef = useRef<WebView>(null)

  useEffect(() => { loadAddresses() }, [profile])

  async function loadAddresses() {
    if (!profile) return
    const { data } = await supabase.from('addresses').select('id, label, lat, lng, building, floor, apartment, landmark, notes, is_default, user_id').eq('user_id', profile.id).order('is_default', { ascending: false })
    setAddresses(data ?? [])
    setLoading(false)
  }

  function openAdd() {
    setEditing(null)
    setForm({ label: '', building: '', floor: '', apartment: '', landmark: '', notes: '' })
    setPin({ latitude: CAIRO.latitude, longitude: CAIRO.longitude })
    setShowModal(true)
  }

  function openEdit(addr: any) {
    setEditing(addr)
    setForm({
      label: addr.label || '',
      building: addr.building || '',
      floor: addr.floor || '',
      apartment: addr.apartment || '',
      landmark: addr.landmark || '',
      notes: addr.notes || '',
    })
    setPin({ latitude: addr.lat ?? CAIRO.latitude, longitude: addr.lng ?? CAIRO.longitude })
    setShowModal(true)
  }

  async function useMyLocation() {
    setLocatingMe(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        showAlert({ title: 'صلاحية الموقع', message: 'يرجى السماح بالوصول للموقع من الإعدادات', type: 'warning' })
        setLocatingMe(false)
        return
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      const coord = { latitude: loc.coords.latitude, longitude: loc.coords.longitude }
      setPin(coord)
      if (!form.label.trim()) setForm(f => ({ ...f, label: 'موقعي الحالي' }))
      webviewRef.current?.injectJavaScript(`window.setCenter(${coord.latitude}, ${coord.longitude}); true;`)
    } catch {
      showAlert({ title: 'خطأ', message: 'لم نتمكن من تحديد موقعك', type: 'error' })
    }
    setLocatingMe(false)
  }

  const handleMapMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data)
      if (msg.type === 'pin') {
        setPin({ latitude: msg.lat, longitude: msg.lng })
      }
    } catch {}
  }

  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  async function handleSave() {
    const e: Record<string, string> = {}
    if (!form.label.trim()) e.label = 'اسم العنوان مطلوب'
    setFormErrors(e)
    if (Object.keys(e).length > 0) return
    if (!profile) return

    const payload = {
      user_id: profile.id,
      label: form.label.trim(),
      building: form.building.trim() || null,
      floor: form.floor.trim() || null,
      apartment: form.apartment.trim() || null,
      landmark: form.landmark.trim() || null,
      notes: form.notes.trim() || null,
      lat: pin.latitude,
      lng: pin.longitude,
      is_default: addresses.length === 0,
    }

    const { error } = editing
      ? await supabase.from('addresses').update(payload).eq('id', editing.id)
      : await supabase.from('addresses').insert(payload)

    if (error) {
      showAlert({ title: 'خطأ', message: error.message || 'حدث خطأ أثناء حفظ العنوان', type: 'error' })
      return
    }
    setShowModal(false)
    loadAddresses()
  }

  async function handleDelete(id: string) {
    showAlert({ title: 'حذف العنوان', message: 'هل أنت متأكد؟', type: 'confirm', buttons: [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => {
        await supabase.from('addresses').delete().eq('id', id)
        loadAddresses()
      }},
    ] })
  }

  async function setDefault(id: string) {
    if (!profile) return
    await supabase.from('addresses').update({ is_default: false }).eq('user_id', profile.id)
    await supabase.from('addresses').update({ is_default: true }).eq('id', id)
    loadAddresses()
  }

  return (
    <>
    <View style={s.container}>
      <View style={s.headerRow}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.backText}>→ رجوع</Text>
        </TouchableOpacity>
        <Text style={s.title}>عناويني</Text>
        <TouchableOpacity onPress={openAdd}>
          <Text style={s.addText}>+ إضافة</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <Text style={s.emptyText}>جاري التحميل...</Text>
      ) : addresses.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>📍</Text>
          <Text style={s.emptyText}>لا توجد عناوين محفوظة</Text>
          <TouchableOpacity style={s.addBtn} onPress={openAdd}>
            <Text style={s.addBtnText}>إضافة عنوان</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={i => i.id}
          contentContainerStyle={{ gap: 12, paddingBottom: 20 }}
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.cardHeader}>
                <View style={s.labelRow}>
                  <Text style={s.cardLabel}>📍 {item.label}</Text>
                  {item.is_default && <View style={s.defaultBadge}><Text style={s.defaultText}>افتراضي</Text></View>}
                </View>
                <TouchableOpacity onPress={() => openEdit(item)}>
                  <Text style={s.editText}>تعديل</Text>
                </TouchableOpacity>
              </View>
              {item.building && <Text style={s.cardDetail}>المبنى: {item.building}</Text>}
              {item.floor && <Text style={s.cardDetail}>الطابق: {item.floor}</Text>}
              {item.apartment && <Text style={s.cardDetail}>الشقة: {item.apartment}</Text>}
              {item.landmark && <Text style={s.cardDetail}>علامة مميزة: {item.landmark}</Text>}
              <View style={s.cardActions}>
                {!item.is_default && (
                  <TouchableOpacity onPress={() => setDefault(item.id)}>
                    <Text style={s.actionText}>تعيين كافتراضي</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => handleDelete(item.id)}>
                  <Text style={[s.actionText, { color: colors.danger }]}>حذف</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <ScrollView style={s.modalContent} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={s.modalTitle}>{editing ? 'تعديل العنوان' : 'إضافة عنوان'}</Text>

            <Text style={s.fieldLabel}>حدد الموقع على الخريطة</Text>
            <View style={s.mapContainer}>
              <WebView
                ref={webviewRef}
                source={{ html: buildPickerMapHTML(pin.latitude, pin.longitude) }}
                style={s.map}
                onMessage={handleMapMessage}
                javaScriptEnabled
                domStorageEnabled
                startInLoadingState
                originWhitelist={['*']}
                scrollEnabled={false}
                nestedScrollEnabled
              />
              <TouchableOpacity style={s.myLocBtn} onPress={useMyLocation} disabled={locatingMe}>
                {locatingMe
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <Text style={s.myLocText}>📍 موقعي الحالي</Text>
                }
              </TouchableOpacity>
            </View>

            <FormField label="اسم العنوان *" value={form.label} onChange={v => { setForm(f => ({ ...f, label: v })); setFormErrors(p => { const n = {...p}; delete n.label; return n }) }} placeholder="مثال: البيت، الشغل" error={formErrors.label} />
            <FormField label="المبنى" value={form.building} onChange={v => setForm(f => ({ ...f, building: v }))} placeholder="رقم أو اسم المبنى" />
            <View style={s.row}>
              <View style={{ flex: 1 }}><FormField label="الطابق" value={form.floor} onChange={v => setForm(f => ({ ...f, floor: v }))} placeholder="3" /></View>
              <View style={{ flex: 1 }}><FormField label="الشقة" value={form.apartment} onChange={v => setForm(f => ({ ...f, apartment: v }))} placeholder="12" /></View>
            </View>
            <FormField label="علامة مميزة" value={form.landmark} onChange={v => setForm(f => ({ ...f, landmark: v }))} placeholder="بجوار مسجد..." />
            <FormField label="ملاحظات" value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} placeholder="تفاصيل إضافية" />

            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancel} onPress={() => setShowModal(false)}>
                <Text style={s.modalCancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalSave} onPress={handleSave}>
                <Text style={s.modalSaveText}>حفظ</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
    {AlertComponent}
    </>
  )
}

function FormField({ label, value, onChange, placeholder, error }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; error?: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput style={[s.fieldInput, error ? s.fieldInputError : null]} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.navy[400]} textAlign="right" />
      {error ? <Text style={s.fieldError}>{error}</Text> : null}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy[900], padding: 20, paddingTop: 56 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  backText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  addText: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  emptyCard: { backgroundColor: colors.navy[800], borderRadius: 20, padding: 40, alignItems: 'center', borderWidth: 1, borderColor: colors.navy[700] },
  emptyText: { fontSize: 15, color: colors.navy[300], textAlign: 'center' },
  addBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10, marginTop: 16 },
  addBtnText: { color: '#fff', fontWeight: '700' },
  card: { backgroundColor: colors.navy[800], borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.navy[700] },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardLabel: { fontSize: 15, fontWeight: '700', color: '#fff' },
  defaultBadge: { backgroundColor: colors.primary + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  defaultText: { color: colors.primary, fontSize: 10, fontWeight: '700' },
  editText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  cardDetail: { fontSize: 12, color: colors.navy[200], marginBottom: 2 },
  cardActions: { flexDirection: 'row', gap: 16, marginTop: 12, borderTopWidth: 1, borderTopColor: colors.navy[700], paddingTop: 10 },
  actionText: { color: colors.primary, fontSize: 12, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.navy[800], borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 16, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 12 },
  fieldLabel: { fontSize: 12, color: colors.navy[200], marginBottom: 4, textAlign: 'right' },
  fieldInput: { backgroundColor: colors.navy[700], borderRadius: 10, padding: 12, color: '#fff', fontSize: 14, borderWidth: 1.5, borderColor: 'transparent' },
  fieldInputError: { borderColor: '#ef4444', backgroundColor: '#ef444410' },
  fieldError: { fontSize: 11, color: '#ef4444', textAlign: 'right', marginTop: 3, fontWeight: '500' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalCancel: { flex: 1, borderWidth: 1, borderColor: colors.navy[500], borderRadius: 12, padding: 14, alignItems: 'center' },
  modalCancelText: { color: colors.navy[200], fontWeight: '600' },
  modalSave: { flex: 2, backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  modalSaveText: { color: '#fff', fontWeight: '700' },

  mapContainer: { height: 160, borderRadius: 16, overflow: 'hidden', marginBottom: 16, position: 'relative' },
  map: { flex: 1 },
  myLocBtn: {
    position: 'absolute', bottom: 10, left: 10,
    backgroundColor: colors.navy[800] + 'ee', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: colors.navy[600],
  },
  myLocText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
})
