import { BellRing, MessageCircle, PartyPopper } from "lucide-react";
import type { DonorAlertDTO, DonorDTO, DonorSignupDTO } from "../../../../shared/api";
import { BloodGroupChip } from "../../../components/ui/BloodGroupChip";
import { Button, buttonVariants } from "../../../components/ui/Button";
import { cn } from "../../../lib/cn";
import { firstName } from "../copy";
import { EligibilityCard } from "./EligibilityCard";
import { ImpactCard } from "./ImpactCard";
import { NearbyBanks } from "./NearbyBanks";

export function HomeTab({
  donor,
  pending,
  justJoined,
  whatsappJoin,
  onOpenAlert,
}: {
  donor: DonorDTO;
  /** An alert still waiting for an answer, if any. */
  pending: DonorAlertDTO | undefined;
  /** Shown once after the quick join. */
  justJoined: boolean;
  /** Click-to-chat after a signup that chose WhatsApp: the donor messages first, which opens WhatsApp's 24 h window. */
  whatsappJoin?: DonorSignupDTO["whatsappJoin"];
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

      {whatsappJoin?.waLink ? (
        <section aria-labelledby="wa-join-title" className="space-y-3 rounded-(--radius-panel) border border-line bg-surface p-4">
          <div className="flex gap-3">
            <MessageCircle className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
            <div>
              <h2 id="wa-join-title" className="font-semibold text-ink">
                One last tap: confirm WhatsApp
              </h2>
              <p className="mt-0.5 text-sm text-ink-muted">
                Send the prefilled message to Blood Bridge's official WhatsApp. It links this number to your profile so alerts come from
                the verified Blood Bridge sender. Reply STOP there any time.
              </p>
            </div>
          </div>
          <a
            href={whatsappJoin.waLink}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "primary", size: "lg" }), "h-auto min-h-12 w-full py-2 text-center whitespace-normal")}
          >
            <MessageCircle className="size-5 shrink-0" aria-hidden />
            Open WhatsApp: say hi to Blood Bridge
          </a>
          <p className="text-center font-mono text-xs text-ink-faint">Message: {whatsappJoin.text}</p>
        </section>
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
