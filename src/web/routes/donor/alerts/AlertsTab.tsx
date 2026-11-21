import { Bell, BellOff, ChevronRight, Hourglass, MapPin, Moon, ShieldCheck, Sparkles } from "lucide-react";
import type { DonorAlertDTO, DonorDTO } from "../../../../shared/api";
import { COMPONENT_LABEL, POLICY } from "../../../../shared/domain";
import { inQuietHours, localHour } from "../../../../shared/eligibility";
import { ErrorState } from "../../../components/ui/EmptyState";
import { SkeletonRows } from "../../../components/ui/Skeleton";
import { cn } from "../../../lib/cn";
import { relativeTime } from "../../../lib/format";
import { ALERT_STATUS_COPY, DAY_MS, PREP_TIPS, formatDate, hourLabel } from "../copy";
import { useClock } from "../useClock";
import { AlertReach } from "./AlertReach";
import { VisitPass } from "./VisitPass";

const STATUS_STYLE: Record<DonorAlertDTO["status"], { pill: string; dot: string }> = {
  sent: { pill: "bg-[#FCEBED] text-[#A82436] border-[#F2D7DB]", dot: "bg-[#C93245]" },
  accepted: { pill: "bg-[#EEF4FF] text-[#1D4ED8] border-[#DBEAFE]", dot: "bg-[#2563EB]" },
  arrived: { pill: "bg-[#ECFDF3] text-[#1F7A4D] border-[#BBF7D0]", dot: "bg-[#16A34A]" },
  fulfilled: { pill: "bg-[#ECFDF3] text-[#1F7A4D] border-[#BBF7D0]", dot: "bg-[#16A34A]" },
  declined: { pill: "bg-[#F5F3F1] text-[#737373] border-[#EAE6E3]", dot: "bg-[#A3A3A3]" },
  expired: { pill: "bg-[#F5F3F1] text-[#737373] border-[#EAE6E3]", dot: "bg-[#A3A3A3]" },
};

interface AlertsTabProps {
  donor: DonorDTO;
  alerts: DonorAlertDTO[] | undefined;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  onOpen: (alertId: string) => void;
}

export function AlertsTab({ donor, alerts, isError, error, onRetry, onOpen }: AlertsTabProps) {
  const now = useClock(30_000);
  const visit = alerts?.find((a) => a.status === "accepted");
  const others = alerts?.filter((a) => a !== visit) ?? [];
  const thisWeek = alerts ? alerts.filter((a) => a.createdAt > now - 7 * DAY_MS).length : 0;
  const capPct = Math.min(100, Math.round((thisWeek / Math.max(1, donor.maxAlertsPerWeek)) * 100));
  const quiet = inQuietHours(donor.quietHoursStart, donor.quietHoursEnd, localHour(now));
  const reachable = donor.consentAlerts && donor.consentLocation && donor.eligible && !quiet && thisWeek < donor.maxAlertsPerWeek;
  const hasQuiet = donor.quietHoursStart !== null && donor.quietHoursEnd !== null;
  const openCount = alerts ? alerts.filter((a) => a.status === "sent" || a.status === "accepted").length : 0;

  return (
    <div className="space-y-6">
      {/* Clean Page Title + Status Pill (matches Hospital sub-views) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="d-display text-lg font-bold text-[#171717]">Alert Centre</h2>
          <p className="text-xs text-[#737373]">
            Only notified when <strong className="font-semibold text-[#171717]">{donor.bloodGroup.replace("-", "−")}</strong> is genuinely short near {donor.areaName}.
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
            reachable ? "bg-[#ECFDF3] text-[#1F7A4D]" : "bg-[#FCEBED] text-[#A82436]",
          )}
        >
          <span className={cn("size-1.5 rounded-full", reachable ? "bg-[#1F7A4D]" : "bg-[#C93245]")} />
          {reachable ? "Active & reachable" : !donor.eligible ? "Resting window" : quiet ? "In quiet hours" : "Alerts paused"}
        </span>
      </div>

      {/* Airy 3-KPI Strip */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        <div className="d-card p-3 sm:p-5">
          <div className="flex items-center justify-between gap-1.5">
            <span className="truncate text-[11px] font-semibold text-[#737373] sm:text-xs">Weekly cap</span>
            <Bell className="size-3.5 shrink-0 text-[#C93245] sm:size-4" aria-hidden />
          </div>
          <p className="d-num mt-2 text-lg font-extrabold text-[#171717] sm:text-2xl">
            {thisWeek} <span className="text-xs font-semibold text-[#737373] sm:text-sm">/ {donor.maxAlertsPerWeek}</span>
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#F5ECEA]">
            <div className="h-full rounded-full bg-[#C93245]" style={{ width: `${capPct}%` }} />
          </div>
        </div>

        <div className="d-card p-3 sm:p-5">
          <div className="flex items-center justify-between gap-1.5">
            <span className="truncate text-[11px] font-semibold text-[#737373] sm:text-xs">Radius</span>
            <MapPin className="size-3.5 shrink-0 text-[#C93245] sm:size-4" aria-hidden />
          </div>
          <p className="d-num mt-2 text-lg font-extrabold text-[#171717] sm:text-2xl">{POLICY.donorAlertRadiusKm} km</p>
          <p className="mt-1.5 truncate text-[11px] text-[#737373]">{donor.areaName}</p>
        </div>

        <div className="d-card p-3 sm:p-5">
          <div className="flex items-center justify-between gap-1.5">
            <span className="truncate text-[11px] font-semibold text-[#737373] sm:text-xs">Quiet hours</span>
            <Moon className="size-3.5 shrink-0 text-[#737373] sm:size-4" aria-hidden />
          </div>
          <p className="d-num mt-2 truncate text-base font-extrabold text-[#171717] sm:text-xl">
            {hasQuiet ? `${hourLabel(donor.quietHoursStart!)}–${hourLabel(donor.quietHoursEnd!)}` : "Off"}
          </p>
          <p className="mt-1.5 truncate text-[11px] text-[#737373]">
            {openCount === 0 ? "0 open" : `${openCount} active`}
          </p>
        </div>
      </div>

      {!donor.eligible && donor.eligibleFrom ? (
        <div className="d-card-blush flex items-start gap-3 p-4 text-sm text-[#171717]">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#FCEBED] text-[#C93245]">
            <Hourglass className="size-4" aria-hidden />
          </span>
          <p className="leading-relaxed">
            You&apos;re in your recovery window, so alerts are paused until{" "}
            <strong className="font-bold text-[#A82436]">{formatDate(donor.eligibleFrom)}</strong>.
          </p>
        </div>
      ) : null}

      {/* Spacious 2-col desktop / 1-col mobile bento */}
      <div className="grid items-start gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          {visit ? (
            <section aria-labelledby="visit-title" className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 id="visit-title" className="d-display text-sm font-bold text-[#171717]">
                  Active Visit Pass
                </h3>
                <span className="rounded-full bg-[#ECFDF3] px-2.5 py-0.5 text-[11px] font-bold text-[#1F7A4D]">Confirmed</span>
              </div>
              <VisitPass alert={visit} />
            </section>
          ) : null}

          {isError ? (
            <div className="d-card p-5">
              <ErrorState what="your alerts" error={error} onRetry={onRetry} compact />
            </div>
          ) : alerts === undefined ? (
            <div className="d-card p-5" aria-busy="true">
              <SkeletonRows rows={3} />
            </div>
          ) : others.length > 0 ? (
            <section aria-labelledby="recent-title" className="d-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#EAE6E3] px-5 py-4">
                <div>
                  <h3 id="recent-title" className="d-display text-sm font-bold text-[#171717]">
                    Recent Alerts
                  </h3>
                  <p className="text-xs text-[#737373]">Tap an active alert to view details or respond</p>
                </div>
                <span className="d-num rounded-full bg-[#FCEBED] px-2.5 py-0.5 text-xs font-bold text-[#A82436]">
                  {others.length}
                </span>
              </div>
              <ul className="divide-y divide-[#EAE6E3]">
                {others.map((a) => {
                  const style = STATUS_STYLE[a.status];
                  const interactive = a.status !== "declined" && a.status !== "expired";
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => onOpen(a.id)}
                        disabled={!interactive}
                        className={cn(
                          "focus-ring flex min-h-16 w-full items-center gap-3.5 px-5 py-3.5 text-left transition-colors",
                          interactive ? "hover:bg-[#FFF5F5]" : "cursor-default opacity-80",
                        )}
                      >
                        <span className="d-num grid size-10 shrink-0 place-items-center rounded-xl bg-[#FCEBED] text-sm font-extrabold text-[#A82436]">
                          {a.bloodGroup.replace("-", "−")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-[#171717]">{a.bankName}</span>
                          <span className="mt-0.5 block text-xs text-[#737373]">
                            {COMPONENT_LABEL[a.component]} · {a.distanceKm.toFixed(1)} km · {relativeTime(a.createdAt, now)}
                          </span>
                          <span
                            className={cn(
                              "mt-1.5 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                              style.pill,
                            )}
                          >
                            <span className={cn("size-1.5 rounded-full", style.dot)} aria-hidden />
                            {ALERT_STATUS_COPY[a.status]}
                          </span>
                        </span>
                        {interactive ? <ChevronRight className="size-4 shrink-0 text-[#C93245]" aria-hidden /> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : visit ? null : (
            <div className="d-card px-6 py-10 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#FCEBED] text-[#C93245]">
                <BellOff className="size-5" aria-hidden />
              </span>
              <p className="d-display mt-3 text-base font-bold text-[#171717]">No active alerts right now</p>
              <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-[#737373]">
                Banks near {donor.areaName} currently have what they need. We&apos;ll only message you when{" "}
                <span className="font-semibold text-[#171717]">{donor.bloodGroup.replace("-", "−")}</span> is genuinely short.
              </p>
            </div>
          )}

          {!visit ? (
            <section aria-labelledby="tips-title" className="d-card p-5 sm:p-6">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-xl bg-[#FCEBED] text-[#C93245]">
                  <Sparkles className="size-4" aria-hidden />
                </span>
                <div>
                  <h3 id="tips-title" className="d-display text-sm font-bold text-[#171717]">
                    If you&apos;re called in
                  </h3>
                  <p className="text-[11px] text-[#737373]">Simple prep for a smooth 30-minute visit</p>
                </div>
              </div>
              <ul className="mt-4 space-y-2.5">
                {PREP_TIPS.map((tip) => (
                  <li key={tip} className="flex items-start gap-2.5 text-xs text-[#171717]">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#C93245]" aria-hidden />
                    <span className="leading-relaxed">{tip}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-[#EAE6E3] pt-3 text-[11px] text-[#737373]">
                Clinical staff at the bank always confirm you&apos;re well to donate on the day.
              </p>
            </section>
          ) : null}
        </div>

        <div className="lg:col-span-5">
          {alerts ? <AlertReach donor={donor} alerts={alerts} /> : null}
        </div>
      </div>
    </div>
  );
}
