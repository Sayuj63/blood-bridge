import { Check, ChevronDown, UserPlus } from "lucide-react";
import { useState } from "react";
import type { DonorDTO } from "../../../shared/api";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { cn } from "../../lib/cn";
import { firstName, formatDate } from "./copy";

function personaStatus(p: DonorDTO): string {
  if (p.optedOutAt !== null) return "Opted out";
  if (p.eligible) return "Eligible now";
  return p.eligibleFrom ? `Eligible ${formatDate(p.eligibleFrom)}` : "Resting";
}

function istGreeting(): string {
  const hourStr = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    hour12: false,
  }).format(Date.now());
  const hour = Number.parseInt(hourStr, 10);
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Header greeting + demo persona switcher bar (mirrors Hospital Command's top bar). */
export function PersonaSwitcher({
  personas,
  current,
  onSelect,
  onJoin,
}: {
  personas: DonorDTO[];
  current: DonorDTO | undefined;
  onSelect: (donorId: string) => void;
  onJoin: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="min-w-0">
        <h1 className="d-display truncate text-base font-bold text-[#171717] sm:text-lg">
          {current ? `${istGreeting()}, ${firstName(current.name)}` : "Donor Portal"}
        </h1>
        {current ? (
          <p className="d-num mt-0.5 truncate text-xs text-[#737373]">
            {current.bloodGroup.replace("-", "−")} · {current.areaName}
            {current.lastDonationAt !== null ? ` · Last gave ${formatDate(current.lastDonationAt)}` : ""}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="focus-ring inline-flex min-h-11 max-w-[56%] shrink-0 touch-manipulation items-center gap-1.5 rounded-xl border border-[#EAE6E3] bg-white px-3 text-xs font-semibold text-[#171717] shadow-2xs transition-all hover:border-[#C93245]/40 hover:bg-[#FCEBED]/40 active:scale-[0.98]"
      >
        <span className="rounded bg-[#FCEBED] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#C93245]">Demo</span>
        <span className="truncate">{current ? current.name : "Choose persona"}</span>
        <ChevronDown className="size-3.5 shrink-0 text-[#737373]" aria-hidden />
        <span className="sr-only">: switch simulated donor</span>
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        side="bottom"
        title="Simulated donors"
        description="Switch demo donor profiles or sign up as a new donor."
        className="sm:left-1/2 sm:max-w-[440px] sm:-translate-x-1/2"
      >
        <ul className="-mx-2 space-y-1">
          {personas.map((p) => {
            const selected = p.id === current?.id;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  aria-current={selected ? "true" : undefined}
                  onClick={() => {
                    onSelect(p.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "focus-ring flex min-h-14 w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-[#FFF5F5]",
                    selected && "bg-[#FCEBED]/70",
                  )}
                >
                  <span
                    className={cn(
                      "d-num grid size-10 shrink-0 place-items-center rounded-xl text-sm font-extrabold",
                      selected ? "bg-[#C93245] text-white" : "bg-[#FCEBED] text-[#A82436]",
                    )}
                  >
                    {p.bloodGroup.replace("-", "−")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-[#171717]">{p.name}</span>
                    <span className="block truncate text-xs text-[#737373]">
                      {p.areaName} · {personaStatus(p)}
                    </span>
                  </span>
                  {selected ? <Check className="size-5 shrink-0 text-[#C93245]" aria-label="Selected" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
        <Button
          variant="primary"
          size="lg"
          className="mt-4 w-full rounded-xl bg-[#C93245] hover:bg-[#A82436]"
          icon={<UserPlus className="size-4" aria-hidden />}
          onClick={() => {
            setOpen(false);
            onJoin();
          }}
        >
          Become a donor
        </Button>
      </Dialog>
    </>
  );
}
