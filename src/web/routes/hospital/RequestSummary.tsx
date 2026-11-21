import { Siren } from "lucide-react";
import type { RequestDTO } from "../../../shared/api";
import { COMPONENT_LABEL } from "../../../shared/domain";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Countdown } from "../../components/ui/Countdown";
import { UrgencyTag } from "../../components/ui/UrgencyTag";
import { formatIST, plural } from "../../lib/format";
import { BLOOD_GROUP_HEX } from "../../styles/tokens";
import { requestStatus } from "./statusMeta";

interface RequestSummaryProps {
  request: RequestDTO;
  onCritical: () => void;
  criticalPending: boolean;
  /** Donors reached by this session's critical alert, when known. */
  donorsAlerted?: number;
}

/** Header for an open request: what was asked for, by when, and the critical escalation. */
export function RequestSummary({ request, onCritical, criticalPending, donorsAlerted }: RequestSummaryProps) {
  const status = requestStatus(request);
  const open = request.status === "open";

  return (
    <div className="h-card flex flex-wrap items-center gap-3.5 p-4">
      <span
        className="h-num grid size-11 shrink-0 place-items-center rounded-xl text-sm font-bold text-white"
        style={{ backgroundColor: BLOOD_GROUP_HEX[request.bloodGroup] }}
      >
        {request.bloodGroup.replace("-", "−")}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold leading-tight text-[#171717]">
          {plural(request.unitsNeeded, "unit")} · {COMPONENT_LABEL[request.component]}
        </h2>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#737373]">
          <UrgencyTag urgency={request.urgency} size="sm" />
          <span className="font-medium text-[#171717]">{request.ward}</span>
          <span aria-hidden>·</span>
          <span className="h-num">raised {formatIST(request.createdAt)}</span>
          {open ? (
            <>
              <span aria-hidden>·</span>
              <span>
                needed in{" "}
                <Countdown
                  target={request.neededBy}
                  format="clock"
                  label="Needed in"
                  announce={false}
                  warnBelow={30 * 60_000}
                  criticalBelow={10 * 60_000}
                  doneLabel="now — overdue"
                />
              </span>
            </>
          ) : null}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={status.tone} size="md">
          {status.label}
        </Badge>
        {request.criticalBroadcastAt !== null ? (
          <Badge tone="critical" size="md" outline>
            <Siren className="size-3.5" aria-hidden />
            {donorsAlerted !== undefined ? `${plural(donorsAlerted, "donor")} alerted` : "Everyone alerted"} ·{" "}
            {formatIST(request.criticalBroadcastAt)}
          </Badge>
        ) : request.urgency === "critical" && open ? (
          <Button variant="danger" size="sm" loading={criticalPending} onClick={onCritical} icon={<Siren className="size-3.5" aria-hidden />}>
            Critical — alert everyone
          </Button>
        ) : null}
      </div>
    </div>
  );
}
