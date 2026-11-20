/** Plain-language copy and small formatters for the donor view. */
import type { DonorDTO } from "../../../shared/api";
import type { AlertStatus, Urgency } from "../../../shared/domain";

export type ConsentKey = keyof Pick<DonorDTO, "consentAlerts" | "consentLocation" | "consentEligibility">;

export const CONSENTS: readonly { key: ConsentKey; title: string; body: string }[] = [
  {
    key: "consentAlerts",
    title: "Receive urgent alerts",
    body: "We message you only when your blood group is needed at a bank near you.",
  },
  {
    key: "consentLocation",
    title: "Share approximate location",
    body: "Your neighbourhood only, never your exact location. Used to find banks near you.",
  },
  {
    key: "consentEligibility",
    title: "Share eligibility status with blood banks",
    body: "Banks see only whether you can donate yet, so you're never asked too soon.",
  },
];

export const PRIVACY_PROMISE =
  "Hospitals never see who you are. A blood bank sees your name and phone only after you tap “I can come”.";

/** Generic, non-medical preparation tips. The bank checks you're well to donate on the day. */
export const PREP_TIPS: readonly string[] = [
  "Drink an extra glass or two of water on the day.",
  "Eat a regular meal a few hours before you go.",
  "Carry a photo ID and wear a top with sleeves that roll up easily.",
];

export const URGENCY_COPY: Record<Urgency, string> = {
  critical: "Needed today",
  urgent: "Needed within a day",
  routine: "Needed this week",
};

export const ALERT_STATUS_COPY: Record<AlertStatus, string> = {
  sent: "Waiting for your answer",
  accepted: "You're on your way",
  arrived: "Donated. Thank you",
  declined: "You said not now",
  fulfilled: "Filled by other donors",
  expired: "Closed",
};

const istDate = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });

/** "14 Feb 2027" */
export const formatDate = (ms: number): string => istDate.format(ms);

/** 22 → "22:00" */
export const hourLabel = (hour: number): string => `${String(hour).padStart(2, "0")}:00`;

export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

export const DAY_MS = 86_400_000;
