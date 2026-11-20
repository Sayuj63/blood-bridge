import type { DonorDrivePreviewDTO } from "../../../../shared/api";
import type { SkipReason } from "../../../../shared/eligibility";

/** Checks run in this order, so each row is what that rule removed from what was left. */
const STEPS: { reason: SkipReason; label: string }[] = [
  { reason: "group", label: "Wrong blood group" },
  { reason: "consent", label: "No consent to alerts" },
  { reason: "ineligible", label: "Not eligible yet (recent donation)" },
  { reason: "out_of_range", label: "Out of range" },
  { reason: "quiet_hours", label: "In quiet hours" },
  { reason: "weekly_cap", label: "Weekly alert cap reached" },
];

/** Targeting funnel shown before any alert is sent: who would be messaged, and why everyone else is skipped. */
export function DriveFunnel({ preview }: { preview: DonorDrivePreviewDTO }) {
  const total = Math.max(preview.totalDonors, 1);
  let remaining = preview.totalDonors;

  return (
    <figure className="rounded-(--radius-control) border border-line p-3">
      <figcaption className="sr-only">
        Of {preview.totalDonors} registered donors, {preview.eligibleCount} would be alerted for {preview.bloodGroup}.
      </figcaption>
      <ol className="space-y-1.5 text-sm">
        <FunnelRow label="Registered donors" value={preview.totalDonors} width={1} tone="bg-line-strong" />
        {STEPS.map(({ reason, label }) => {
          remaining -= preview.skipped[reason];
          return (
            <FunnelRow key={reason} label={label} value={-preview.skipped[reason]} width={remaining / total} tone="bg-surface-3" muted={preview.skipped[reason] === 0} />
          );
        })}
        <FunnelRow label={`Eligible ${preview.bloodGroup} donors to alert`} value={preview.eligibleCount} width={preview.eligibleCount / total} tone="bg-accent" strong />
      </ol>
    </figure>
  );
}

interface FunnelRowProps {
  label: string;
  /** Negative for a skip count. */
  value: number;
  /** Bar width as a fraction of all donors (what is left after this step). */
  width: number;
  tone: string;
  muted?: boolean;
  strong?: boolean;
}

function FunnelRow({ label, value, width, tone, muted = false, strong = false }: FunnelRowProps) {
  return (
    <li className={strong ? "border-t border-line pt-2 font-semibold" : muted ? "text-ink-faint" : undefined}>
      <div className="flex items-baseline justify-between gap-3">
        <span>{label}</span>
        <span className={`font-numeric ${strong ? "text-2xl font-bold text-accent" : ""}`}>{value < 0 ? `−${-value}` : value}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-surface-2" aria-hidden>
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(0, Math.min(1, width)) * 100}%` }} />
      </div>
    </li>
  );
}
