import { Check, ChevronDown, UserPlus } from "lucide-react";
import { useState } from "react";
import type { DonorDTO } from "../../../shared/api";
import { BloodGroupChip } from "../../components/ui/BloodGroupChip";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { cn } from "../../lib/cn";
import { formatDate } from "./copy";

function personaStatus(p: DonorDTO): string {
  if (p.optedOutAt !== null) return "Opted out";
  if (p.eligible) return "Eligible now";
  return p.eligibleFrom ? `Eligible from ${formatDate(p.eligibleFrom)}` : "Not eligible yet";
}

/** Demo-only chip: switch between simulated donor personas, or start a new sign-up. */
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="focus-ring ml-auto inline-flex h-11 max-w-[60%] items-center gap-1.5 rounded-full border border-dashed border-line-strong bg-surface px-3 text-xs text-ink-muted"
      >
        <span className="font-label uppercase tracking-wide text-ink-faint">Demo</span>
        <span className="truncate font-medium text-ink">{current ? current.name : "Choose persona"}</span>
        <ChevronDown className="size-3.5 shrink-0" aria-hidden />
        <span className="sr-only">: switch simulated donor</span>
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        side="bottom"
        title="Simulated donors"
        description="Demo personas only. No real donor data is used."
        className="sm:left-1/2 sm:max-w-[420px] sm:-translate-x-1/2"
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
                    "focus-ring flex min-h-14 w-full items-center gap-3 rounded-(--radius-control) px-2 py-2 text-left hover:bg-surface-2",
                    selected && "bg-surface-2",
                  )}
                >
                  <BloodGroupChip group={p.bloodGroup} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{p.name}</span>
                    <span className="block truncate text-sm text-ink-muted">
                      {p.areaName} · {personaStatus(p)}
                    </span>
                  </span>
                  {selected ? <Check className="size-5 text-accent" aria-label="Selected" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
        <Button
          variant="secondary"
          size="lg"
          className="mt-4 w-full"
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
