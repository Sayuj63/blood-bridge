import type { UnitDTO } from "../../../shared/api";
import { COMPONENT_LABEL } from "../../../shared/domain";
import { Badge } from "../../components/ui/Badge";
import { BloodGroupChip } from "../../components/ui/BloodGroupChip";
import { ExpiryBadge } from "../../components/ui/ExpiryBadge";
import { cn } from "../../lib/cn";
import { formatISTDateTime, spokenGroup } from "../../lib/format";

interface StockUnitRowProps {
  unit: UnitDTO;
  expiringSoon: boolean;
  selected: boolean;
  onToggle: () => void;
}

/** One unit in the hospital's own fridge. Units expiring within 48 h are tinted amber. */
export function StockUnitRow({ unit, expiringSoon, selected, onToggle }: StockUnitRowProps) {
  const selectable = unit.status === "available" && !unit.offered;
  const checkboxId = `unit-${unit.id}`;
  return (
    <tr className={cn("border-t border-line", expiringSoon && "bg-warn-soft", selected && "outline-2 -outline-offset-2 outline-bridge")}>
      <td className="w-10 py-2 pl-3">
        <input
          id={checkboxId}
          type="checkbox"
          checked={selected}
          disabled={!selectable}
          onChange={onToggle}
          aria-label={`Select ${spokenGroup(unit.bloodGroup)} ${COMPONENT_LABEL[unit.component]}, unit ${unit.id}`}
          className="focus-ring size-4 accent-(--bb-bridge)"
        />
      </td>
      <td className="py-2 pr-2">
        <label htmlFor={checkboxId} className="flex items-center gap-2">
          <BloodGroupChip group={unit.bloodGroup} size="sm" />
          <span className="text-sm">{COMPONENT_LABEL[unit.component]}</span>
        </label>
      </td>
      <td className="hidden py-2 pr-2 font-numeric text-xs text-ink-muted sm:table-cell">{unit.id}</td>
      <td className="py-2 pr-2">
        <ExpiryBadge expiresAt={unit.expiresAt} size="sm" />
        <span className="sr-only">expires {formatISTDateTime(unit.expiresAt)}</span>
      </td>
      <td className="py-2 pr-3 text-right">
        {unit.offered ? (
          <Badge tone="bridge" size="sm">
            Offered
          </Badge>
        ) : unit.status !== "available" ? (
          <Badge size="sm">{unit.status.replace("_", " ")}</Badge>
        ) : expiringSoon ? (
          <Badge tone="warn" size="sm">
            Expiring soon
          </Badge>
        ) : null}
      </td>
    </tr>
  );
}
