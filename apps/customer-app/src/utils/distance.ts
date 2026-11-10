export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Delivery coverage and the delivery fee, mirroring the database so the customer is
// shown the number that `place_order` will store. The database side lives in
// public._delivery_zones / _in_delivery_zone / _delivery_fee_for.

export type Zone = { name?: string; lat: number; lng: number; radius_km: number; fee?: number }

// `Number(x) || fallback` reads a real 0 as "missing" and returns the fallback, which
// made a per-kilometre rate of zero impossible to express. Only a value that is
// absent or not a number falls back here.
export function num(v: unknown, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

// A zone counts only with a usable lat, lng and a positive radius, so a half-typed
// entry in the dashboard narrows the area instead of locking every customer out.
export function parseZones(raw: unknown): Zone[] {
  let v: any = raw
  if (typeof v === 'string') {
    try { v = JSON.parse(v) } catch { return [] }
  }
  if (!Array.isArray(v)) return []
  const out: Zone[] = []
  for (const z of v) {
    if (!z || typeof z !== 'object') continue
    const lat = Number(z.lat), lng = Number(z.lng), r = Number(z.radius_km)
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !(r > 0)) continue
    const fee = Number(z.fee)
    out.push({ name: z.name, lat, lng, radius_km: r, fee: Number.isFinite(fee) ? fee : undefined })
  }
  return out
}

// Inside any zone; with no zones, inside the single circle around the laundry, which
// is what the app did before the list existed.
export function inZone(
  lat: number, lng: number, zones: Zone[],
  laundryLat: number, laundryLng: number, maxZoneKm: number,
): boolean {
  if (zones.length === 0) return haversineKm(laundryLat, laundryLng, lat, lng) <= maxZoneKm
  return zones.some(z => haversineKm(z.lat, z.lng, lat, lng) <= z.radius_km)
}

// A zone may carry its own flat fee; otherwise the base plus the kilometres past the
// free ones. The first matching zone wins, as it does in the database.
export function deliveryFeeFor(
  lat: number, lng: number, zones: Zone[],
  o: { base: number; perKm: number; freeKm: number; laundryLat: number; laundryLng: number },
): number {
  const hit = zones.find(z => z.fee !== undefined && haversineKm(z.lat, z.lng, lat, lng) <= z.radius_km)
  if (hit) return hit.fee as number
  const dist = haversineKm(o.laundryLat, o.laundryLng, lat, lng)
  return o.base + (dist > o.freeKm ? Math.round((dist - o.freeKm) * o.perKm) : 0)
}
