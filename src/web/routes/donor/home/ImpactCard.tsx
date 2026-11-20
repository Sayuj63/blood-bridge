import { Droplet } from "lucide-react";
import type { DonorDTO } from "../../../../shared/api";
import { Card, CardBody, CardHeader } from "../../../components/ui/Card";
import { Stat } from "../../../components/ui/Stat";
import { formatDate } from "../copy";

/** Modest, honest impact: one donation is one unit; only alert-driven donations count as requests supported. */
export function ImpactCard({ donor }: { donor: DonorDTO }) {
  const { unitsDonated, requestsSupported } = donor.impact;
  return (
    <Card as="section" aria-labelledby="impact-title">
      <CardHeader id="impact-title" title="Your donations" description="What's been recorded at the desk, nothing more." />
      <CardBody className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Units donated" value={unitsDonated} />
          <Stat label="Requests supported" value={requestsSupported} hint="Donations made in answer to an alert" />
        </div>
        {donor.donations.length === 0 ? (
          <p className="rounded-(--radius-control) bg-surface-2 px-3 py-3 text-sm text-ink-muted">
            No donations recorded yet. Your first one will show up here.
          </p>
        ) : (
          <ul className="divide-y divide-line border-t border-line" aria-label="Donation history">
            {donor.donations.map((d) => (
              <li key={`${d.at}-${d.siteName}`} className="flex items-center gap-3 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
                  <Droplet className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{d.siteName}</span>
                  <span className="block text-xs text-ink-muted">{formatDate(d.at)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
