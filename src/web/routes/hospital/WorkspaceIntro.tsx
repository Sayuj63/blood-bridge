import { Droplets } from "lucide-react";
import type { SiteDTO } from "../../../shared/api";
import { useSites } from "../../lib/queries";
import { HospitalMap } from "./HospitalMap";

/** Before the first search: the city's blood banks around this hospital, and what "Find blood" will do. */
export function WorkspaceIntro({ hospital }: { hospital: SiteDTO }) {
  const banks = (useSites().data ?? []).filter((s) => s.kind === "blood_bank");
  return (
    <section aria-labelledby="intro-title" className="overflow-hidden rounded-(--radius-panel) border border-line bg-surface shadow-panel">
      <div className="flex items-start gap-3 p-4">
        <Droplets className="mt-0.5 size-6 shrink-0 text-accent" aria-hidden />
        <div>
          <h2 id="intro-title" className="font-display text-xl">
            {banks.length} blood banks within reach
          </h2>
          <p className="mt-1 max-w-prose text-sm text-ink-muted">
            Pick the patient's group, component and units, then <strong className="text-ink">Find blood</strong>. We rank compatible, in-date stock
            by travel time, data freshness and shelf life, and you reserve the best option in one tap.
          </p>
        </div>
      </div>
      <div className="h-72 border-t border-line lg:h-[28rem]">
        <HospitalMap
          hospital={hospital}
          banks={banks.map((b) => ({ siteId: b.id, label: `${b.name}: ${b.totalAvailable} units`, stale: b.stale }))}
          label={`Blood banks around ${hospital.name}`}
          className="size-full"
        />
      </div>
    </section>
  );
}
