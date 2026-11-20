import { Phone, PhoneCall } from "lucide-react";
import type { ReservationDTO } from "../../../shared/api";
import { POLICY } from "../../../shared/domain";
import { Button } from "../../components/ui/Button";
import { formatIST } from "../../lib/format";
import { useSites } from "../../lib/queries";

/**
 * Stock at the bank was older than the freshness threshold when reserved, so a
 * human confirms it by phone before anyone drives over. Pickup stays blocked until then.
 */
export function PhoneCheck({ reservation, onConfirm, pending }: { reservation: ReservationDTO; onConfirm: () => void; pending: boolean }) {
  const phone = useSites().data?.find((s) => s.id === reservation.bankSiteId)?.phone;

  if (reservation.phoneConfirmedAt !== null) {
    return (
      <p className="flex items-center gap-2 text-sm text-ok">
        <PhoneCall className="size-4" aria-hidden />
        Stock confirmed by phone at {formatIST(reservation.phoneConfirmedAt)}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-(--radius-control) border border-warn/40 bg-warn-soft p-3">
      <Phone className="size-5 shrink-0 text-warn" aria-hidden />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold text-ink">Phone check needed before pickup</p>
        <p className="text-ink-muted">
          {reservation.bankName}'s stock was more than {POLICY.staleAfterMinutes} min old.{" "}
          {phone ? (
            <>
              Call{" "}
              <a href={`tel:${phone.replace(/\s/g, "")}`} className="focus-ring rounded-sm font-numeric font-semibold text-ink underline">
                {phone}
              </a>{" "}
              to confirm the units are on the shelf.
            </>
          ) : (
            "Call the bank to confirm the units are on the shelf."
          )}
        </p>
      </div>
      <Button size="sm" loading={pending} onClick={onConfirm}>
        Confirmed by phone
      </Button>
    </div>
  );
}
