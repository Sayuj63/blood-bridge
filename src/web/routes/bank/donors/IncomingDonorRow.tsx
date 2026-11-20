import { HeartHandshake, Phone } from "lucide-react";
import type { IncomingDonorDTO } from "../../../../shared/api";
import { Badge } from "../../../components/ui/Badge";
import { BloodGroupChip } from "../../../components/ui/BloodGroupChip";
import { Button } from "../../../components/ui/Button";
import { api } from "../../../lib/api";
import { useAction } from "../shared/useAction";

/** One donor on the way: identity, code to check at the desk, arrival window, and the completion action. */
export function IncomingDonorRow({ donor: d }: { donor: IncomingDonorDTO }) {
  const complete = useAction({ run: () => api.alerts.complete(d.alertId), success: () => `Donation by ${d.donorName} recorded. Thank you sent.` });

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
      <BloodGroupChip group={d.bloodGroup} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{d.donorName}</p>
        <a href={`tel:${d.donorPhone.replace(/\s/g, "")}`} className="focus-ring inline-flex items-center gap-1 rounded-sm text-sm text-info hover:underline">
          <Phone className="size-3" aria-hidden />
          {d.donorPhone}
        </a>
      </div>
      <div className="text-right">
        <p className="font-label text-2xs text-ink-faint uppercase">Code</p>
        <p className="font-mono text-base font-bold tracking-widest">{d.confirmationCode}</p>
      </div>
      <div className="text-right">
        <p className="font-label text-2xs text-ink-faint uppercase">Arriving</p>
        <p className="text-sm">{d.arrivalWindow}</p>
      </div>
      {d.status === "arrived" ? <Badge tone="ok">Arrived</Badge> : null}
      <Button size="sm" variant="primary" icon={<HeartHandshake className="size-3.5" aria-hidden />} loading={complete.isPending} onClick={() => complete.mutate(undefined)}>
        Mark donation complete
      </Button>
    </li>
  );
}
