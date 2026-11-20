/** Pure geometry helpers for the city map: surge circles and lifted transfer arcs. */
import type { GeoPoint } from "../../../shared/domain";
import { haversineKm } from "../../../shared/geo";

const KM_PER_DEG_LAT = 110.574;
const kmPerDegLng = (lat: number) => 111.32 * Math.cos((lat * Math.PI) / 180);

/** A circle of `radiusKm` around `center` as a closed GeoJSON ring. */
export function circleRing(center: GeoPoint, radiusKm: number, steps = 72): [number, number][] {
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    ring.push([center.lng + (radiusKm * Math.cos(a)) / kmPerDegLng(center.lat), center.lat + (radiusKm * Math.sin(a)) / KM_PER_DEG_LAT]);
  }
  return ring;
}

export type ArcPoint = [lng: number, lat: number, altitude: number];

/**
 * A transfer arc: bowed sideways in plan view (so it reads as a curve even top-down)
 * and lifted in altitude (so it reads as a bridge when the map is pitched).
 */
export function arcPath(from: GeoPoint, to: GeoPoint, steps = 48): ArcPoint[] {
  const km = haversineKm(from, to);
  const midLat = (from.lat + to.lat) / 2;
  // Work in a local km plane so the sideways bow is the same shape at any bearing.
  const dx = (to.lng - from.lng) * kmPerDegLng(midLat);
  const dy = (to.lat - from.lat) * KM_PER_DEG_LAT;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const bow = km * 0.16;
  const lift = km * 1000 * 0.22;

  const points: ArcPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const s = Math.sin(Math.PI * t);
    const x = dx * t + nx * bow * s;
    const y = dy * t + ny * bow * s;
    points.push([from.lng + x / kmPerDegLng(midLat), from.lat + y / KM_PER_DEG_LAT, lift * s]);
  }
  return points;
}

/** Point at fraction `t` (0–1) along a sampled path. */
export function pointAlong(path: ArcPoint[], t: number): ArcPoint {
  const f = Math.min(Math.max(t, 0), 1) * (path.length - 1);
  const i = Math.floor(f);
  const a = path[i];
  const b = path[Math.min(i + 1, path.length - 1)];
  const k = f - i;
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}
