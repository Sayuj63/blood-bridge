import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRaktBags, mapComponent, parseRaktBags, type RaktBag } from "../src/worker/connectors/rakt";

const NOW = Date.UTC(2026, 10, 21, 6, 0, 0);
const DAY = 86_400_000;
const SHELF = { whole_blood: 35, red_cells: 42, platelets: 5, plasma: 365 };
const daysAgo = (d: number) => new Date(NOW - d * DAY).toISOString();

/** Shaped like RAKT's BloodBags / BloodComponent schemas (https://rakt.in/api/schema/). */
const BAGS: RaktBag[] = [
  {
    id: 101,
    segment_blood_group: "O Rh Neg",
    created_at: daysAgo(2),
    components: [
      { id: 1, name: "PRBC (SAGM)", in_stock: 1, issue_no: null },
      { id: 2, name: "Random Donor Platelets", in_stock: 1, issue_no: null },
      { id: 3, name: "FFP", in_stock: 0, issue_no: null },
      { id: 4, name: "Cryoprecipitate", in_stock: 1, issue_no: null },
    ],
  },
  { id: 102, segment_blood_group: "B Rh Pos", created_at: daysAgo(6), components: [{ id: 5, name: "Platelet Concentrate", in_stock: 1 }] },
  { id: 103, segment_blood_group: "A Rh Pos", created_at: daysAgo(10), components: [{ id: 6, name: "Packed Red Cells", in_stock: 1, issue_no: "ISS-77" }] },
  { id: 104, segment_blood_group: "Oh Rh Pos(Bombay)", created_at: daysAgo(1), components: [{ id: 7, name: "PRBC", in_stock: 1 }] },
  { id: 105, segment_blood_group: "-", created_at: daysAgo(1), components: [{ id: 8, name: "PRBC", in_stock: 1 }] },
];

describe("RAKT connector", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps free-text component names, skipping cryo and platelet-rich plasma", () => {
    expect(mapComponent("PRBC (SAGM)")).toBe("red_cells");
    expect(mapComponent("Single Donor Platelets")).toBe("platelets");
    expect(mapComponent("Fresh Frozen Plasma")).toBe("plasma");
    expect(mapComponent("Whole Blood")).toBe("whole_blood");
    expect(mapComponent("Cryoprecipitate")).toBeNull();
    expect(mapComponent("Platelet Rich Plasma")).toBeNull();
  });

  it("keeps only in-stock, un-issued, in-date components with real per-bag expiry", () => {
    const units = parseRaktBags(BAGS, NOW, SHELF);
    expect(units.map((u) => u.id)).toEqual(["RAKT-101-1", "RAKT-101-2"]);
    const plt = units.find((u) => u.component === "platelets")!;
    expect(plt.bloodGroup).toBe("O-");
    expect(plt.expiresAt).toBe(NOW - 2 * DAY + 5 * DAY); // collection + 5-day legal shelf life
  });

  it("drops expired bags (6-day-old platelets) and unmodelled groups (Bombay, unknown)", () => {
    const ids = parseRaktBags(BAGS, NOW, SHELF).map((u) => u.id);
    expect(ids).not.toContain("RAKT-102-5");
    expect(ids).not.toContain("RAKT-104-7");
    expect(ids).not.toContain("RAKT-105-8");
  });

  it("sends the Api-Key header and follows DRF-style pages", async () => {
    const calls: { url: string; auth: string | null }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, auth: new Headers(init.headers).get("Authorization") });
      const body = url.endsWith("page=2") ? { results: [BAGS[1]], next: null } : { results: [BAGS[0]], next: "https://rakt.example/api/v1/blood-bags/?page=2" };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    const bags = await fetchRaktBags("https://rakt.example/", "k123");
    expect(bags.map((b) => b.id)).toEqual([101, 102]);
    expect(calls[0]).toEqual({ url: "https://rakt.example/api/v1/blood-bags/", auth: "Api-Key k123" });
  });

  it("reports a rejected key clearly", async () => {
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 403 }));
    await expect(fetchRaktBags("https://rakt.example", "bad")).rejects.toThrow("RAKT rejected the API key");
  });
});
