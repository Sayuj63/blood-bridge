import { MapPin, Phone } from "lucide-react";
import type { DonorDTO } from "../../../../shared/api";
import { etaMinutes, haversineKm } from "../../../../shared/geo";
import { ErrorState } from "../../../components/ui/EmptyState";
import { SkeletonRows } from "../../../components/ui/Skeleton";
import { useMeta, useSites } from "../../../lib/queries";

const SHOWN = 4;

/** Closest blood banks to the donor's approximate neighbourhood with clean hairline rows & one-tap call. */
export function NearbyBanks({ donor }: { donor: DonorDTO }) {
  const meta = useMeta();
  const sites = useSites();
  const area = meta.data?.areas.find((a) => a.id === donor.areaId);

  const banks = area
    ? (sites.data ?? [])
        .filter((s) => s.kind === "blood_bank")
        .map((s) => ({ site: s, km: haversineKm(area, s), eta: etaMinutes(area, s) }))
        .sort((a, b) => a.km - b.km)
        .slice(0, SHOWN)
    : [];

  const maxKm = Math.max(...banks.map((b) => b.km), 1);

  return (
    <section aria-labelledby="nearby-title" className="d-card p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#FCEBED] text-[#C93245]">
            <MapPin className="size-4" aria-hidden />
          </span>
          <div>
            <h2 id="nearby-title" className="d-display text-sm font-bold text-[#171717]">
              Blood banks near {donor.areaName}
            </h2>
            <p className="text-[11px] text-[#737373]">Approximate distance &amp; available stock</p>
          </div>
        </div>
        <span className="d-num text-xs font-semibold text-[#737373]">{banks.length} closest</span>
      </div>

      <div aria-busy={sites.isPending || meta.isPending}>
        {sites.isError || meta.isError ? (
          <ErrorState what="nearby blood banks" error={sites.error ?? meta.error} onRetry={() => void sites.refetch()} compact />
        ) : sites.isPending || meta.isPending ? (
          <SkeletonRows rows={3} />
        ) : banks.length === 0 ? (
          <p className="text-xs text-[#737373]">No blood banks found near {donor.areaName}.</p>
        ) : (
          <ul className="divide-y divide-[#EAE6E3]">
            {banks.map(({ site, km, eta }) => {
              const barPct = Math.max(14, Math.round((km / maxKm) * 100));
              return (
                <li key={site.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-semibold text-[#171717]">{site.shortName}</span>
                      <span className="d-num shrink-0 text-xs font-bold text-[#A82436]">{site.totalAvailable}u</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2.5">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#F5ECEA]">
                        <div className="h-full rounded-full bg-[#C93245]/85" style={{ width: `${barPct}%` }} />
                      </div>
                      <span className="d-num shrink-0 text-[11px] text-[#737373]">
                        ~{km.toFixed(1)} km · {eta} min
                      </span>
                    </div>
                  </div>
                  <a
                    href={`tel:${site.phone.replace(/\s+/g, "")}`}
                    className="focus-ring grid size-12 shrink-0 touch-manipulation place-items-center rounded-xl border border-[#EAE6E3] bg-[#FAF9F6] text-[#C93245] transition-all hover:border-[#C93245] hover:bg-[#FCEBED] active:scale-95"
                    aria-label={`Call ${site.name}`}
                  >
                    <Phone className="size-4" aria-hidden />
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
