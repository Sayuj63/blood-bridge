import { POLICY, type GeoPoint } from "./domain";

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in kilometres. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Rough urban ETA. Road distance is approximated as 1.3× straight-line distance.
 * Good enough for ranking and demo ETAs; swap for a routing engine (OSRM) later.
 */
export function etaMinutes(a: GeoPoint, b: GeoPoint, speedKmh: number = POLICY.cityTravelSpeedKmh): number {
  const roadKm = haversineKm(a, b) * 1.3;
  return Math.round((roadKm / speedKmh) * 60 + POLICY.handlingMinutes);
}

/** Round a coordinate to ~1 km so donor locations are never exact (privacy, PRD §9). */
export function approximate(point: GeoPoint, decimals = 2): GeoPoint {
  const f = 10 ** decimals;
  return { lat: Math.round(point.lat * f) / f, lng: Math.round(point.lng * f) / f };
}
