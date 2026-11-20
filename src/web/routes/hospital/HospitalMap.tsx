import { useMemo } from "react";
import type { SiteDTO } from "../../../shared/api";
import { CityMap, type MapArc, type MapMarker } from "../../components/map";
import { cn } from "../../lib/cn";
import { useSites } from "../../lib/queries";

export interface BankPin {
  siteId: string;
  /** Number drawn inside the marker (ranked results). */
  rank?: number;
  label: string;
  stale?: boolean;
}

interface HospitalMapProps {
  hospital: SiteDTO;
  banks: BankPin[];
  /** Bank emphasised on the map, with an arc to the hospital. */
  focusId?: string | null;
  /** `active` animates units flowing along the arc (in transit). */
  arcState?: MapArc["state"];
  onBankClick?: (siteId: string) => void;
  label: string;
  className?: string;
}

/**
 * City map centred on the acting hospital (square marker, the origin) with
 * blood banks as round markers. Coordinates come from /api/sites.
 */
export function HospitalMap({ hospital, banks, focusId, arcState = "suggested", onBankClick, label, className }: HospitalMapProps) {
  const sites = useSites().data;

  const { markers, arcs } = useMemo(() => {
    const byId = new Map((sites ?? []).map((s) => [s.id, s]));
    const bankMarkers: MapMarker[] = banks.flatMap((b) => {
      const site = byId.get(b.siteId);
      if (!site) return [];
      return [
        {
          id: b.siteId,
          lat: site.lat,
          lng: site.lng,
          label: b.label,
          rank: b.rank,
          tone: b.stale ? "warn" : "accent",
          highlighted: b.siteId === focusId,
          size: "md",
        } satisfies MapMarker,
      ];
    });
    const origin: MapMarker = {
      id: hospital.id,
      lat: hospital.lat,
      lng: hospital.lng,
      label: `${hospital.name} (you)`,
      tone: "info",
      shape: "square",
      size: "lg",
    };
    const focus = focusId ? byId.get(focusId) : undefined;
    const arc: MapArc[] = focus
      ? [{ id: `${focus.id}-${hospital.id}`, from: focus, to: hospital, state: arcState, tone: "bridge", emphasis: true }]
      : [];
    return { markers: [origin, ...bankMarkers], arcs: arc };
  }, [sites, banks, hospital, focusId, arcState]);

  // Remount when the set of banks changes so the view refits to the new results.
  const fitKey = banks.map((b) => b.siteId).sort().join(",");

  return (
    <CityMap
      key={`${hospital.id}:${fitKey}`}
      theme="clinical"
      markers={markers}
      arcs={arcs}
      onMarkerClick={onBankClick}
      center={hospital}
      zoom={12}
      fitToMarkers
      fitPadding={48}
      label={label}
      // maplibre-gl.css forces the map container to position:relative, so give it an explicit height.
      className={cn("[&_.maplibregl-map]:h-full", className)}
    />
  );
}
