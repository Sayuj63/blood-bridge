import type { CreateRequestInput, SearchInput } from "../../../shared/api";
import type { BloodGroup, Component, Urgency } from "../../../shared/domain";

export interface RequestFormValues {
  bloodGroup: BloodGroup;
  component: Component;
  unitsNeeded: number;
  urgency: Urgency;
  /** Minutes from now; turned into an absolute `neededBy` on submit. */
  neededInMinutes: number;
  ward: string;
}

/** Defaults chosen so the most common request (urgent red cells for the ER) is two clicks away. */
export const DEFAULT_FORM: RequestFormValues = {
  bloodGroup: "O+",
  component: "red_cells",
  unitsNeeded: 2,
  urgency: "urgent",
  neededInMinutes: 120,
  ward: "Emergency",
};

export const NEEDED_BY_OPTIONS = [
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
  { value: 240, label: "4 hours" },
  { value: 720, label: "12 hours" },
  { value: 1440, label: "24 hours" },
] as const;

/** Picking an urgency moves "needed by" to a sensible deadline. */
export const NEEDED_BY_FOR_URGENCY: Record<Urgency, number> = { critical: 30, urgent: 120, routine: 720 };

export const WARDS = ["Emergency", "ICU", "Operating theatre", "Maternity", "Paediatrics", "Oncology", "General ward"] as const;

export const MAX_UNITS = 20;

export function toCreateInput(values: RequestFormValues, hospitalId: string, now: number): CreateRequestInput {
  return {
    hospitalId,
    bloodGroup: values.bloodGroup,
    component: values.component,
    unitsNeeded: values.unitsNeeded,
    urgency: values.urgency,
    neededBy: now + values.neededInMinutes * 60_000,
    ward: values.ward.trim() || DEFAULT_FORM.ward,
  };
}

export function toSearchInput({ ward: _ward, ...search }: CreateRequestInput): SearchInput {
  return search;
}
