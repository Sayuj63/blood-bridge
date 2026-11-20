/**
 * SIMULATED DEMO DATA — every site, unit, donor and name here is fictional.
 * Locations are real Mumbai neighbourhoods so the map tells a believable story.
 *
 * Generation is deterministic (seeded PRNG) and relative to `now`, so a demo
 * reset always produces the same city in the same state.
 */
import {
  BLOOD_GROUPS,
  COMPONENTS,
  DEMO_SHELF_LIFE_DAYS,
  type BloodGroup,
  type Component,
  type Language,
  type SiteKind,
} from "../shared/domain";
import { approximate } from "../shared/geo";
import type * as schema from "./db/schema";

export const CITY = "Mumbai";

export interface Area {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export const AREAS: Area[] = [
  { id: "colaba", name: "Colaba", lat: 18.9067, lng: 72.8147 },
  { id: "byculla", name: "Byculla", lat: 18.979, lng: 72.8355 },
  { id: "worli", name: "Worli", lat: 19.0176, lng: 72.818 },
  { id: "dadar", name: "Dadar", lat: 19.0178, lng: 72.8478 },
  { id: "sion", name: "Sion", lat: 19.039, lng: 72.8619 },
  { id: "bandra", name: "Bandra", lat: 19.0596, lng: 72.8295 },
  { id: "kurla", name: "Kurla", lat: 19.0726, lng: 72.8845 },
  { id: "chembur", name: "Chembur", lat: 19.0522, lng: 72.9005 },
  { id: "ghatkopar", name: "Ghatkopar", lat: 19.086, lng: 72.9081 },
  { id: "andheri", name: "Andheri", lat: 19.1136, lng: 72.8697 },
  { id: "powai", name: "Powai", lat: 19.1176, lng: 72.906 },
  { id: "malad", name: "Malad", lat: 19.1874, lng: 72.8484 },
  { id: "borivali", name: "Borivali", lat: 19.2307, lng: 72.8567 },
];

export const areaById = (id: string) => AREAS.find((a) => a.id === id);

/** Where each surge scenario hits by default. Kurla sits on the flood-prone Mithi river. */
export const SURGE_DEFAULT_AREA = { flood: "kurla", mass_casualty: "dadar" } as const;

interface SiteSeed {
  id: string;
  kind: SiteKind;
  name: string;
  shortName: string;
  areaId: string;
  address: string;
  phone: string;
  offset: [number, number];
  /** Stock scale (1 = typical mid-size blood bank). */
  stock: number;
  /** Demand scale (1 = typical issue rate). */
  demand: number;
  /** Minutes since last stock sync. */
  syncAgoMin: number;
}

const SITES: SiteSeed[] = [
  { id: "BB-DDR", kind: "blood_bank", name: "Dadar Regional Blood Centre", shortName: "Dadar RBC", areaId: "dadar", address: "Plot 14, Senapati Bapat Marg, Dadar West", phone: "+91 22 5550 0101", offset: [0.002, 0.001], stock: 1.4, demand: 1.1, syncAgoMin: 3 },
  { id: "BB-BYC", kind: "blood_bank", name: "Byculla Community Blood Bank", shortName: "Byculla CBB", areaId: "byculla", address: "22 Clare Road, Byculla", phone: "+91 22 5550 0102", offset: [0, 0], stock: 1.0, demand: 0.9, syncAgoMin: 11 },
  { id: "BB-BDR", kind: "blood_bank", name: "Bandra Seaside Blood Centre", shortName: "Bandra SBC", areaId: "bandra", address: "5 Hill Road, Bandra West", phone: "+91 22 5550 0103", offset: [0.001, 0.003], stock: 1.2, demand: 0.6, syncAgoMin: 6 },
  { id: "BB-AND", kind: "blood_bank", name: "Andheri Lifeline Blood Bank", shortName: "Andheri LBB", areaId: "andheri", address: "118 Andheri-Kurla Road, Andheri East", phone: "+91 22 5550 0104", offset: [0.002, -0.004], stock: 1.3, demand: 0.7, syncAgoMin: 8 },
  { id: "BB-GTK", kind: "blood_bank", name: "Ghatkopar Seva Blood Bank", shortName: "Ghatkopar SBB", areaId: "ghatkopar", address: "9 LBS Marg, Ghatkopar West", phone: "+91 22 5550 0105", offset: [-0.002, -0.003], stock: 0.8, demand: 1.0, syncAgoMin: 17 },
  { id: "BB-CHM", kind: "blood_bank", name: "Chembur Harbour Blood Bank", shortName: "Chembur HBB", areaId: "chembur", address: "41 Sion-Trombay Road, Chembur", phone: "+91 22 5550 0106", offset: [0.001, 0.002], stock: 0.7, demand: 0.8, syncAgoMin: 96 },
  { id: "BB-BOR", kind: "blood_bank", name: "Borivali North Blood Bank", shortName: "Borivali NBB", areaId: "borivali", address: "3 SV Road, Borivali West", phone: "+91 22 5550 0107", offset: [-0.003, 0.001], stock: 1.1, demand: 0.35, syncAgoMin: 5 },
  { id: "HSP-SIO", kind: "hospital", name: "Riverside General Hospital, Sion", shortName: "Riverside Sion", areaId: "sion", address: "Ward Block C, Sion Circle, Sion", phone: "+91 22 5550 0201", offset: [0.001, 0], stock: 0.25, demand: 1.6, syncAgoMin: 2 },
  { id: "HSP-KRL", kind: "hospital", name: "Kurla Metro Hospital", shortName: "Kurla Metro", areaId: "kurla", address: "60 Station Road, Kurla West", phone: "+91 22 5550 0202", offset: [-0.002, -0.004], stock: 0.2, demand: 1.4, syncAgoMin: 4 },
  { id: "HSP-PWI", kind: "hospital", name: "Powai Lakeside Hospital", shortName: "Powai Lakeside", areaId: "powai", address: "12 Hiranandani Link Road, Powai", phone: "+91 22 5550 0203", offset: [0.003, -0.002], stock: 0.3, demand: 0.9, syncAgoMin: 9 },
];

/** Approximate ABO/Rh distribution in India — used only to shape simulated stock and demand. */
const GROUP_SHARE: Record<BloodGroup, number> = {
  "O+": 0.36, "B+": 0.31, "A+": 0.21, "AB+": 0.07, "O-": 0.015, "B-": 0.015, "A-": 0.01, "AB-": 0.005,
};

/** Base stock (units) and demand (units/day) for a scale-1 site, by component. */
const COMPONENT_BASE: Record<Component, { stock: number; demand: number; floorNeg: number }> = {
  red_cells: { stock: 70, demand: 12, floorNeg: 3 },
  whole_blood: { stock: 14, demand: 2, floorNeg: 1 },
  platelets: { stock: 18, demand: 5, floorNeg: 2 },
  plasma: { stock: 30, demand: 4, floorNeg: 2 },
};

const DAY = 86_400_000;
const HOUR = 3_600_000;
const MINUTE = 60_000;

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

export function generateSeed(now: number): SeedData {
  const rand = prng(20261120);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];

  const sites: SiteRow[] = SITES.map((s) => {
    const area = areaById(s.areaId)!;
    return {
      id: s.id,
      kind: s.kind,
      name: s.name,
      shortName: s.shortName,
      areaId: s.areaId,
      address: s.address,
      phone: s.phone,
      lat: area.lat + s.offset[0],
      lng: area.lng + s.offset[1],
      verified: true,
      lastSyncAt: now - s.syncAgoMin * MINUTE,
    };
  });

  const units: UnitRow[] = [];
  const demand: DemandRow[] = [];
  let serial = 0;
  const addUnit = (siteId: string, g: BloodGroup, c: Component, expiresAt: number) => {
    serial++;
    const life = DEMO_SHELF_LIFE_DAYS[c] * DAY;
    units.push({
      id: `U${String(serial).padStart(5, "0")}-${g.replace("+", "P").replace("-", "N")}`,
      siteId,
      bloodGroup: g,
      component: c,
      collectedAt: Math.min(now, expiresAt - life),
      expiresAt,
      status: "available",
      reservationId: null,
      transferId: null,
      updatedAt: now - Math.floor(rand() * 6 * HOUR),
    });
  };

  for (const s of SITES) {
    for (const c of COMPONENTS) {
      const base = COMPONENT_BASE[c];
      const life = DEMO_SHELF_LIFE_DAYS[c] * DAY;
      for (const g of BLOOD_GROUPS) {
        const neg = g.endsWith("-");
        const count = Math.max(
          neg ? Math.round(base.floorNeg * s.stock) : 0,
          Math.round(base.stock * GROUP_SHARE[g] * s.stock * (0.8 + rand() * 0.4)),
        );
        for (let i = 0; i < count; i++) {
          // Spread remaining shelf life between ~8% and 100% of full life.
          const remaining = life * (0.08 + rand() * 0.92);
          addUnit(s.id, g, c, now + remaining);
        }
        const perDay = Math.round(base.demand * Math.max(GROUP_SHARE[g], neg ? 0.03 : 0) * s.demand * 100) / 100;
        if (perDay > 0) demand.push({ siteId: s.id, bloodGroup: g, component: c, unitsPerDay: perDay });
      }
    }
  }

  // ── Scripted story beats (PRD §7) ────────────────────────────────────────
  // 1. 60-second demo: O- platelets exist nearby, Dadar fresh and closest to Sion.
  for (let i = 0; i < 3; i++) addUnit("BB-DDR", "O-", "platelets", now + (60 + i * 8) * HOUR);
  for (let i = 0; i < 2; i++) addUnit("BB-AND", "O-", "platelets", now + (90 + i * 6) * HOUR);
  // 2. Expiry-aware transfer: Borivali (low demand) holds platelets that will expire unused
  //    while Kurla Metro is forecast short.
  for (const g of ["O+", "O+", "B+", "B+", "A+", "O+"] as BloodGroup[]) addUnit("BB-BOR", g, "platelets", now + (30 + rand() * 12) * HOUR);
  for (const g of ["O+", "O+", "O+", "B+"] as BloodGroup[]) addUnit("BB-BOR", g, "red_cells", now + (40 + rand() * 20) * HOUR);

  // ── Donors ───────────────────────────────────────────────────────────────
  const firstNames = ["Aarav", "Vivaan", "Aditya", "Ishaan", "Kabir", "Arjun", "Reyansh", "Sai", "Ayaan", "Dhruv", "Ananya", "Diya", "Saanvi", "Aadhya", "Kiara", "Myra", "Ira", "Zoya", "Meher", "Riya", "Farhan", "Imran", "Sana", "Nikhil", "Pooja", "Tanvi", "Rahul", "Sneha", "Omkar", "Pranali"];
  const lastNames = ["Sharma", "Patil", "Khan", "Iyer", "Desai", "Naik", "Fernandes", "Kulkarni", "Shaikh", "Mehta", "Joshi", "Pawar", "Rao", "D'Souza", "Gupta", "Kamat"];
  const donors: DonorRow[] = [];
  const donations: DonationRow[] = [];

  const personas: Array<Omit<DonorRow, "lat" | "lng" | "createdAt" | "persona"> & { donatedDaysAgo: number[] }> = [
    { id: "DNR-AARAV", name: "Aarav Mehta", phone: "+91 98200 11001", bloodGroup: "O-", areaId: "kurla", language: "en", consentAlerts: true, consentLocation: true, consentEligibility: true, quietHoursStart: null, quietHoursEnd: null, maxAlertsPerWeek: 3, lastDonationAt: now - 140 * DAY, donatedDaysAgo: [140, 300, 470] },
    { id: "DNR-MEERA", name: "Meera Kulkarni", phone: "+91 98200 11002", bloodGroup: "O-", areaId: "sion", language: "mr", consentAlerts: true, consentLocation: true, consentEligibility: true, quietHoursStart: null, quietHoursEnd: null, maxAlertsPerWeek: 2, lastDonationAt: now - 200 * DAY, donatedDaysAgo: [200] },
    { id: "DNR-FARHAN", name: "Farhan Shaikh", phone: "+91 98200 11003", bloodGroup: "O+", areaId: "chembur", language: "hi", consentAlerts: true, consentLocation: true, consentEligibility: true, quietHoursStart: null, quietHoursEnd: null, maxAlertsPerWeek: 2, lastDonationAt: now - 110 * DAY, donatedDaysAgo: [110, 260] },
    { id: "DNR-RIYA", name: "Riya Fernandes", phone: "+91 98200 11004", bloodGroup: "B+", areaId: "bandra", language: "en", consentAlerts: true, consentLocation: true, consentEligibility: false, quietHoursStart: 22, quietHoursEnd: 7, maxAlertsPerWeek: 1, lastDonationAt: now - 30 * DAY, donatedDaysAgo: [30, 150] },
  ];
  for (const p of personas) {
    const area = areaById(p.areaId)!;
    const { donatedDaysAgo, ...row } = p;
    donors.push({ ...row, ...approximate({ lat: area.lat + 0.004, lng: area.lng - 0.003 }), persona: true, createdAt: now - 400 * DAY });
    donatedDaysAgo.forEach((d, i) =>
      donations.push({ id: `DON-${p.id.slice(4)}-${i}`, donorId: p.id, siteId: pick(SITES.filter((s) => s.kind === "blood_bank")).id, alertId: null, at: now - d * DAY }),
    );
  }

  const groups = Object.entries(GROUP_SHARE) as [BloodGroup, number][];
  const pickGroup = () => {
    // Over-sample rare groups so donor drives for negatives have someone to reach.
    const r = rand();
    let acc = 0;
    for (const [g, share] of groups) {
      acc += share * 0.7 + 0.3 / groups.length;
      if (r <= acc) return g;
    }
    return "O+" as BloodGroup;
  };
  for (let i = 0; i < 180; i++) {
    const area = pick(AREAS);
    const consent = rand();
    const lastDonationDaysAgo = rand() < 0.15 ? null : Math.floor(rand() * 400);
    const quiet = rand() < 0.25;
    donors.push({
      id: `DNR-${String(i + 1).padStart(4, "0")}`,
      name: `${pick(firstNames)} ${pick(lastNames)}`,
      phone: `+91 9${Math.floor(100000000 + rand() * 899999999)}`,
      bloodGroup: pickGroup(),
      areaId: area.id,
      ...approximate({ lat: area.lat + (rand() - 0.5) * 0.04, lng: area.lng + (rand() - 0.5) * 0.04 }),
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
