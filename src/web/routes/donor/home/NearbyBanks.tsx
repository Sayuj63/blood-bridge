import { MapPin, Phone } from "lucide-react";
import type { DonorDTO } from "../../../../shared/api";
import { haversineKm } from "../../../../shared/geo";
import { Card, CardBody, CardHeader } from "../../../components/ui/Card";
import { ErrorState } from "../../../components/ui/EmptyState";
import { SkeletonRows } from "../../../components/ui/Skeleton";
import { useMeta, useSites } from "../../../lib/queries";

const SHOWN = 3;

/** The closest blood banks to the centre of the donor's neighbourhood (never an exact location). */
export function NearbyBanks({ donor }: { donor: DonorDTO }) {
  const meta = useMeta();
  const sites = useSites();
  const area = meta.data?.areas.find((a) => a.id === donor.areaId);

  const banks = area
    ? (sites.data ?? [])
        .filter((s) => s.kind === "blood_bank")
        .map((s) => ({ site: s, km: haversineKm(area, s) }))
        .sort((a, b) => a.km - b.km)
        .slice(0, SHOWN)
    : [];

  return (
    <Card as="section" aria-labelledby="nearby-title">
      <CardHeader id="nearby-title" title="Blood banks near you" description={`Distances from the centre of ${donor.areaName}.`} />
      <CardBody aria-busy={sites.isPending || meta.isPending}>
        {sites.isError || meta.isError ? (
          <ErrorState what="nearby blood banks" error={sites.error ?? meta.error} onRetry={() => void sites.refetch()} compact />
        ) : sites.isPending || meta.isPending ? (
          <SkeletonRows rows={3} />
        ) : banks.length === 0 ? (
          <p className="text-sm text-ink-muted">No blood banks found near {donor.areaName}.</p>
        ) : (
          <ul className="divide-y divide-line">
            {banks.map(({ site, km }) => (
              <li key={site.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-muted">
                  <MapPin className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{site.name}</span>
                  <span className="block text-xs text-ink-muted">
                    {site.areaName} · <span className="font-numeric">~{km.toFixed(1)} km</span>
                  </span>
                </span>
                <a
                  href={`tel:${site.phone.replace(/\s+/g, "")}`}
                  className="focus-ring grid size-11 shrink-0 place-items-center rounded-full border border-line text-ink-muted hover:bg-surface-2 hover:text-ink"
                  aria-label={`Call ${site.name}`}
                >
                  <Phone className="size-4" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
