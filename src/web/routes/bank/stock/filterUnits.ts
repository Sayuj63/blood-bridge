import type { UnitDTO } from "../../../../shared/api";
import { POLICY, type BloodGroup, type Component } from "../../../../shared/domain";

export type ExpiryWindow = "all" | "48h" | "7d";

const HOUR = 3_600_000;
const WINDOW_MS: Record<Exclude<ExpiryWindow, "all">, number> = { "48h": POLICY.expiringSoonHours * HOUR, "7d": 7 * 24 * HOUR };

export interface UnitFilter {
  scan: string;
  group: BloodGroup | "all";
  component: Component | "all";
  window: ExpiryWindow;
}

/** Units matching the filters, soonest expiry first. `scan` matches any part of the unit ID, case-insensitively. */
export function filterUnits(units: readonly UnitDTO[], f: UnitFilter, now: number = Date.now()): UnitDTO[] {
  const needle = f.scan.trim().toLowerCase();
  return units
    .filter(
      (u) =>
        (!needle || u.id.toLowerCase().includes(needle)) &&
        (f.group === "all" || u.bloodGroup === f.group) &&
        (f.component === "all" || u.component === f.component) &&
        (f.window === "all" || u.expiresAt - now <= WINDOW_MS[f.window]),
    )
    .sort((a, b) => a.expiresAt - b.expiresAt);
}
