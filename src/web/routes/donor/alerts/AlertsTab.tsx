import { BellOff, ChevronRight, Hourglass, Sparkles } from "lucide-react";
import type { DonorAlertDTO, DonorDTO } from "../../../../shared/api";
import { COMPONENT_LABEL } from "../../../../shared/domain";
import { Badge } from "../../../components/ui/Badge";
import { BloodGroupChip } from "../../../components/ui/BloodGroupChip";
import { Card, CardBody, CardHeader } from "../../../components/ui/Card";
import { ErrorState } from "../../../components/ui/EmptyState";
import { SkeletonRows } from "../../../components/ui/Skeleton";
import { relativeTime } from "../../../lib/format";
import { useClock } from "../useClock";
import { ALERT_STATUS_COPY, PREP_TIPS, formatDate } from "../copy";
import { AlertReach } from "./AlertReach";
import { VisitPass } from "./VisitPass";

const STATUS_TONE: Record<DonorAlertDTO["status"], "accent" | "ok" | "neutral" | "info"> = {
  sent: "accent",
  accepted: "info",
  arrived: "ok",
  fulfilled: "ok",
  declined: "neutral",
  expired: "neutral",
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

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl leading-tight text-ink">Alerts</h1>

      {!donor.eligible && donor.eligibleFrom ? (
        <div className="flex gap-3 rounded-(--radius-panel) bg-info-soft p-4 text-sm text-ink">
          <Hourglass className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
          <p>
            You're not due to donate yet, so we won't alert you until <strong>{formatDate(donor.eligibleFrom)}</strong>. Your
            body gets the rest it needs; we'll be here when you're ready.
          </p>
        </div>
      ) : null}

      {visit ? (
        <section aria-labelledby="visit-title" className="space-y-2">
          <h2 id="visit-title" className="font-semibold text-ink">
            Your visit
          </h2>
          <VisitPass alert={visit} />
        </section>
      ) : null}

      {isError ? (
        <Card>
          <ErrorState what="your alerts" error={error} onRetry={onRetry} compact />
        </Card>
      ) : alerts === undefined ? (
        <Card className="p-4" aria-busy="true">
          <SkeletonRows rows={3} />
        </Card>
      ) : others.length > 0 ? (
        <Card as="section" aria-labelledby="recent-title">
          <CardHeader id="recent-title" title="This week" />
          <CardBody>
            <ul className="divide-y divide-line">
              {others.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(a.id)}
                    disabled={a.status === "declined" || a.status === "expired"}
                    className="focus-ring flex min-h-14 w-full items-center gap-3 py-3 text-left disabled:cursor-default"
                  >
                    <BloodGroupChip group={a.bloodGroup} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{a.bankName}</span>
                      <span className="block text-xs text-ink-muted">
                        {COMPONENT_LABEL[a.component]} · {relativeTime(a.createdAt, now)}
                      </span>
                      <Badge tone={STATUS_TONE[a.status]} size="sm" className="mt-1.5">
                        {ALERT_STATUS_COPY[a.status]}
                      </Badge>
                    </span>
                    {a.status !== "declined" && a.status !== "expired" ? (
                      <ChevronRight className="size-4 shrink-0 text-ink-faint" aria-hidden />
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : visit ? null : (
        <Card className="px-4 py-6 text-center">
          <BellOff className="mx-auto size-6 text-ink-faint" aria-hidden />
          <p className="mt-2 font-semibold text-ink">No alerts right now</p>
          <p className="mt-1 text-sm text-ink-muted">
            That's good news: banks near you have what they need. We'll only message you when your group is genuinely needed.
          </p>
        </Card>
      )}

      {!visit ? (
        <Card as="section" aria-labelledby="tips-title">
          <CardHeader id="tips-title" title="If you're called in" description="A few simple things that make the visit easier." />
          <CardBody>
            <ul className="space-y-2.5">
              {PREP_TIPS.map((tip) => (
                <li key={tip} className="flex gap-2.5 text-sm text-ink">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                  {tip}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-muted">Staff at the bank will check you're well to donate on the day.</p>
          </CardBody>
        </Card>
      ) : null}

      {alerts ? <AlertReach donor={donor} alerts={alerts} /> : null}
    </div>
  );
}
