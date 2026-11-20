import { MapboxOverlay } from "@deck.gl/mapbox";
import { PathLayer, ScatterplotLayer } from "@deck.gl/layers";
import { LngLatBounds, Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { GeoPoint } from "../../../shared/domain";
import { cn } from "../../lib/cn";
import { MAP_STYLE_URL, toneHex, toneRgb, type ThemeName, type Tone } from "../../styles/tokens";
import { arcPath, circleRing, pointAlong, type ArcPoint } from "./geometry";

// MapLibre 6 resolves its worker relative to its own module, which breaks once Vite
// pre-bundles it. Point it at the self-contained worker file explicitly.
setWorkerUrl(maplibreWorkerUrl);

/** Mumbai, centred between the island city and the eastern suburbs. */
export const MUMBAI_CENTER: GeoPoint = { lat: 19.07, lng: 72.88 };

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  /** Accessible name and hover title, e.g. "KEM Hospital Blood Bank — 42 units". */
  label: string;
  /** Semantic colour. Ignored when `color` is set. */
  tone?: Tone;
  /** Explicit colour, e.g. a blood-group colour. */
  color?: string;
  /** Shows a rank number inside a larger marker (search results). */
  rank?: number;
  /** Enlarged with a halo — the selected or best option. */
  highlighted?: boolean;
  /** Pulsing ring, for sites at risk. */
  pulse?: boolean;
  /** Hospitals render square, blood banks round. */
  shape?: "round" | "square";
  size?: "sm" | "md" | "lg";
}

export interface MapArc {
  id: string;
  from: GeoPoint;
  to: GeoPoint;
  /** `suggested` draws a faint arc; `active` draws a solid arc with units flowing along it. */
  state?: "suggested" | "active";
  tone?: Tone;
  /** Brightened and widened, e.g. while its list row is hovered. */
  emphasis?: boolean;
}

export interface SurgeCircle {
  lat: number;
  lng: number;
  radiusKm: number;
}

export interface CityMapProps {
  /** `command` = dark OpenFreeMap style, `clinical` = light (Positron). */
  theme: ThemeName;
  markers?: MapMarker[];
  arcs?: MapArc[];
  /** Surge impact radius, drawn as a red zone. */
  surge?: SurgeCircle | null;
  onMarkerClick?: (id: string) => void;
  center?: GeoPoint;
  zoom?: number;
  pitch?: number;
  bearing?: number;
  /** Fit the view to markers the first time they arrive. */
  fitToMarkers?: boolean;
  /** Extra padding (px) when fitting, e.g. to clear side panels. */
  fitPadding?: number | { top: number; bottom: number; left: number; right: number };
  interactive?: boolean;
  /** Accessible description of what the map shows. */
  label: string;
  className?: string;
}

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const DRAW_MS = 1100;
const PACKET_MS = 2200;

/**
 * MapLibre + OpenFreeMap city map with DOM site markers (keyboard focusable when
 * clickable), a surge zone, and deck.gl transfer arcs with flowing units.
 * Handles container resize; switching `theme` rebuilds the map with the matching style.
 */
export function CityMap({
  theme,
  markers = [],
  arcs = [],
  surge = null,
  onMarkerClick,
  center = MUMBAI_CENTER,
  zoom = 11,
  pitch = 0,
  bearing = 0,
  fitToMarkers = false,
  fitPadding = 60,
  interactive = true,
  label,
  className,
}: CityMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const markerRefs = useRef(new Map<string, Marker>());
  const fittedRef = useRef(false);
  const arcSeenAt = useRef(new Map<string, number>());
  const clickRef = useRef(onMarkerClick);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    clickRef.current = onMarkerClick;
  }, [onMarkerClick]);

  /* Map lifecycle — rebuilt when the theme (style) or interactivity changes. */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const map = new MapLibreMap({
      container,
      style: MAP_STYLE_URL[theme],
      center: [center.lng, center.lat],
      zoom,
      pitch,
      bearing,
      interactive,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      cooperativeGestures: false,
    });
    if (interactive) map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
    mapRef.current = map;
    fittedRef.current = false;
    const markerMap = markerRefs.current;

    map.on("load", () => {
      map.addSource("surge", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "surge-fill",
        type: "fill",
        source: "surge",
        paint: { "fill-color": toneHex(theme, "critical"), "fill-opacity": 0.14 },
      });
      map.addLayer({
        id: "surge-line",
        type: "line",
        source: "surge",
        paint: { "line-color": toneHex(theme, "critical"), "line-width": 2, "line-dasharray": [2, 2], "line-opacity": 0.9 },
      });
      const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
      map.addControl(overlay);
      overlayRef.current = overlay;
      setReady(true);
    });

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(container);

    return () => {
      ro.disconnect();
      markerMap.forEach((m) => m.remove());
      markerMap.clear();
      overlayRef.current = null;
      mapRef.current = null;
      setReady(false);
      map.remove();
    };
    // Camera props are initial values only; later changes are applied below without a rebuild.
  }, [theme, interactive]);

  /* Camera updates after mount. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || fitToMarkers) return;
    map.easeTo({ center: [center.lng, center.lat], zoom, pitch, bearing, duration: prefersReducedMotion() ? 0 : 900 });
  }, [ready, center.lat, center.lng, zoom, pitch, bearing, fitToMarkers]);

  /* Site markers: diffed by id so existing DOM nodes (and focus) survive updates. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const existing = markerRefs.current;
    const next = new Set(markers.map((m) => m.id));

    existing.forEach((marker, id) => {
      if (!next.has(id)) {
        marker.remove();
        existing.delete(id);
      }
    });

    for (const m of markers) {
      let marker = existing.get(m.id);
      if (!marker) {
        const el = document.createElement(onMarkerClick ? "button" : "span");
        if (el instanceof HTMLButtonElement) {
          el.type = "button";
          el.addEventListener("click", () => clickRef.current?.(m.id));
        }
        marker = new Marker({ element: el }).setLngLat([m.lng, m.lat]).addTo(map);
        existing.set(m.id, marker);
      } else {
        marker.setLngLat([m.lng, m.lat]);
      }
      paintMarker(marker.getElement(), m, theme, Boolean(onMarkerClick));
    }

    if (fitToMarkers && !fittedRef.current && markers.length > 1) {
      const bounds = new LngLatBounds();
      markers.forEach((m) => bounds.extend([m.lng, m.lat]));
      map.fitBounds(bounds, { padding: fitPadding, duration: 0, maxZoom: 13, pitch, bearing });
      fittedRef.current = true;
    }
  }, [markers, ready, theme, onMarkerClick, fitToMarkers, fitPadding, pitch, bearing]);

  /* Surge zone. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource("surge") as GeoJSONSource | undefined;
    source?.setData({
      type: "FeatureCollection",
      features: surge
        ? [
            {
              type: "Feature",
              properties: {},
              geometry: { type: "Polygon", coordinates: [circleRing({ lat: surge.lat, lng: surge.lng }, surge.radiusKm)] },
            },
          ]
        : [],
    });
  }, [surge, ready]);

  /* Transfer arcs: drawn in once, then units flow along active arcs. */
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !ready) return;
    const reduced = prefersReducedMotion();
    const start = performance.now();
    const seen = arcSeenAt.current;
    const live = new Set(arcs.map((a) => a.id));
    seen.forEach((_, id) => !live.has(id) && seen.delete(id));
    arcs.forEach((a) => !seen.has(a.id) && seen.set(a.id, reduced ? -DRAW_MS : start));

    const paths = arcs.map((a) => ({ arc: a, path: arcPath(a.from, a.to) }));
    let frame = 0;

    const render = (now: number) => {
      const visible = paths.map(({ arc, path }) => {
        const progress = Math.min(1, (now - (seen.get(arc.id) ?? 0)) / DRAW_MS);
        const eased = 1 - (1 - progress) ** 3;
        const cut = Math.max(2, Math.ceil(eased * path.length));
        return { arc, path: path.slice(0, cut), full: path, done: progress >= 1 };
      });
      type Row = (typeof visible)[number];
      const rgb = (r: Row) => toneRgb(theme, r.arc.tone ?? "bridge");
      const alpha = (r: Row, active: number, suggested: number) =>
        r.arc.emphasis ? 255 : r.arc.state === "active" ? active : suggested;

      const packets = visible
        .filter((r) => r.done && r.arc.state === "active")
        .flatMap((r, i) =>
          [0, 0.5].map((offset) => ({
            row: r,
            position: pointAlong(r.full, reduced ? 0.5 : (((now / PACKET_MS) + offset + i * 0.17) % 1)),
          })),
        );

      overlay.setProps({
        layers: [
          new PathLayer<Row>({
            id: "arc-glow",
            data: visible,
            getPath: (r) => r.path,
            getColor: (r) => [...rgb(r), r.arc.emphasis ? 90 : 40],
            getWidth: (r) => (r.arc.emphasis ? 16 : 10),
            widthUnits: "pixels",
            capRounded: true,
            jointRounded: true,
            updateTriggers: { getPath: now, getColor: theme },
          }),
          new PathLayer<Row>({
            id: "arc-core",
            data: visible,
            getPath: (r) => r.path,
            getColor: (r) => [...rgb(r), alpha(r, 235, 150)],
            getWidth: (r) => (r.arc.emphasis ? 4.5 : r.arc.state === "active" ? 3 : 2),
            widthUnits: "pixels",
            capRounded: true,
            jointRounded: true,
            updateTriggers: { getPath: now, getColor: theme },
          }),
          new ScatterplotLayer<(typeof packets)[number]>({
            id: "arc-packets",
            data: packets,
            getPosition: (p) => p.position as ArcPoint,
            getFillColor: [255, 255, 255, 240],
            getLineColor: (p) => [...rgb(p.row), 255],
            getRadius: 4,
            radiusUnits: "pixels",
            stroked: true,
            lineWidthUnits: "pixels",
            getLineWidth: 2.5,
            updateTriggers: { getPosition: now },
          }),
        ],
      });

      const animating = visible.some((r) => !r.done) || (!reduced && packets.length > 0);
      if (animating) frame = requestAnimationFrame(render);
    };

    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [arcs, ready, theme]);

  return (
    <div className={cn("relative isolate overflow-hidden bg-surface-2", className)}>
      <div ref={containerRef} className="h-full w-full" role="region" aria-label={label} />
      {markers.length > 0 ? (
        <ul className="sr-only" aria-label="Sites on the map">
          {markers.map((m) => (
            <li key={m.id}>{m.label}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Style one marker element in place. Plain DOM: markers live outside React's tree. */
function paintMarker(el: HTMLElement, m: MapMarker, theme: ThemeName, clickable: boolean): void {
  const color = m.color ?? toneHex(theme, m.tone ?? "neutral");
  const px = m.rank !== undefined ? 26 : m.size === "lg" ? 18 : m.size === "sm" ? 9 : 13;
  const scale = m.highlighted ? 1.35 : 1;
  const radius = m.shape === "square" ? "3px" : "9999px";
  const ink = theme === "command" ? "#06111c" : "#ffffff";

  // Keep MapLibre's own classes: they position the marker absolutely on the map.
  const own = [...el.classList].filter((c) => c.startsWith("maplibregl-"));
  el.className = cn(
    own,
    "group grid place-items-center",
    clickable && "cursor-pointer focus-ring rounded-full",
    m.highlighted ? "z-20" : m.pulse ? "z-10" : "z-0",
  );
  el.setAttribute("aria-label", m.label);
  el.title = m.label;
  el.style.width = `${px * scale + 8}px`;
  el.style.height = `${px * scale + 8}px`;
  el.replaceChildren();

  if (m.pulse) {
    const ring = document.createElement("span");
    ring.setAttribute("aria-hidden", "true");
    ring.className = "absolute inset-0 animate-pulse-ring";
    ring.style.borderRadius = radius;
    ring.style.background = color;
    el.append(ring);
  }

  const dot = document.createElement("span");
  dot.setAttribute("aria-hidden", "true");
  dot.className = "relative grid place-items-center font-numeric font-bold transition-transform duration-200 group-hover:scale-110";
  Object.assign(dot.style, {
    width: `${px * scale}px`,
    height: `${px * scale}px`,
    borderRadius: radius,
    background: color,
    color: ink,
    fontSize: `${12 * scale}px`,
    boxShadow: m.highlighted
      ? `0 0 0 3px ${theme === "command" ? "#06111c" : "#ffffff"}, 0 0 0 6px ${color}`
      : `0 0 0 2px ${theme === "command" ? "rgb(6 17 28 / 0.85)" : "rgb(255 255 255 / 0.95)"}`,
  });
  if (m.rank !== undefined) dot.textContent = String(m.rank);
  el.append(dot);
}
