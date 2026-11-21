import { useState } from "react";
import type { UnitDTO } from "../../../../shared/api";
import { COMPONENT_SHORT } from "../../../../shared/domain";
import { Badge } from "../../../components/ui/Badge";
import { BloodGroupChip } from "../../../components/ui/BloodGroupChip";
import { Button } from "../../../components/ui/Button";
import { ExpiryBadge } from "../../../components/ui/ExpiryBadge";
import { api } from "../../../lib/api";
import { cn } from "../../../lib/cn";
import { UnitLabel } from "./UnitLabel";
import { useAction } from "../shared/useAction";

const STATUS_LABEL: Partial<Record<UnitDTO["status"], string>> = { reserved: "Reserved", in_transit: "In transit" };

/** One physical unit with its shelf life and the two shelf actions: used, or removed. */
export function UnitRow({ unit, highlight = false }: { unit: UnitDTO; highlight?: boolean }) {
  const act = useAction({
    run: (action: "use" | "remove") => api.units.action(unit.id, { action }),
    success: (_, action) => `Unit ${unit.id} ${action === "use" ? "marked used" : "removed"}`,
  });
  const available = unit.status === "available";
  const [label, setLabel] = useState(false);
  const pending = act.isPending ? act.variables : undefined;

  return (
    <li className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2", highlight && "bg-info-soft")}>
      <BloodGroupChip group={unit.bloodGroup} size="sm" />
      <span className="w-10 font-label text-xs text-ink-muted">{COMPONENT_SHORT[unit.component]}</span>
      <code className="min-w-0 flex-1 truncate font-mono text-xs">{unit.id}</code>
      {!available ? (
        <Badge tone={unit.status === "reserved" ? "info" : "bridge"} size="sm">
          {STATUS_LABEL[unit.status] ?? unit.status}
        </Badge>
      ) : null}
      {unit.offered ? (
        <Badge tone="bridge" size="sm" outline>
          Offered
        </Badge>
      ) : null}
      <ExpiryBadge expiresAt={unit.expiresAt} size="sm" />
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={() => setLabel(true)} aria-label={`Show label for unit ${unit.id}`}>
          Label
        </Button>
        <Button size="sm" disabled={!available || act.isPending} loading={pending === "use"} onClick={() => act.mutate("use")} aria-label={`Mark unit ${unit.id} used`}>
          Used
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!available || act.isPending}
          loading={pending === "remove"}
          onClick={() => act.mutate("remove")}
          aria-label={`Remove unit ${unit.id}`}
        >
          Remove
        </Button>
      </div>
      {label ? <UnitLabel unit={unit} open onClose={() => setLabel(false)} /> : null}
    </li>
  );
}
