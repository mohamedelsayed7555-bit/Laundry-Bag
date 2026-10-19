import { useEffect, useState, useRef, type ReactNode } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, ActivityIndicator, Platform, ScrollView, KeyboardAvoidingView, Image, useWindowDimensions, Animated } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { MapPin, LocateFixed, Tag, Building2, Layers, DoorOpen, Flag, NotebookPen, Pencil, Star, Trash2, Check, Plus } from 'lucide-react-native'
import { useAuth } from '../src/contexts/AuthContext'
import { useCustomAlert } from '../src/components/CustomAlert'
import { supabase } from '../src/lib/supabase'
import { useLanguage } from '../src/contexts/LanguageContext'
import { WebView } from 'react-native-webview'
import * as Location from 'expo-location'
import { useBrand, IconButton, BackIcon, Pill, Halftone, F, SIZE, HIT, DotsBackdrop, cardShadow, useStickyHeader, StickyBar, type Brand } from '../src/components/brand'
import { PrimaryButton, SecondaryButton, ErrorLine } from '../src/components/auth/ui'

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

const GRAD_PIN = ['#38BDF8', '#0284C7'] as const

// A small static map preview: the OSM tiles around the pin (zoom 15), with the pin centred in the box.
function MiniMap({ lat, lng, size, b }: { lat: number; lng: number; size: number; b: Brand }) {
  const z = 15
  const n = 2 ** z
  const x = ((lng + 180) / 360) * n
  const latRad = (lat * Math.PI) / 180
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  const tx = Math.floor(x), ty = Math.floor(y)
  const px = (x - tx) * 256, py = (y - ty) * 256
  const dx = px < 128 ? -1 : 1, dy = py < 128 ? -1 : 1
  const tiles = [[0, 0], [dx, 0], [0, dy], [dx, dy]]
  return (
    <View style={[st.mini, { width: size, height: size, backgroundColor: b.iconTile }]}>
      {tiles.map(([ox, oy]) => (
        <Image
          key={`${ox}${oy}`}
          source={{ uri: `https://tile.openstreetmap.org/${z}/${tx + ox}/${ty + oy}.png`, headers: { 'User-Agent': 'CleanOApp/1.0' } }}
          style={{ position: 'absolute', width: 256, height: 256, left: size / 2 - px + ox * 256, top: size / 2 - py + oy * 256 }}
        />
      ))}
      <View style={st.miniPin} pointerEvents="none">
        <View style={[st.miniPinDot, { backgroundColor: b.primary }]}>
          <MapPin size={13} color="#fff" />
        </View>
      </View>
    </View>
  )
}

function ConfirmRow({ label, value, icon, b, first }: { label: string; value: string; icon: ReactNode; b: Brand; first?: boolean }) {
  return (
    <View style={[st.cRow, !first && { borderTopWidth: 1, borderTopColor: b.divider }]}>
      {icon}
      <Text style={[st.cKey, { color: b.muted }]}>{label}</Text>
      <Text style={[st.cVal, { color: b.ink }]} numberOfLines={2}>{value}</Text>
    </View>
  )
}

// Bottom-sheet surface: lit top edge, soft brand tint, halftone dots and a grab handle.
function SheetChrome({ b }: { b: Brand }) {
  const { width } = useWindowDimensions()
  return (
    <>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={b.isDark ? ['#112445', '#0F1A31', '#0F1A2E'] : ['#EAF4FD', '#F6FAFF', '#FFFFFF']}
          locations={[0, 0.3, 0.55]}
          style={StyleSheet.absoluteFill}
        />
        <Halftone width={width} height={150} cx={width / 2} cy={0} color={b.dot} />
      </View>
      <View style={[st.grab, { backgroundColor: b.isDark ? '#2C3D5C' : '#D5DEEA' }]} />
    </>
  )
}

export default function AddressesScreen() {
  const b = useBrand()
  const { t, isRTL } = useLanguage()
  const { profile } = useAuth()
  const router = useRouter()
  // Opened right after sign-up (?onboarding=1) to capture the first delivery address.
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>()
  const isOnboarding = onboarding === '1'
  const onboardOpened = useRef(false)
  const { showAlert, AlertComponent } = useCustomAlert()
  const { scrollY, onScroll } = useStickyHeader()
  const [addresses, setAddresses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ label: '', building: '', floor: '', apartment: '', landmark: '', notes: '' })
  const [pin, setPin] = useState({ latitude: CAIRO.latitude, longitude: CAIRO.longitude })
  const [locatingMe, setLocatingMe] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const webviewRef = useRef<WebView>(null)
  const formScrollRef = useRef<ScrollView>(null)
  const mapExpanded = useRef(false)

  async function reverseGeocode(lat: number, lng: number) {
    setGeocoding(true)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ar`, {
        headers: { 'User-Agent': 'CleanOApp/1.0' },
      })
      const data = await res.json()
      const addr = data.address || {}
      setForm(f => ({
        ...f,
        label: f.label || addr.suburb || addr.neighbourhood || addr.city_district || addr.city || 'عنوان جديد',
        building: f.building || addr.house_number || '',
        landmark: f.landmark || addr.road || '',
      }))
    } catch {}
    setGeocoding(false)
  }

  useEffect(() => { loadAddresses() }, [profile])

  // First-run: drop the new customer straight into adding their delivery address
  // (map + "use my location"), once, only when they have none yet.
  useEffect(() => {
    if (isOnboarding && !loading && addresses.length === 0 && !onboardOpened.current) {
      onboardOpened.current = true
      openAdd()
    }
  }, [isOnboarding, loading, addresses.length])

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
        showAlert({ title: t('locationPermission'), message: t('locationPermissionMsg'), type: 'warning' })
        setLocatingMe(false)
        return
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      const coord = { latitude: loc.coords.latitude, longitude: loc.coords.longitude }
      setPin(coord)
      webviewRef.current?.injectJavaScript(`window.setCenter(${coord.latitude}, ${coord.longitude}); true;`)
      reverseGeocode(coord.latitude, coord.longitude)
    } catch {
      showAlert({ title: t('error'), message: t('locationError'), type: 'error' })
    }
    setLocatingMe(false)
  }

  const handleMapMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data)
      if (msg.type === 'pin') {
        setPin({ latitude: msg.lat, longitude: msg.lng })
        reverseGeocode(msg.lat, msg.lng)
        setTimeout(() => formScrollRef.current?.scrollTo({ y: 280, animated: true }), 500)
      }
    } catch {}
  }

  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  function handleSave() {
    const e: Record<string, string> = {}
    if (!form.label.trim()) e.label = t('addressNameRequired')
    setFormErrors(e)
    if (Object.keys(e).length > 0) return
    setShowModal(false)
    setTimeout(() => setShowConfirm(true), 300)
  }

  async function confirmSave() {
    if (!profile) return
    setShowConfirm(false)
    setShowModal(false)

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
      showAlert({ title: t('error'), message: error.message || t('addressSaveError'), type: 'error' })
      return
    }
    setShowModal(false)
    // Onboarding: first address saved — continue to the home screen.
    if (isOnboarding) { router.replace('/(tabs)/home'); return }
    loadAddresses()
  }

  async function handleDelete(id: string) {
    showAlert({ title: t('deleteAddress'), message: t('deleteAddressConfirm'), type: 'confirm', buttons: [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('addresses').delete().eq('id', id)
        if (error) {
          showAlert({ title: t('error'), message: error.message, type: 'error' })
          return
        }
        loadAddresses()
      }},
    ] })
  }

  async function setDefault(id: string) {
    if (!profile) return
    await supabase.rpc('set_default_address', { p_user_id: profile.id, p_address_id: id })
    loadAddresses()
  }

  const align = { textAlign: (isRTL ? 'right' : 'left') as 'right' | 'left' }
  const rowIcon = (Icon: typeof MapPin) => <Icon size={15} color={b.accentIcon} />
  const summaryLine = [form.building && `${t('theBuilding')} ${form.building}`, form.landmark].filter(Boolean).join(' · ')

  return (
    <>
    <View style={[st.container, { backgroundColor: b.page }]}>
      <Animated.ScrollView contentContainerStyle={st.content} showsVerticalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16}>
        <DotsBackdrop height={240} />

        <View style={st.headerRow}>
          <IconButton onPress={() => isOnboarding ? router.replace('/(tabs)/home') : router.back()} label={t('back')}>
            <BackIcon color={b.ink} />
          </IconButton>
          <Text style={[st.title, { color: b.ink }]} numberOfLines={1}>{t('myAddressesTitle')}</Text>
          <TouchableOpacity
            onPress={openAdd}
            hitSlop={HIT}
            accessibilityRole="button"
            accessibilityLabel={t('addAddress')}
            style={[st.addPill, { backgroundColor: b.primary, shadowColor: b.primary }]}
          >
            <Text style={st.addPillText}>{t('addAddress')}</Text>
          </TouchableOpacity>
        </View>

        {isOnboarding ? (
          <Text style={{ color: b.muted, fontFamily: F.regular, fontSize: 13.5, textAlign: 'center', marginTop: -2, marginBottom: 14, paddingHorizontal: 20, lineHeight: 21 }}>
            {t('onboardLocationSub')}
          </Text>
        ) : null}

        {loading ? (
          <Text style={[st.emptyText, { color: b.muted }]}>{t('loading')}</Text>
        ) : addresses.length === 0 ? (
          <View style={[st.emptyCard, { backgroundColor: b.card, borderColor: b.cardBorder }, cardShadow(b)]}>
            <View style={[st.emptyIcon, { backgroundColor: b.tint }]}>
              <MapPin size={28} color={b.accentIcon} />
            </View>
            <Text style={[st.emptyText, { color: b.muted }]}>{t('noAddresses')}</Text>
            <PrimaryButton title={t('addAddressBtn')} onPress={openAdd} leading={<Plus size={18} color="#fff" />} style={{ marginTop: 16, alignSelf: 'stretch' }} />
            {isOnboarding ? (
              <TouchableOpacity onPress={() => router.replace('/(tabs)/home')} hitSlop={HIT} accessibilityRole="button" style={{ marginTop: 14 }}>
                <Text style={{ color: b.muted, fontFamily: F.medium, fontSize: 14 }}>{t('later')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {addresses.map(item => {
              const def = !!item.is_default
              return (
                <View key={item.id} style={[st.ring, { backgroundColor: def ? (b.isDark ? 'rgba(14,165,233,0.10)' : 'rgba(14,165,233,0.08)') : 'transparent' }]}>
                  <View style={[st.card, { backgroundColor: b.card, borderColor: def ? b.primary : b.cardBorder }, cardShadow(b)]}>
                    <View style={st.cardHead}>
                      {def ? (
                        <LinearGradient colors={GRAD_PIN} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.pinTile}>
                          <MapPin size={18} color="#fff" />
                        </LinearGradient>
                      ) : (
                        <View style={[st.pinTile, { backgroundColor: b.iconTile }]}>
                          <MapPin size={18} color={b.accentIcon} />
                        </View>
                      )}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={st.labelRow}>
                          <Text style={[st.cardLabel, { color: b.ink }]} numberOfLines={1}>{item.label}</Text>
                          {def ? <Pill label={t('defaultLabel')} tone="info" /> : null}
                        </View>
                        {item.building ? <Text style={[st.cardDetail, { color: b.muted }, align]}>{t('theBuilding')}: {item.building}</Text> : null}
                        {item.floor ? <Text style={[st.cardDetail, { color: b.muted }, align]}>{t('theFloor')}: {item.floor}</Text> : null}
                        {item.apartment ? <Text style={[st.cardDetail, { color: b.muted }, align]}>{t('theApartment')}: {item.apartment}</Text> : null}
                        {item.landmark ? <Text style={[st.cardDetail, { color: b.muted }, align]}>{t('theLandmark')}: {item.landmark}</Text> : null}
                      </View>
                    </View>
                    <View style={[st.actions, { borderTopColor: b.divider }]}>
                      <TouchableOpacity onPress={() => openEdit(item)} accessibilityRole="button" accessibilityLabel={t('edit')} style={st.action}>
                        <Pencil size={14} color={b.ink2} />
                        <Text style={[st.actionText, { color: b.ink2 }]} numberOfLines={1}>{t('edit')}</Text>
                      </TouchableOpacity>
                      {!def ? (
                        <TouchableOpacity onPress={() => setDefault(item.id)} accessibilityRole="button" accessibilityLabel={t('setAsDefault')} style={[st.action, st.actionSep, { borderStartColor: b.divider }]}>
                          <Star size={14} color={b.tintText} />
                          <Text style={[st.actionText, { color: b.tintText }]} numberOfLines={1}>{t('setAsDefault')}</Text>
                        </TouchableOpacity>
                      ) : null}
                      <TouchableOpacity onPress={() => handleDelete(item.id)} accessibilityRole="button" accessibilityLabel={t('delete')} style={[st.action, st.actionSep, { borderStartColor: b.divider }]}>
                        <Trash2 size={14} color={b.dangerText} />
                        <Text style={[st.actionText, { color: b.dangerText }]} numberOfLines={1}>{t('delete')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        )}
      </Animated.ScrollView>

      <StickyBar scrollY={scrollY} title={t('myAddressesTitle')} onBack={() => isOnboarding ? router.replace('/(tabs)/home') : router.back()} />

      <Modal visible={showModal} animationType="slide" transparent>
        <KeyboardAvoidingView style={st.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[st.sheet, { backgroundColor: b.card, borderTopColor: b.tintBorder }]}>
            <SheetChrome b={b} />
            <ScrollView ref={formScrollRef} contentContainerStyle={{ paddingBottom: 12 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} nestedScrollEnabled>
              <Text style={[st.sheetTitle, { color: b.ink }]}>{editing ? t('editAddress') : t('addNewAddress')}</Text>

              <Text style={[st.lbl, { color: b.muted }, align]}>{t('selectMapLocation')}</Text>
              <View style={[st.mapContainer, { backgroundColor: b.iconTile }]}>
                <WebView
                  ref={webviewRef}
                  source={{ html: buildPickerMapHTML(pin.latitude, pin.longitude) }}
                  style={st.map}
                  onMessage={handleMapMessage}
                  javaScriptEnabled
                  domStorageEnabled
                  startInLoadingState
                  originWhitelist={['*']}
                  scrollEnabled={false}
                  nestedScrollEnabled
                />
                <TouchableOpacity
                  style={[st.myLocBtn, { backgroundColor: b.card, borderColor: b.tintBorder }]}
                  onPress={useMyLocation}
                  disabled={locatingMe}
                  hitSlop={HIT}
                  accessibilityRole="button"
                  accessibilityLabel={t('myCurrentLocation').replace(/^\S+\s/, '')}
                >
                  {locatingMe
                    ? <ActivityIndicator size="small" color={b.primary} />
                    : <>
                        <LocateFixed size={14} color={b.tintText} />
                        <Text style={[st.myLocText, { color: b.tintText }]}>{t('myCurrentLocation').replace(/^\S+\s/, '')}</Text>
                      </>
                  }
                </TouchableOpacity>
              </View>

              {geocoding && (
                <View style={st.geoRow}>
                  <ActivityIndicator size="small" color={b.primary} />
                  <Text style={{ color: b.muted, fontSize: 12, fontFamily: F.medium }}>{t('locatingAddress')}</Text>
                </View>
              )}

              <FormField icon={Tag} label={t('addressName')} value={form.label} onChange={v => { setForm(f => ({ ...f, label: v })); setFormErrors(p => { const n = {...p}; delete n.label; return n }) }} placeholder={t('addressNamePlaceholder')} error={formErrors.label} />
              <FormField icon={Building2} label={t('theBuilding')} value={form.building} onChange={v => setForm(f => ({ ...f, building: v }))} placeholder={t('buildingPlaceholder')} />
              <View style={st.row}>
                <View style={{ flex: 1 }}><FormField icon={Layers} label={t('theFloor')} value={form.floor} onChange={v => setForm(f => ({ ...f, floor: v }))} placeholder="3" /></View>
                <View style={{ flex: 1 }}><FormField icon={DoorOpen} label={t('theApartment')} value={form.apartment} onChange={v => setForm(f => ({ ...f, apartment: v }))} placeholder="12" /></View>
              </View>
              <FormField icon={Flag} label={t('theLandmark')} value={form.landmark} onChange={v => setForm(f => ({ ...f, landmark: v }))} placeholder={t('landmarkPlaceholder')} />
              <FormField icon={NotebookPen} label={t('theNotes')} value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} placeholder={t('notesFieldPlaceholder')} />
            </ScrollView>

            <View style={[st.stickyActions, { borderTopColor: b.divider }]}>
              <PrimaryButton title={t('save')} onPress={handleSave} leading={<Check size={18} color="#fff" />} style={{ flex: 1.4 }} />
              <SecondaryButton title={t('cancel')} onPress={() => setShowModal(false)} style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showConfirm} animationType="fade" transparent>
        <View style={st.modalOverlay}>
          <View style={[st.sheet, { maxHeight: '80%', backgroundColor: b.card, borderTopColor: b.tintBorder }]}>
            <SheetChrome b={b} />
            <ScrollView contentContainerStyle={{ paddingBottom: 4 }} showsVerticalScrollIndicator={false}>
              <Text style={[st.sheetTitle, { color: b.ink }]}>{t('confirmDeliveryInfo')}</Text>

              <View style={[st.sum, { backgroundColor: b.page, borderColor: b.cardBorder }]}>
                <MiniMap lat={pin.latitude} lng={pin.longitude} size={64} b={b} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[st.sumTitle, { color: b.ink }, align]} numberOfLines={1}>{form.label}</Text>
                  {summaryLine ? <Text style={[st.sumSub, { color: b.muted }, align]} numberOfLines={2}>{summaryLine}</Text> : null}
                </View>
              </View>

              <View style={[st.rows, { borderColor: b.cardBorder, backgroundColor: b.card }]}>
                <ConfirmRow first label={t('addressName')} value={form.label} icon={rowIcon(Tag)} b={b} />
                {form.building ? <ConfirmRow label={t('theBuilding')} value={form.building} icon={rowIcon(Building2)} b={b} /> : null}
                {form.floor ? <ConfirmRow label={t('theFloor')} value={form.floor} icon={rowIcon(Layers)} b={b} /> : null}
                {form.apartment ? <ConfirmRow label={t('theApartment')} value={form.apartment} icon={rowIcon(DoorOpen)} b={b} /> : null}
                {form.landmark ? <ConfirmRow label={t('theLandmark')} value={form.landmark} icon={rowIcon(Flag)} b={b} /> : null}
                {form.notes ? <ConfirmRow label={t('theNotes')} value={form.notes} icon={rowIcon(NotebookPen)} b={b} /> : null}
              </View>
            </ScrollView>
            <View style={st.modalActions}>
              <PrimaryButton title={t('confirmAndSave')} onPress={confirmSave} leading={<Check size={18} color="#fff" />} style={{ flex: 1.4 }} />
              <SecondaryButton title={t('edit')} icon={<Pencil size={15} color={b.ink2} />} onPress={() => { setShowConfirm(false); setTimeout(() => setShowModal(true), 300) }} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
    {AlertComponent}
    </>
  )
}

function FormField({ label, value, onChange, placeholder, error, icon: Icon }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; error?: string; icon: typeof MapPin }) {
  const b = useBrand()
  const { isRTL } = useLanguage()
  const [focused, setFocused] = useState(false)
  const borderColor = error ? b.danger : focused ? b.primary : b.fieldBorder
  const ring = error ? b.dangerBg : focused ? b.ring : 'transparent'
  return (
    <View style={{ marginTop: 10 }}>
      <View style={[st.fieldRing, { backgroundColor: ring }]}>
        <View style={[st.field, { backgroundColor: b.field, borderColor, borderWidth: focused || error ? 1.5 : 1 }]}>
          <View style={[st.fieldIcon, { backgroundColor: error ? b.dangerBg : focused ? b.primary : b.iconBg }]}>
            <Icon size={15} color={error ? b.danger : focused ? '#fff' : b.iconFg} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[st.fieldLabel, { color: error ? b.danger : focused ? b.primary : b.muted, textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>{label}</Text>
            <TextInput
              style={[st.fieldInput, { color: b.ink }]}
              value={value}
              onChangeText={onChange}
              placeholder={placeholder}
              placeholderTextColor={b.faint}
              selectionColor={b.primary}
              textAlign={isRTL ? 'right' : 'left'}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              accessibilityLabel={label}
            />
          </View>
        </View>
      </View>
      <ErrorLine message={error} />
    </View>
  )
}

const st = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 32 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  title: { flex: 1, fontSize: 20, fontFamily: F.display },
  addPill: { height: SIZE.S, borderRadius: SIZE.rS, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  addPillText: { color: '#fff', fontSize: 12.5, fontFamily: F.bold },
  emptyCard: { borderRadius: 20, padding: 28, alignItems: 'center', borderWidth: 1 },
  emptyIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyText: { fontSize: 14, fontFamily: F.medium, textAlign: 'center' },
  ring: { borderRadius: 19, padding: 3, margin: -3 },
  card: { borderRadius: 16, borderWidth: 1 },
  cardHead: { flexDirection: 'row', gap: 10, padding: 12 },
  pinTile: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  cardLabel: { flexShrink: 1, fontSize: 14.5, fontFamily: F.bold },
  cardDetail: { fontSize: 12, fontFamily: F.regular, lineHeight: 19 },
  actions: { flexDirection: 'row', borderTopWidth: 1 },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, height: 40, paddingHorizontal: 4 },
  actionSep: { borderStartWidth: 1 },
  actionText: { fontSize: 12, fontFamily: F.semibold },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(2,6,14,0.62)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, overflow: 'hidden', paddingHorizontal: 16, paddingTop: 8, maxHeight: '92%', flex: 0, flexShrink: 1 },
  grab: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 10 },
  sheetTitle: { fontSize: 17, fontFamily: F.display, textAlign: 'center', marginBottom: 4 },
  lbl: { fontSize: 12, fontFamily: F.semibold, marginTop: 12, marginBottom: 6, marginHorizontal: 2 },
  row: { flexDirection: 'row', gap: 8 },
  geoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  fieldRing: { borderRadius: 16, padding: 3, margin: -3 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: SIZE.L, borderRadius: 13, paddingHorizontal: 10, paddingVertical: 4 },
  fieldIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: 10.5, fontFamily: F.semibold },
  fieldInput: { fontSize: 14, fontFamily: F.medium, paddingVertical: 1, paddingHorizontal: 0, margin: 0 },
  stickyActions: { flexDirection: 'row', gap: 8, paddingTop: 12, paddingBottom: 24, borderTopWidth: 1 },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 16, paddingBottom: 24 },

  mapContainer: { height: 240, borderRadius: 16, overflow: 'hidden', position: 'relative' },
  map: { flex: 1 },
  myLocBtn: { position: 'absolute', bottom: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 5, height: SIZE.S, borderRadius: SIZE.rS, paddingHorizontal: 11, borderWidth: 1 },
  myLocText: { fontSize: 12, fontFamily: F.bold },

  sum: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, padding: 8, borderRadius: 14, borderWidth: 1 },
  // Tiles are placed with absolute left/top, so keep this box LTR even in Arabic (RTL would mirror them).
  mini: { borderRadius: 11, overflow: 'hidden', direction: 'ltr' },
  miniPinDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  miniPin: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  sumTitle: { fontSize: 15, fontFamily: F.display },
  sumSub: { fontSize: 11.5, fontFamily: F.regular, marginTop: 2 },
  rows: { marginTop: 10, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  cRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 10, paddingHorizontal: 11 },
  cKey: { flex: 1, fontSize: 12.5, fontFamily: F.medium },
  cVal: { maxWidth: '60%', fontSize: 12.5, fontFamily: F.bold },
})
