import { ArrowDownLeft, ArrowUpRight, PackageCheck, Truck } from "lucide-react";
import type { TransferDTO } from "../../../../shared/api";
import { COMPONENT_SHORT } from "../../../../shared/domain";
import { Badge } from "../../../components/ui/Badge";
import { BloodGroupChip } from "../../../components/ui/BloodGroupChip";
import { Button } from "../../../components/ui/Button";
import { api } from "../../../lib/api";
import { cn } from "../../../lib/cn";
import { formatIST, plural } from "../../../lib/format";
import { useAction } from "../shared/useAction";

/** An approved (in transit) or completed transfer involving this bank. Inbound ones can be marked received. */
export function ActiveTransferRow({ transfer: t, siteId }: { transfer: TransferDTO; siteId: string }) {
  const inbound = t.toSiteId === siteId;
  const inTransit = t.status === "approved";
  const receive = useAction({
    run: () => api.transfers.complete(t.id),
    success: () => `Received ${plural(t.quantity, "unit")} from ${t.fromName}`,
  });

  return (
    <li className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5", !inTransit && "opacity-60")}>
      {inbound ? <ArrowDownLeft className="size-4 text-bridge" aria-label="Inbound" /> : <ArrowUpRight className="size-4 text-bridge" aria-label="Outbound" />}
      <BloodGroupChip group={t.bloodGroup} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {t.quantity} × {COMPONENT_SHORT[t.component]} {inbound ? `from ${t.fromName}` : `to ${t.toName}`}
        </p>
        <p className="text-xs text-ink-muted">
          {inTransit ? `Approved ${formatIST(t.decidedAt ?? t.createdAt)} · ETA ${t.etaMinutes} min` : `Received ${formatIST(t.completedAt ?? t.createdAt)}`}
        </p>
      </div>
      {inTransit ? (
        <Badge tone="bridge" size="sm">
          <Truck className="size-3" aria-hidden />
          In transit
        </Badge>
      ) : (
        <Badge tone="ok" size="sm">
          Completed
        </Badge>
      )}
      {inTransit && inbound ? (
        <Button size="sm" variant="bridge" icon={<PackageCheck className="size-3.5" aria-hidden />} loading={receive.isPending} onClick={() => receive.mutate(undefined)}>
          Mark received
        </Button>
      ) : null}
    </li>
  );
}
