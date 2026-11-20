import { BellRing, PartyPopper } from "lucide-react";
import type { DonorAlertDTO, DonorDTO } from "../../../../shared/api";
import { BloodGroupChip } from "../../../components/ui/BloodGroupChip";
import { Button } from "../../../components/ui/Button";
import { firstName } from "../copy";
import { EligibilityCard } from "./EligibilityCard";
import { ImpactCard } from "./ImpactCard";
import { NearbyBanks } from "./NearbyBanks";

export function HomeTab({
  donor,
  pending,
  justJoined,
  onOpenAlert,
}: {
  donor: DonorDTO;
  /** An alert still waiting for an answer, if any. */
  pending: DonorAlertDTO | undefined;
  /** Shown once after the quick join. */
  justJoined: boolean;
  onOpenAlert: (alertId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <BloodGroupChip group={donor.bloodGroup} variant="label" size="md" />
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl leading-tight text-ink">Hi, {firstName(donor.name)}</h1>
          <p className="text-sm text-ink-muted">
            {donor.areaName}
            {donor.donations.length === 0 ? " · group verified at your first donation" : null}
          </p>
        </div>
      </header>

      {justJoined ? (
        <div role="status" className="flex gap-3 rounded-(--radius-panel) border border-ok/30 bg-ok-soft p-4">
          <PartyPopper className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden />
          <div>
            <p className="font-semibold text-ink">You're in.</p>
            <p className="mt-0.5 text-sm text-ink">Keep this screen open; an alert may arrive in the next minute.</p>
          </div>
        </div>
      ) : null}

      {pending ? (
        <div className="flex items-center gap-3 rounded-(--radius-panel) bg-accent p-4 text-accent-ink">
          <BellRing className="size-5 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1 text-sm font-medium">
            {pending.bankName} needs {pending.bloodGroup} donors.
          </p>
          <Button size="md" className="h-11 border-transparent" onClick={() => onOpenAlert(pending.id)}>
            View
          </Button>
        </div>
      ) : null}

      <EligibilityCard donor={donor} />
      <ImpactCard donor={donor} />
      <NearbyBanks donor={donor} />
    </div>
  );
}
