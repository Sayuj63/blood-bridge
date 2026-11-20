import { useMemo } from "react";
import type { ForecastDTO, SiteDTO, TransferBoardDTO } from "../../../shared/api";
import type { MapArc, MapMarker } from "../../components/map/CityMap";
import { formatHours } from "../../lib/format";
import { stockoutTone } from "./severity";

/** Site risk markers and transfer arcs for the command map. */
export function useCommandMap(
  sites: SiteDTO[] | undefined,
  forecast: ForecastDTO | undefined,
  board: TransferBoardDTO | undefined,
  focused: string | null,
) {
  const risk = useMemo(() => new Map((forecast?.sites ?? []).map((r) => [r.siteId, r])), [forecast]);
  const byId = useMemo(() => new Map((sites ?? []).map((s) => [s.id, s])), [sites]);

  const focusedEnds = useMemo(() => {
    const s = board?.suggestions.find((x) => x.key === focused);
    const t = board?.active.find((x) => x.id === focused);
    const pick = s ?? t;
    return pick ? new Set([pick.fromSiteId, pick.toSiteId]) : null;
  }, [board, focused]);

  const markers = useMemo<MapMarker[]>(
    () =>
      (sites ?? []).map((s) => {
        const r = risk.get(s.id);
        const hours = r?.earliestStockoutHours ?? null;
        const tone = r ? stockoutTone(hours) : "neutral";
        const status = hours === null ? "covered for the forecast horizon" : `first stock-out in ${formatHours(hours)}`;
        return {
          id: s.id,
          lat: s.lat,
          lng: s.lng,
          label: `${s.name}, ${s.areaName}: ${status}`,
          tone,
          shape: s.kind === "hospital" ? "square" : "round",
          size: s.kind === "hospital" ? "sm" : tone === "critical" ? "lg" : "md",
          pulse: tone === "critical",
          highlighted: focusedEnds?.has(s.id) ?? false,
        };
      }),
    [sites, risk, focusedEnds],
  );

  const arcs = useMemo<MapArc[]>(() => {
    if (!board) return [];
    const at = (id: string) => {
      const s = byId.get(id);
      return s ? { lat: s.lat, lng: s.lng } : null;
    };
    const list: MapArc[] = [];
    for (const s of board.suggestions) {
      const from = at(s.fromSiteId);
      const to = at(s.toSiteId);
      if (from && to) list.push({ id: s.key, from, to, state: "suggested", emphasis: focused === s.key });
    }
    for (const t of board.active) {
      if (t.status !== "approved") continue;
      const from = at(t.fromSiteId);
      const to = at(t.toSiteId);
      if (from && to) list.push({ id: t.id, from, to, state: "active", emphasis: focused === t.id });
    }
    return list;
  }, [board, byId, focused]);

  return { markers, arcs };
}
