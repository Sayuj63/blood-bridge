import { useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router";
import type { SiteDTO } from "../../../shared/api";
import { setActor } from "../../lib/api";
import { useSites } from "../../lib/queries";

export type HospitalSection = "overview" | "inventory" | "insights" | "reservations" | "transfers";

/** Legacy alias preserved for backward compatibility. */
export type HospitalTab = HospitalSection;

const VALID_SECTIONS = new Set<HospitalSection>(["overview", "inventory", "insights", "reservations", "transfers"]);

function parseSection(tabParam: string | null, requestId: string | null): HospitalSection {
  if (tabParam === "stock") return "inventory";
  if (tabParam === "request" || tabParam === "find") return "overview";
  if (tabParam && VALID_SECTIONS.has(tabParam as HospitalSection)) {
    return tabParam as HospitalSection;
  }
  if (requestId) return "reservations";
  return "overview";
}

/** X-Actor value for this view. Called before every write so the audit ledger names the hospital. */
export const actAs = (hospitalId: string): void => setActor(`hospital:${hospitalId}`);

/**
 * URL-backed view state:
 * - `?site=` (acting-as hospital)
 * - `?tab=` (`overview | inventory | insights | reservations | transfers`, plus legacy `request | stock | find`)
 * - `?request=` (open request in tracker)
 * - `?embed=1` (preserved for `/stage` iframes)
 */
export function useHospitalView() {
  const sites = useSites();
  const [params, setParams] = useSearchParams();

  const embed = params.get("embed") === "1";
  const hospitals = useMemo<SiteDTO[]>(() => (sites.data ?? []).filter((s) => s.kind === "hospital"), [sites.data]);
  const siteParam = params.get("site");
  const defaultHospital = hospitals.find((h) => h.id === "hsp-sion-ltmgh") ?? hospitals[0] ?? null;
  const hospital = hospitals.find((h) => h.id === siteParam) ?? defaultHospital;
  const requestId = params.get("request");
  const section = parseSection(params.get("tab"), requestId);

  const update = useCallback(
    (mutate: (next: URLSearchParams) => void) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          mutate(next);
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  // Record the default choice in the URL so the view is shareable and survives reloads.
  useEffect(() => {
    if (hospital && siteParam !== hospital.id) update((p) => p.set("site", hospital.id));
  }, [hospital, siteParam, update]);

  useEffect(() => {
    if (hospital) actAs(hospital.id);
  }, [hospital]);

  const selectHospital = useCallback(
    (id: string) =>
      update((p) => {
        p.set("site", id);
        p.delete("request");
      }),
    [update],
  );

  const openRequest = useCallback(
    (id: string | null) =>
      update((p) => {
        if (id) {
          p.set("request", id);
          p.set("tab", "reservations");
        } else {
          p.delete("request");
        }
      }),
    [update],
  );

  const setSection = useCallback(
    (next: HospitalSection) =>
      update((p) => {
        p.set("tab", next);
        if (next !== "reservations") p.delete("request");
      }),
    [update],
  );

  return {
    sites,
    hospitals,
    hospital,
    requestId,
    section,
    tab: section,
    embed,
    selectHospital,
    openRequest,
    setSection,
    setTab: setSection,
  };
}
