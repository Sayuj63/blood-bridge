import { describe, expect, it } from "vitest";
import raw from "../data/raw/eraktkosh_mumbai_latest.json";
import snapshot from "../data/mumbai/stock_snapshot.json";
import { parseIst, parseResults, type EraktkoshResult } from "../src/worker/eraktkosh/parse";

describe("e-RaktKosh parser", () => {
  const parsed = parseResults((raw as unknown as { results: EraktkoshResult[] }).results);

  it("reproduces the offline snapshot exactly (same port as build_mumbai.py)", () => {
    expect(parsed.stock).toEqual((snapshot as { banks: unknown }).banks);
  });

  it("keeps each bank's real last-updated time", () => {
    const ist = (snapshot as { bankLastUpdatedIST: Record<string, string> }).bankLastUpdatedIST;
    for (const [id, s] of Object.entries(ist)) expect(parsed.updatedAt[id]).toBe(parseIst(s));
  });

  it("parses IST timestamps", () => {
    expect(parseIst("2026-11-20 10:04:32")).toBe(Date.UTC(2026, 10, 20, 4, 34, 32));
  });
});
