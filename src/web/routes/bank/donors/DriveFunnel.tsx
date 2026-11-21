import type { DonorDrivePreviewDTO } from "../../../../shared/api";
import type { SkipReason } from "../../../../shared/eligibility";
import { cn } from "../../../lib/cn";

/** Checks run in this order, so each row is what that rule removed from what was left. */
const STEPS: { reason: SkipReason; label: string }[] = [
  { reason: "group", label: "Wrong blood group" },
  { reason: "consent", label: "No consent to alerts" },
  { reason: "ineligible", label: "Not eligible yet (recent donation)" },
  { reason: "out_of_range", label: "Out of range" },
  { reason: "quiet_hours", label: "In quiet hours" },
  { reason: "weekly_cap", label: "Weekly alert cap reached" },
];

/** Visual consent-aware targeting funnel shown before any donor alert is sent. */
export function DriveFunnel({ preview }: { preview: DonorDrivePreviewDTO }) {
  const total = Math.max(preview.totalDonors, 1);
  let remaining = preview.totalDonors;

  return (
    <figure className="rounded-2xl border border-[#EAE6E3] bg-[#FAF9F6] p-4">
      <figcaption className="sr-only">
        Of {preview.totalDonors} registered donors, {preview.eligibleCount} would be alerted for {preview.bloodGroup}.
      </figcaption>
      <ol className="space-y-2.5 text-xs">
        <FunnelRow label="Registered donors" value={preview.totalDonors} width={1} tone="bg-[#737373]" />
        {STEPS.map(({ reason, label }) => {
          remaining -= preview.skipped[reason];
          return (
            <FunnelRow
              key={reason}
              label={label}
              value={-preview.skipped[reason]}
              width={remaining / total}
              tone="bg-[#E2B4BA]"
              muted={preview.skipped[reason] === 0}
            />
          );
        })}
        <FunnelRow
          label={`Eligible ${preview.bloodGroup.replace("-", "−")} donors to alert`}
          value={preview.eligibleCount}
          width={preview.eligibleCount / total}
          tone="bg-[#C93245]"
          strong
        />
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
    <li className={cn(strong && "border-t border-[#EAE6E3] pt-3", muted && "text-[#A3A3A3]")}>
      <div className="flex items-baseline justify-between gap-3">
        <span className={strong ? "b-display text-sm font-bold text-[#171717]" : "font-medium text-[#525252]"}>{label}</span>
        <span className={cn("b-num", strong ? "text-xl font-extrabold text-[#C93245]" : "font-semibold text-[#171717]")}>
          {value < 0 ? `−${-value}` : value}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#EFE7E5]" aria-hidden>
        <div
          className={cn("h-full rounded-full transition-all duration-300", tone)}
          style={{ width: `${Math.max(0, Math.min(1, width)) * 100}%` }}
        />
      </div>
    </li>
  );
}
