import { BellOff } from "lucide-react";
import type { DonorDTO } from "../../../shared/api";
import { Button } from "../../components/ui/Button";
import { firstName, formatDate } from "./copy";
import { useOptOut } from "./data";

/** Confirmation after opting out, with a one-tap way back in. */
export function OptedOut({ donor, onOptedIn }: { donor: DonorDTO; onOptedIn: () => void }) {
  const optOut = useOptOut(donor.id);
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 py-8">
      <div className="d-card-blush p-6 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#FCEBED] text-[#C93245]">
          <BellOff className="size-7" aria-hidden />
        </span>
        <div role="status" className="mt-4">
          <h1 className="d-display text-xl font-extrabold text-[#171717]">You&apos;ve opted out, {firstName(donor.name)}</h1>
          <p className="mt-2 text-xs leading-relaxed text-[#737373]">
            {donor.optedOutAt ? `Since ${formatDate(donor.optedOutAt)}, ` : null}
            no alerts are sent and nothing about you is shared with blood banks. Your donation history remains saved for accurate eligibility dates.
          </p>
        </div>
        <Button
          variant="primary"
          size="lg"
          className="mt-5 w-full rounded-xl"
          loading={optOut.isPending}
          onClick={() => optOut.mutate(false, { onSuccess: onOptedIn })}
        >
          Opt back in
        </Button>
        <p className="mt-2.5 text-[11px] text-[#737373]">You&apos;ll choose what to share again; nothing switches on automatically.</p>
      </div>
    </div>
  );
}
