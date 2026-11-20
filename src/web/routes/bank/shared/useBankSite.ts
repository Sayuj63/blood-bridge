import { createContext, useContext, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router";
import type { SiteDTO } from "../../../../shared/api";
import { setActor } from "../../../lib/api";
import { useSites } from "../../../lib/queries";

export interface BankSite {
  site: SiteDTO;
  /** X-Actor value for this bank, recorded in the audit ledger. */
  actor: string;
}

export const actorFor = (siteId: string): string => `bank:${siteId}`;

/**
 * The bank the operator is acting as, from `?site=`. Falls back to the first
 * blood bank (and writes it to the URL) when the param is missing or unknown.
 */
export function useActingBank() {
  const sites = useSites();
  const [params, setParams] = useSearchParams();
  const requested = params.get("site");

  const banks = useMemo(
    () => (sites.data ?? []).filter((s) => s.kind === "blood_bank").sort((a, b) => a.name.localeCompare(b.name)),
    [sites.data],
  );
  const site = banks.find((b) => b.id === requested) ?? banks[0] ?? null;

  useEffect(() => {
    if (site && site.id !== requested) {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("site", site.id);
          return next;
        },
        { replace: true },
      );
    }
  }, [site, requested, setParams]);

  useEffect(() => {
    if (site) setActor(actorFor(site.id));
  }, [site]);

  const selectSite = (id: string) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("site", id);
      return next;
    });

  return { sites, banks, site, selectSite };
}

export const BankSiteContext = createContext<BankSite | null>(null);

export function useBankSite(): BankSite {
  const ctx = useContext(BankSiteContext);
  if (!ctx) throw new Error("useBankSite must be used inside the blood bank view");
  return ctx;
}
