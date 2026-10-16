'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Truck, Phone, RefreshCw, MapPin, Loader2, Package, Navigation } from 'lucide-react'

type Driver = {
  id: string
  name: string
  phone: string | null
  vehicle_type: string | null
  vehicle_number: string | null
  is_active: boolean
  lat: number | null
  lng: number | null
  updated_at: string | null
  active_orders: number
  pickup_orders: number
  delivery_orders: number
}

// A position older than this is treated as stale rather than live.
const FRESH_MIN = 5
const AWAY_MIN = 30
const CAIRO: [number, number] = [30.0444, 31.2357]

function minutesAgo(iso: string | null) {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
}

function statusOf(d: Driver): { key: 'live' | 'away' | 'offline'; label: string; color: string } {
  const m = minutesAgo(d.updated_at)
  if (!d.is_active) return { key: 'offline', label: 'معطّل', color: '#9ca3af' }
  if (m === null) return { key: 'offline', label: 'لا يوجد موقع', color: '#9ca3af' }
  if (m <= FRESH_MIN) return { key: 'live', label: 'متصل الآن', color: '#16a34a' }
  if (m <= AWAY_MIN) return { key: 'away', label: `من ${m} د`, color: '#f59e0b' }
  return { key: 'offline', label: `من ${m >= 60 ? Math.floor(m / 60) + ' س' : m + ' د'}`, color: '#9ca3af' }
}

export default function LiveDriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<Date | null>(null)

  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<Record<string, any>>({})
  const driversRef = useRef<Driver[]>([])
  driversRef.current = drivers

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('drivers_live')
    setDrivers((data ?? []) as Driver[])
    setLastSync(new Date())
    setLoading(false)
  }, [])

  // Leaflet from the CDN, so the dashboard gains no new dependency.
  useEffect(() => {
    let cancelled = false
    function boot() {
      const L = (window as any).L
      if (!L || !mapEl.current || mapRef.current || cancelled) return
      const map = L.map(mapEl.current, { zoomControl: true, attributionControl: false }).setView(CAIRO, 11)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)
      mapRef.current = map
    }
    if (!document.getElementById('leaflet-css')) {
      const css = document.createElement('link')
      css.id = 'leaflet-css'; css.rel = 'stylesheet'
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(css)
    }
    if ((window as any).L) { boot() } else {
      const s = document.createElement('script')
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      s.onload = boot
      document.body.appendChild(s)
    }
    return () => { cancelled = true }
  }, [])

  // First load, a slow refresh, and live position updates.
  useEffect(() => {
    load()
    const timer = setInterval(load, 60_000)
    const ch = supabase
      .channel('live-drivers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, payload => {
        const loc: any = payload.new
        if (!loc?.driver_id) return
        setDrivers(prev => prev.map(d => d.id === loc.driver_id
          ? { ...d, lat: loc.lat, lng: loc.lng, updated_at: loc.updated_at }
          : d))
        setLastSync(new Date())
      })
      .subscribe()
    return () => { clearInterval(timer); supabase.removeChannel(ch) }
  }, [load])

  // Draw / move the markers whenever the list changes.
  useEffect(() => {
    const L = (window as any).L
    const map = mapRef.current
    if (!L || !map) return

    const seen = new Set<string>()
    for (const d of drivers) {
      if (d.lat == null || d.lng == null) continue
      seen.add(d.id)
      const st = statusOf(d)
      const html = `<div style="position:relative;display:grid;place-items:center">
        <div style="width:30px;height:30px;border-radius:50%;background:${st.color};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);display:grid;place-items:center;color:#fff;font:700 11px system-ui">${d.active_orders || ''}</div>
      </div>`
      const icon = L.divIcon({ html, className: '', iconSize: [30, 30], iconAnchor: [15, 15] })
      const existing = markersRef.current[d.id]
      if (existing) {
        existing.setLatLng([d.lat, d.lng]); existing.setIcon(icon)
      } else {
        const m = L.marker([d.lat, d.lng], { icon }).addTo(map)
        m.on('click', () => setSelected(d.id))
        markersRef.current[d.id] = m
      }
      markersRef.current[d.id].bindTooltip(`${d.name} — ${d.active_orders} طلب`, { direction: 'top' })
    }
    // drop markers for drivers that no longer report a position
    for (const id of Object.keys(markersRef.current)) {
      if (!seen.has(id)) { map.removeLayer(markersRef.current[id]); delete markersRef.current[id] }
    }
  }, [drivers])

  function focus(d: Driver) {
    setSelected(d.id)
    if (d.lat != null && d.lng != null && mapRef.current) {
      mapRef.current.setView([d.lat, d.lng], 15, { animate: true })
      markersRef.current[d.id]?.openTooltip()
    }
  }

  const live = drivers.filter(d => statusOf(d).key === 'live').length
  const working = drivers.filter(d => d.active_orders > 0).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[180px]">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Truck size={20} className="text-primary-500" />
            تتبع السائقين
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {live} متصل الآن · {working} معاهم طلبات · {drivers.length} إجمالي
            {lastSync && ` · آخر تحديث ${lastSync.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`}
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 bg-white border border-surface-border/60 hover:bg-surface-muted text-gray-700 text-sm font-semibold py-2.5 px-4 rounded-xl transition-colors"
        >
          <RefreshCw size={15} />
          تحديث
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* map */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-premium border border-surface-border/60 overflow-hidden relative">
          <div ref={mapEl} className="w-full h-[380px] lg:h-[560px] z-0" />
          {loading && (
            <div className="absolute inset-0 bg-white/70 grid place-items-center">
              <Loader2 className="animate-spin text-primary-500" size={26} />
            </div>
          )}
          <div className="absolute bottom-3 right-3 z-[400] bg-white/95 rounded-xl shadow px-3 py-2 flex flex-wrap gap-3 text-[11px] font-semibold">
            <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-[#16a34a] inline-block" />متصل</span>
            <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] inline-block" />من فترة</span>
            <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-[#9ca3af] inline-block" />غير متاح</span>
          </div>
        </div>

        {/* list */}
        <div className="bg-white rounded-2xl shadow-premium border border-surface-border/60 overflow-hidden">
          <div className="p-3 border-b border-surface-border/60 text-sm font-bold text-gray-700">السائقين</div>
          <div className="max-h-[560px] overflow-y-auto divide-y divide-surface-border/50">
            {!loading && drivers.length === 0 && (
              <div className="p-6 text-center text-sm text-gray-400">لا يوجد سائقين</div>
            )}
            {drivers.map(d => {
              const st = statusOf(d)
              const isSel = selected === d.id
              return (
                <button
                  key={d.id}
                  onClick={() => focus(d)}
                  className={`w-full text-right p-3 flex items-start gap-3 transition-colors ${isSel ? 'bg-primary-50' : 'hover:bg-surface-muted/60'}`}
                >
                  <span className="relative mt-0.5 flex-none">
                    <span className="w-9 h-9 rounded-full bg-primary-500 text-white text-xs font-bold grid place-items-center">
                      {d.name?.[0] ?? '؟'}
                    </span>
                    <span className="absolute -bottom-0.5 -left-0.5 w-3.5 h-3.5 rounded-full border-2 border-white" style={{ background: st.color }} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <b className="text-sm text-gray-800 truncate">{d.name}</b>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: st.color + '1f', color: st.color }}>
                        {st.label}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-gray-500">
                      <span className="flex items-center gap-1"><Package size={12} />{d.active_orders} طلب</span>
                      {d.pickup_orders > 0 && <span>استلام {d.pickup_orders}</span>}
                      {d.delivery_orders > 0 && <span>توصيل {d.delivery_orders}</span>}
                      {d.vehicle_number && <span>{d.vehicle_number}</span>}
                    </span>
                  </span>
                  <span className="flex flex-col gap-1.5 flex-none">
                    {d.phone && (
                      <a
                        href={`tel:${d.phone}`}
                        onClick={e => e.stopPropagation()}
                        className="w-8 h-8 rounded-lg bg-green-50 text-green-600 grid place-items-center hover:bg-green-100 transition-colors"
                        title="اتصال"
                      >
                        <Phone size={14} />
                      </a>
                    )}
                    {d.lat != null && d.lng != null && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${d.lat},${d.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 grid place-items-center hover:bg-blue-100 transition-colors"
                        title="فتح في خرائط جوجل"
                      >
                        <Navigation size={14} />
                      </a>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
        <MapPin size={12} />
        الموقع بيتحدث من تطبيق السائق كل 15 ثانية طول ما معاه طلبات شغالة
      </p>
    </div>
  )
}
