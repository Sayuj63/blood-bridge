/**
 * Real open data behind the landing story: Mumbai blood centres (data.gov.in
 * directory + OpenStreetMap coordinates) and an e-RaktKosh stock snapshot.
 * Read at build time so the story renders even before the API is up.
 */
import banksJson from "../../../../data/mumbai/blood_banks.json";
import snapshotJson from "../../../../data/mumbai/stock_snapshot.json";
import { BLOOD_GROUPS, COMPONENTS, type BloodGroup, type Component, type GeoPoint } from "../../../shared/domain";
import { haversineKm } from "../../../shared/geo";

export interface StoryBank extends GeoPoint {
  key: string;
  name: string;
  area: string;
}

type GroupStock = Record<Component, number>;

interface Snapshot {
  fetchedAt: string;
  /** "YYYY-MM-DD HH:mm:ss" in IST, per bank: when the bank last updated e-RaktKosh. */
  bankLastUpdatedIST: Record<string, string>;
  banks: Record<string, Partial<Record<BloodGroup, Partial<GroupStock>>>>;
}

export const STORY_BANKS: StoryBank[] = (banksJson as { id: string; name: string; area: string; lat: number; lng: number }[]).map(
  (b) => ({ key: b.id, name: b.name, area: b.area, lat: b.lat, lng: b.lng }),
);

const snapshot = snapshotJson as Snapshot;

/** When the e-RaktKosh snapshot was taken. */
export const SNAPSHOT_AT = Date.parse(snapshot.fetchedAt);

/** Units a bank reported for one group and component (0 when missing). */
export function reported(bankKey: string, group: BloodGroup, component: Component): number {
  return snapshot.banks[bankKey]?.[group]?.[component] ?? 0;
}

const reportingBanks = STORY_BANKS.filter((b) => snapshot.banks[b.key]);

/** Hours between each bank's last e-RaktKosh update and the moment we fetched the snapshot. */
export const updateAgesHours = Object.values(snapshot.bankLastUpdatedIST)
  .map((s) => (SNAPSHOT_AT - Date.parse(`${s.replace(" ", "T")}+05:30`)) / 3_600_000)
  .filter((h) => Number.isFinite(h));

/** Figures computed straight from the snapshot — real, and traceable to the file. */
export const SNAPSHOT_FACTS = {
  centres: reportingBanks.length,
  zeroONegPlatelets: reportingBanks.filter((b) => reported(b.key, "O-", "platelets") === 0).map((b) => b.key),
  oNegPlateletsCity: reportingBanks.reduce((n, b) => n + reported(b.key, "O-", "platelets"), 0),
  /** Freshest and stalest bank update, in whole hours, at snapshot time. */
  updateAgeHours: {
    min: Math.round(Math.min(...updateAgesHours)),
    max: Math.round(Math.max(...updateAgesHours)),
  },
  totalUnits: reportingBanks.reduce(
    (n, b) => n + BLOOD_GROUPS.reduce((m, g) => m + COMPONENTS.reduce((k, c) => k + reported(b.key, g, c), 0), 0),
    0,
  ),
};

/**
 * The paradox pair for O+ platelets: the bank holding the most, and the nearest
 * bank holding none (or the least).
 */
function paradoxPair() {
  const g: BloodGroup = "O+";
  const c: Component = "platelets";
  const ranked = [...reportingBanks].sort((a, b) => reported(b.key, g, c) - reported(a.key, g, c));
  const full = ranked[0];
  const others = reportingBanks.filter((b) => b.key !== full?.key);
  const minUnits = Math.min(...others.map((b) => reported(b.key, g, c)));
  const dry = others
    .filter((b) => reported(b.key, g, c) === minUnits)
    .sort((a, b) => haversineKm(full, a) - haversineKm(full, b))[0];
  if (!full || !dry) return null;
  return {
    group: g,
    full,
    fullUnits: reported(full.key, g, c),
    dry,
    dryUnits: minUnits,
    km: Math.round(haversineKm(full, dry) * 10) / 10,
  };
}

export const PARADOX = paradoxPair();

/** Kurla, on the Mithi river — the flood scenario's epicentre. */
export const KURLA: GeoPoint = { lat: 19.0703, lng: 72.8822 };
