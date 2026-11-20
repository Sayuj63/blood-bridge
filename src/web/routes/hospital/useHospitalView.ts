import { useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router";
import type { SiteDTO } from "../../../shared/api";
import { setActor } from "../../lib/api";
import { useSites } from "../../lib/queries";

export type HospitalTab = "request" | "stock";

/** X-Actor value for this view. Called before every write so the audit ledger names the hospital. */
export const actAs = (hospitalId: string): void => setActor(`hospital:${hospitalId}`);

/**
 * URL-backed view state: `?site=` (acting-as hospital), `?request=` (open request)
 * and `?tab=`. Other params such as `?embed=1` are preserved.
 */
export function useHospitalView() {
  const sites = useSites();
  const [params, setParams] = useSearchParams();

  const hospitals = useMemo<SiteDTO[]>(() => (sites.data ?? []).filter((s) => s.kind === "hospital"), [sites.data]);
  const siteParam = params.get("site");
  const hospital = hospitals.find((h) => h.id === siteParam) ?? hospitals[0] ?? null;
  const requestId = params.get("request");
  const tab: HospitalTab = params.get("tab") === "stock" ? "stock" : "request";

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
        if (id) p.set("request", id);
        else p.delete("request");
        p.delete("tab");
      }),
    [update],
  );
  const setTab = useCallback(
    (next: HospitalTab) =>
      update((p) => {
        if (next === "stock") p.set("tab", "stock");
        else p.delete("tab");
      }),
    [update],
  );

  return { sites, hospitals, hospital, requestId, tab, selectHospital, openRequest, setTab };
}
