import { BellOff } from "lucide-react";
import type { DonorDTO } from "../../../shared/api";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { firstName, formatDate } from "./copy";
import { useOptOut } from "./data";

/** Confirmation after opting out, with a one-tap way back in. */
export function OptedOut({ donor, onOptedIn }: { donor: DonorDTO; onOptedIn: () => void }) {
  const optOut = useOptOut(donor.id);
  return (
    <div className="flex flex-1 flex-col justify-center gap-5 py-6">
      <span className="grid size-14 place-items-center rounded-full bg-surface-2 text-ink-muted">
        <BellOff className="size-7" aria-hidden />
      </span>
      <div role="status">
        <h1 className="font-display text-2xl leading-tight text-ink">You've opted out, {firstName(donor.name)}</h1>
        <p className="mt-2 text-ink-muted">
          {donor.optedOutAt ? `Since ${formatDate(donor.optedOutAt)}, ` : null}
          we won't send you alerts, and nothing about you is shared with blood banks. Thank you for the help you've already given.
        </p>
      </div>
      <Card className="p-4 text-sm text-ink-muted">
        Your donation history stays on your profile so your eligibility dates stay accurate if you come back.
      </Card>
      <Button variant="primary" size="xl" className="w-full" loading={optOut.isPending} onClick={() => optOut.mutate(false, { onSuccess: onOptedIn })}>
        Opt back in
      </Button>
      <p className="text-center text-sm text-ink-muted">You'll choose what to share again; nothing switches on by itself.</p>
    </div>
  );
}
