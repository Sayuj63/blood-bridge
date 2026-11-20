import { BLOOD_GROUPS, type BloodGroup, type Component } from "./domain";

/**
 * SIMPLIFIED DEMO COMPATIBILITY LOGIC — NOT CLINICAL GUIDANCE.
 *
 * Compatibility differs by component (PRD §8), so each component has its own rule:
 *  - Red cells: classic ABO + Rh red-cell rules (O- is the universal donor).
 *  - Whole blood: ABO-identical only; Rh- may go to Rh+.
 *  - Plasma: reverse ABO (AB plasma is universal); Rh not considered.
 *  - Platelets: plasma-compatible ABO; Rh- recipients receive Rh- only.
 *
 * Every non-exact match is flagged for clinician confirmation by the caller.
 * The table is surfaced in the app UI and labelled as demo logic.
 */

type Abo = "O" | "A" | "B" | "AB";

const abo = (g: BloodGroup): Abo => g.slice(0, -1) as Abo;
const isRhNeg = (g: BloodGroup) => g.endsWith("-");

/** Red-cell antigens present on a donor's cells, by ABO type. */
const RED_CELL_ANTIGENS: Record<Abo, readonly ("A" | "B")[]> = {
  O: [],
  A: ["A"],
  B: ["B"],
  AB: ["A", "B"],
};

/** Donor red cells are ABO-compatible if the recipient carries every antigen the donor carries. */
const redCellAboOk = (donor: Abo, recipient: Abo) =>
  RED_CELL_ANTIGENS[donor].every((ag) => RED_CELL_ANTIGENS[recipient].includes(ag));

/** Donor plasma is compatible if it carries no antibody against the recipient's antigens (reverse rule). */
const plasmaAboOk = (donor: Abo, recipient: Abo) =>
  RED_CELL_ANTIGENS[recipient].every((ag) => RED_CELL_ANTIGENS[donor].includes(ag));

const rules: Record<Component, (donor: BloodGroup, recipient: BloodGroup) => boolean> = {
  red_cells: (d, r) => redCellAboOk(abo(d), abo(r)) && (isRhNeg(d) || !isRhNeg(r)),
  whole_blood: (d, r) => abo(d) === abo(r) && (isRhNeg(d) || !isRhNeg(r)),
  plasma: (d, r) => plasmaAboOk(abo(d), abo(r)),
  platelets: (d, r) => plasmaAboOk(abo(d), abo(r)) && (!isRhNeg(r) || isRhNeg(d)),
};

export function isCompatible(donor: BloodGroup, recipient: BloodGroup, component: Component): boolean {
  return rules[component](donor, recipient);
}

export interface CompatibleSource {
  group: BloodGroup;
  exact: boolean;
}

/**
 * Donor groups that can supply `recipient` for `component`, exact match first,
 * then alternatives ordered so scarce universal groups (O-, AB+ plasma) come last.
 */
export function compatibleSources(recipient: BloodGroup, component: Component): CompatibleSource[] {
  const scarcityOrder: BloodGroup[] = ["O+", "A+", "B+", "AB+", "A-", "B-", "AB-", "O-"];
  return BLOOD_GROUPS.filter((d) => isCompatible(d, recipient, component))
    .map((group) => ({ group, exact: group === recipient }))
    .sort((a, b) => {
      if (a.exact !== b.exact) return a.exact ? -1 : 1;
      return scarcityOrder.indexOf(a.group) - scarcityOrder.indexOf(b.group);
    });
}

/** Full matrix for display in the app: matrix[recipient][donor] = compatible. */
export function compatibilityMatrix(component: Component): Record<BloodGroup, Record<BloodGroup, boolean>> {
  return Object.fromEntries(
    BLOOD_GROUPS.map((r) => [r, Object.fromEntries(BLOOD_GROUPS.map((d) => [d, isCompatible(d, r, component)]))]),
  ) as Record<BloodGroup, Record<BloodGroup, boolean>>;
}
