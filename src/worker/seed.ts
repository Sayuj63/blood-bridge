/**
 * Demo city built from REAL open data (see docs/DATA_SOURCES.md):
 *  - Blood banks & hospitals: data.gov.in Blood Bank Directory (GODL-India) + OpenStreetMap (ODbL)
 *  - Stock counts by group × component: e-RaktKosh public availability snapshot (MoHFW/NBTC)
 *  - Each bank's own "last updated" time from that snapshot (kept as a relative age)
 *  - Shelf lives (Drugs Rules, G.S.R. 166(E) 2020), group shares (Agrawal 2014, Mumbai),
 *    collection volume (SBTC figures via press) — data/mumbai/calibration.json
 *
 * MODELLED (labelled in the app): per-unit expiry dates (e-RaktKosh publishes counts, not bags),
 * daily demand per bank, surge multipliers.
 * SYNTHETIC (privacy, PRD §9): donors, patients, requests.
 *
 * Generation is deterministic (seeded PRNG) and relative to `now`.
 */
import banksJson from "../../data/mumbai/blood_banks.json";
import calibrationJson from "../../data/mumbai/calibration.json";
import floodZonesJson from "../../data/mumbai/flood_zones.json";
import hospitalsJson from "../../data/mumbai/hospitals.json";
import snapshotJson from "../../data/mumbai/stock_snapshot.json";
import { BLOOD_GROUPS, COMPONENTS, type BloodGroup, type Component, type Language } from "../shared/domain";
import { approximate, haversineKm } from "../shared/geo";
import type * as schema from "./db/schema";

export const CITY = "Mumbai";

interface FacilityRecord {
  id: string;
  name: string;
  category: string;
  address: string;
  area: string;
  phone: string | null;
  lat: number;
  lng: number;
  source: string;
}
interface FloodZoneRecord {
  id: string;
  name: string;
  lat: number;
  lng: number;
  note: string;
}
type StockCounts = Record<string, Record<BloodGroup, Record<Component, number>>>;

const BANKS = banksJson as FacilityRecord[];
const HOSPITALS = hospitalsJson as FacilityRecord[];
const FLOOD_ZONES = floodZonesJson as FloodZoneRecord[];
const SNAPSHOT = snapshotJson as unknown as {
  fetchedAt: string;
  bankLastUpdatedIST: Record<string, string>;
  banks: StockCounts;
};
const CALIBRATION = calibrationJson as unknown as {
  bloodGroupShare: Record<BloodGroup, number>;
  shelfLifeDays: Record<Component, number>;
  donorIntervalDays: { male: number; female: number };
  annualCollection: { mumbai_jan_may_2026_units: number };
};

export const SHELF_LIFE_DAYS = CALIBRATION.shelfLifeDays;
export const SNAPSHOT_FETCHED_AT = Date.parse(SNAPSHOT.fetchedAt);

/* ───────────────────────────── Areas ───────────────────────────── */

export interface Area {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
/** "Andheri (E)" and "Marol, Andheri (E)" both become the "Andheri" locality. */
const localityName = (area: string) => area.replace(/\s*\(.*?\)\s*/g, "").split(/[,/]/).pop()!.trim();

/** Real localities: centroid of the facilities in each, used for donor sign-up and map labels. */
export const AREAS: Area[] = (() => {
  const groups = new Map<string, { name: string; pts: { lat: number; lng: number }[] }>();
  for (const f of [...BANKS, ...HOSPITALS]) {
    const name = localityName(f.area);
    const id = slug(name);
    const g = groups.get(id) ?? { name, pts: [] };
    g.pts.push({ lat: f.lat, lng: f.lng });
    groups.set(id, g);
  }
  for (const z of FLOOD_ZONES) {
    const name = localityName(z.name.split("(")[0]);
    if (!groups.has(slug(name))) groups.set(slug(name), { name, pts: [{ lat: z.lat, lng: z.lng }] });
  }
  return [...groups.entries()]
    .map(([id, g]) => ({
      id,
      name: g.name,
      lat: g.pts.reduce((s, p) => s + p.lat, 0) / g.pts.length,
      lng: g.pts.reduce((s, p) => s + p.lng, 0) / g.pts.length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
})();

/** Documented chronic flooding spots — real places where a simulated surge can be centred. */
export const SURGE_ZONES: Area[] = FLOOD_ZONES.map((z) => ({ id: z.id, name: z.name.split("(")[0].trim(), lat: z.lat, lng: z.lng }));

export const areaById = (id: string) => AREAS.find((a) => a.id === id) ?? SURGE_ZONES.find((z) => z.id === id);

/** Kurla sits on the Mithi river, the city's best-documented flood stretch; Dadar is its busiest rail hub. */
export const SURGE_DEFAULT_AREA = { flood: "fz-kurla-mithi", mass_casualty: "dadar" } as const;

const nearestAreaId = (p: { lat: number; lng: number }) =>
  AREAS.reduce((best, a) => (haversineKm(a, p) < haversineKm(best, p) ? a : best)).id;

/* ───────────────────────────── Demand model ───────────────────────────── */

/**
 * Daily issue rate for the network (MODELLED, documented in DATA_SOURCES.md):
 *  - Red cells: Mumbai collected 1.27 lakh units Jan–May 2026 (151 days) across ~58 centres;
 *    our 25 centres take a proportional share, assuming steady state (issued ≈ collected).
 *  - Other components: assumed days of cover against the real snapshot stock.
 */
const MUMBAI_CENTRES = 58;
const COLLECTION_DAYS = 151;
const ASSUMED_COVER_DAYS: Record<Exclude<Component, "red_cells">, number> = {
  platelets: 3, // must sit well inside the 5-day shelf life
  whole_blood: 7,
  plasma: 60, // FFP keeps a year; India is known to hold plasma surplus
};

function networkDemandPerDay(stock: StockCounts): Record<Component, number> {
  const totals = Object.fromEntries(COMPONENTS.map((c) => [c, 0])) as Record<Component, number>;
  for (const groups of Object.values(stock)) for (const g of BLOOD_GROUPS) for (const c of COMPONENTS) totals[c] += groups[g]?.[c] ?? 0;
  const share = Object.keys(stock).length / MUMBAI_CENTRES;
  return {
    red_cells: (CALIBRATION.annualCollection.mumbai_jan_may_2026_units / COLLECTION_DAYS) * share,
    platelets: totals.platelets / ASSUMED_COVER_DAYS.platelets,
    whole_blood: totals.whole_blood / ASSUMED_COVER_DAYS.whole_blood,
    plasma: totals.plasma / ASSUMED_COVER_DAYS.plasma,
  };
}

/* ───────────────────────────── Generation ───────────────────────────── */

const DAY = 86_400_000;
const HOUR = 3_600_000;

/** mulberry32 — tiny deterministic PRNG so every reset yields the same city. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** e-RaktKosh reports times in IST without an offset. */
const parseIst = (s: string) => Date.parse(`${s.replace(" ", "T")}+05:30`);

type SiteRow = typeof schema.sites.$inferInsert;
type UnitRow = typeof schema.units.$inferInsert;
type DemandRow = typeof schema.demandBaseline.$inferInsert;
type DonorRow = typeof schema.donors.$inferInsert;
type DonationRow = typeof schema.donations.$inferInsert;

export interface SeedData {
  sites: SiteRow[];
  units: UnitRow[];
  demand: DemandRow[];
  donors: DonorRow[];
  donations: DonationRow[];
}

const shortName = (name: string) =>
  name
    .replace(/\b(Blood (Bank|Centre|Center)|Hospital|Municipal|General|Medical|Research|Centre|Center|Trust)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[,\s-]+$/, "")
    .trim() || name;

export function generateSeed(now: number): SeedData {
  const rand = prng(20261120);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];

  const sites: SiteRow[] = [
    ...BANKS.map((b) => {
      // Keep each bank's real data age relative to when we took the snapshot.
      const updated = SNAPSHOT.bankLastUpdatedIST[b.id];
      const age = updated ? Math.max(0, SNAPSHOT_FETCHED_AT - parseIst(updated)) : 24 * HOUR;
      return { kind: "blood_bank" as const, record: b, lastSyncAt: now - age };
    }),
    ...HOSPITALS.map((h) => ({ kind: "hospital" as const, record: h, lastSyncAt: now })),
  ].map(({ kind, record, lastSyncAt }) => ({
    id: record.id,
    kind,
    name: record.name,
    shortName: shortName(record.name),
    areaId: nearestAreaId(record),
    address: record.address,
    phone: record.phone ?? "Not listed in public directory",
    lat: record.lat,
    lng: record.lng,
    verified: true,
    lastSyncAt,
  }));

  // ── Units: one row per real reported bag; expiry MODELLED across the legal shelf life ──
  const units: UnitRow[] = [];
  let serial = 0;
  for (const bank of BANKS) {
    const counts = SNAPSHOT.banks[bank.id];
    if (!counts) continue;
    for (const g of BLOOD_GROUPS) {
      for (const c of COMPONENTS) {
        const n = counts[g]?.[c] ?? 0;
        const life = SHELF_LIFE_DAYS[c] * DAY;
        for (let i = 0; i < n; i++) {
          serial++;
          // Remaining life uniform between 5% and 100% of shelf life (stock of mixed age).
          const expiresAt = Math.round(now + life * (0.05 + rand() * 0.95));
          units.push({
            id: `U${String(serial).padStart(5, "0")}-${g.replace("+", "P").replace("-", "N")}`,
            siteId: bank.id,
            bloodGroup: g,
            component: c,
            collectedAt: expiresAt - life,
            expiresAt,
            status: "available",
            reservationId: null,
            transferId: null,
            offeredAt: null,
            updatedAt: now,
          });
        }
      }
    }
  }

  // ── Demand: the network rate split across banks in proportion to their real stock, i.e. we assume
  //    the snapshot is a normal day (each bank holds roughly what it issues). Shortage then appears
  //    from the surge, not from the model.
  const network = networkDemandPerDay(SNAPSHOT.banks);
  const componentTotal = (c: Component) =>
    Object.values(SNAPSHOT.banks).reduce((s, gs) => s + BLOOD_GROUPS.reduce((t, g) => t + (gs[g]?.[c] ?? 0), 0), 0);
  const demand: DemandRow[] = [];
  for (const bank of BANKS) {
    for (const c of COMPONENTS) {
      const cTotal = Math.max(1, componentTotal(c));
      for (const g of BLOOD_GROUPS) {
        const share = (SNAPSHOT.banks[bank.id]?.[g]?.[c] ?? 0) / cTotal;
        const perDay = Math.round(network[c] * share * 100) / 100;
        if (perDay > 0) demand.push({ siteId: bank.id, bloodGroup: g, component: c, unitsPerDay: perDay });
      }
    }
  }

  // ── Donors: SYNTHETIC people placed in real localities (no real donor data, ever) ──
  const firstNames = ["Aarav", "Vivaan", "Aditya", "Ishaan", "Kabir", "Arjun", "Reyansh", "Sai", "Ayaan", "Dhruv", "Ananya", "Diya", "Saanvi", "Aadhya", "Kiara", "Myra", "Ira", "Zoya", "Meher", "Riya", "Farhan", "Imran", "Sana", "Nikhil", "Pooja", "Tanvi", "Rahul", "Sneha", "Omkar", "Pranali"];
  const lastNames = ["Sharma", "Patil", "Khan", "Iyer", "Desai", "Naik", "Fernandes", "Kulkarni", "Shaikh", "Mehta", "Joshi", "Pawar", "Rao", "D'Souza", "Gupta", "Kamat"];
  const bloodBankIds = BANKS.map((b) => b.id);
  const donors: DonorRow[] = [];
  const donations: DonationRow[] = [];
  const areaOrFirst = (id: string) => AREAS.find((a) => a.id === id) ?? AREAS[0];

  const personas: Array<Omit<DonorRow, "lat" | "lng" | "createdAt" | "persona"> & { donatedDaysAgo: number[] }> = [
    { id: "DNR-AARAV", name: "Aarav Mehta", phone: "+91 90000 00001", bloodGroup: "O-", areaId: "sion", language: "en", consentAlerts: true, consentLocation: true, consentEligibility: true, quietHoursStart: null, quietHoursEnd: null, maxAlertsPerWeek: 3, lastDonationAt: now - 140 * DAY, donatedDaysAgo: [140, 300, 470] },
    { id: "DNR-MEERA", name: "Meera Kulkarni", phone: "+91 90000 00002", bloodGroup: "O-", areaId: "dadar", language: "mr", consentAlerts: true, consentLocation: true, consentEligibility: true, quietHoursStart: null, quietHoursEnd: null, maxAlertsPerWeek: 2, lastDonationAt: now - 200 * DAY, donatedDaysAgo: [200] },
    { id: "DNR-FARHAN", name: "Farhan Shaikh", phone: "+91 90000 00003", bloodGroup: "O+", areaId: "ghatkopar", language: "hi", consentAlerts: true, consentLocation: true, consentEligibility: true, quietHoursStart: null, quietHoursEnd: null, maxAlertsPerWeek: 2, lastDonationAt: now - 110 * DAY, donatedDaysAgo: [110, 260] },
    { id: "DNR-RIYA", name: "Riya Fernandes", phone: "+91 90000 00004", bloodGroup: "B+", areaId: "bandra", language: "en", consentAlerts: true, consentLocation: true, consentEligibility: false, quietHoursStart: 22, quietHoursEnd: 7, maxAlertsPerWeek: 1, lastDonationAt: now - 30 * DAY, donatedDaysAgo: [30, 150] },
  ];
  for (const p of personas) {
    const area = areaOrFirst(p.areaId);
    const { donatedDaysAgo, ...row } = p;
    donors.push({ ...row, areaId: area.id, ...approximate({ lat: area.lat + 0.004, lng: area.lng - 0.003 }), persona: true, createdAt: now - 400 * DAY });
    donatedDaysAgo.forEach((d, i) =>
      donations.push({ id: `DON-${p.id.slice(4)}-${i}`, donorId: p.id, siteId: pick(bloodBankIds), alertId: null, at: now - d * DAY }),
    );
  }

  const groups = Object.entries(CALIBRATION.bloodGroupShare).filter(([g]) => !g.startsWith("_")) as [BloodGroup, number][];
  const pickGroup = () => {
    // Over-sample rare groups so a donor drive for Rh-negative has someone to reach.
    const r = rand();
    let acc = 0;
    for (const [g, share] of groups) {
      acc += share * 0.7 + 0.3 / groups.length;
      if (r <= acc) return g;
    }
    return "O+" as BloodGroup;
  };
  for (let i = 0; i < 240; i++) {
    const area = pick(AREAS);
    const consent = rand();
    const lastDonationDaysAgo = rand() < 0.15 ? null : Math.floor(rand() * 400);
    const quiet = rand() < 0.25;
    donors.push({
      id: `DNR-${String(i + 1).padStart(4, "0")}`,
      name: `${pick(firstNames)} ${pick(lastNames)}`,
      phone: `+91 90000 ${String(10000 + i).slice(-5)}`,
      bloodGroup: pickGroup(),
      areaId: area.id,
      ...approximate({ lat: area.lat + (rand() - 0.5) * 0.03, lng: area.lng + (rand() - 0.5) * 0.03 }),
      language: pick<Language>(["en", "en", "hi", "mr"]),
      consentAlerts: consent > 0.1,
      consentLocation: consent > 0.18,
      consentEligibility: consent > 0.3,
      quietHoursStart: quiet ? 23 : null,
      quietHoursEnd: quiet ? 7 : null,
      maxAlertsPerWeek: pick([1, 2, 2, 3]),
      lastDonationAt: lastDonationDaysAgo === null ? null : now - lastDonationDaysAgo * DAY,
      optedOutAt: null,
      persona: false,
      createdAt: now - Math.floor(rand() * 700) * DAY,
    });
  }

  return { sites, units, demand, donors, donations };
}
