import { Ambulance, BellRing, Power, Waves } from "lucide-react";
import type { SurgeDTO } from "../../../shared/api";
import type { SurgeKind } from "../../../shared/domain";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { useMeta } from "../../lib/queries";
import { formatClock } from "../../lib/format";
import { useNow } from "../../lib/useNow";
import type { useCommandActions } from "./useCommandActions";

const SCENARIOS: { kind: SurgeKind; area: string; label: string; icon: typeof Waves }[] = [
  { kind: "flood", area: "Kurla", label: "Flood · Kurla", icon: Waves },
  { kind: "mass_casualty", area: "Dadar", label: "Mass casualty · Dadar", icon: Ambulance },
];

/** Top strip: scenario launcher, surge status, and the two operator shortcuts. */
export function ScenarioBar({
  surge,
  actions,
  onRequestDonors,
}: {
  surge: SurgeDTO | null;
  actions: ReturnType<typeof useCommandActions>;
  onRequestDonors: () => void;
}) {
  const areas = useMeta().data?.areas ?? [];
  const now = useNow(1000);
  const areaId = (name: string) => areas.find((a) => a.name.toLowerCase().includes(name.toLowerCase()))?.id;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface px-3 py-2">
      <div className="flex items-center gap-2">
        <h1 className="font-label text-base text-ink">Doomsday command</h1>
        {surge ? (
          <Badge tone="critical" size="md">
            <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden />
            Surge T+{formatClock(now - surge.startedAt)}
          </Badge>
        ) : (
          <Badge tone="ok" size="md">
            Normal operations
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Launch a scenario">
        <span className="mr-1 hidden text-xs text-ink-faint xl:inline">Simulate</span>
        {SCENARIOS.map(({ kind, area, label, icon: Icon }) => {
          const running = surge?.kind === kind;
          return (
            <Button
              key={kind}
              size="sm"
              variant={running ? "danger" : "secondary"}
              aria-pressed={running}
              disabled={surge !== null || actions.startSurge.isPending}
              loading={actions.startSurge.isPending && actions.startSurge.variables?.kind === kind}
              icon={<Icon className="size-3.5" aria-hidden />}
              onClick={() => actions.startSurge.mutate({ kind, areaId: areaId(area) })}
            >
              {label}
            </Button>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <Button size="sm" icon={<BellRing className="size-3.5" aria-hidden />} onClick={onRequestDonors}>
          Request donors
        </Button>
        {surge ? (
          <Button
            size="sm"
            variant="ghost"
            loading={actions.endSurge.isPending}
            icon={<Power className="size-3.5" aria-hidden />}
            onClick={() => actions.endSurge.mutate()}
          >
            End surge
          </Button>
        ) : null}
      </div>
    </div>
  );
}
