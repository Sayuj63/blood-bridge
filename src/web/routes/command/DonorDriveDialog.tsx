import { useMutation, useQuery } from "@tanstack/react-query";
import { BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { SiteDTO } from "../../../shared/api";
import type { SkipReason } from "../../../shared/eligibility";
import { BLOOD_GROUPS, type BloodGroup } from "../../../shared/domain";
import { BloodGroupChip } from "../../components/ui/BloodGroupChip";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Skeleton } from "../../components/ui/Skeleton";
import { api, errorMessage } from "../../lib/api";
import { cn } from "../../lib/cn";
import { spokenGroup } from "../../lib/format";
import { queryKeys } from "../../lib/queryKeys";

const SKIP_LABEL: Record<SkipReason, string> = {
  group: "Different blood group",
  consent: "No consent for alerts",
  ineligible: "Donated too recently",
  out_of_range: "Too far away",
  quiet_hours: "In quiet hours",
  weekly_cap: "Weekly alert limit reached",
};

export interface DonorDriveDialogProps {
  open: boolean;
  onClose: () => void;
  banks: SiteDTO[];
  defaultBankId?: string;
  defaultGroup?: BloodGroup;
}

/** Targeted donor alert: preview who is eligible and consenting, then send. */
export function DonorDriveDialog({ open, onClose, banks, defaultBankId, defaultGroup = "O-" }: DonorDriveDialogProps) {
  const [bankId, setBankId] = useState(defaultBankId ?? "");
  const [group, setGroup] = useState<BloodGroup>(defaultGroup);
  const [needed, setNeeded] = useState(3);

  useEffect(() => {
    if (!open) return;
    setBankId(defaultBankId ?? banks[0]?.id ?? "");
    setGroup(defaultGroup);
  }, [open, defaultBankId, defaultGroup, banks]);

  const preview = useQuery({
    queryKey: queryKeys.drivePreview(bankId, group),
    queryFn: () => api.drives.preview({ bankSiteId: bankId, bloodGroup: group }),
    enabled: open && bankId !== "",
  });

  const send = useMutation({
    mutationFn: () => api.drives.send({ bankSiteId: bankId, bloodGroup: group, donorsNeeded: needed, urgency: "critical" }),
    onSuccess: (r) => {
      toast.success(`Alert sent to ${r.sent} donors`);
      onClose();
    },
    onError: (e) => toast.error("Sending the alert failed", { description: errorMessage(e) }),
  });

  const skipped = preview.data ? (Object.entries(preview.data.skipped) as [SkipReason, number][]).filter(([, n]) => n > 0) : [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Request donors"
      description="Alerts go only to donors who match, are eligible, are in range and have consented."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            icon={<BellRing className="size-4" aria-hidden />}
            loading={send.isPending}
            disabled={!preview.data || preview.data.eligibleCount === 0}
            onClick={() => send.mutate()}
          >
            Send alert{preview.data ? ` to ${preview.data.eligibleCount}` : ""}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <label className="block">
          <span className="text-sm font-medium">Blood bank donors should go to</span>
          <select
            value={bankId}
            onChange={(e) => setBankId(e.target.value)}
            className="focus-ring mt-1.5 h-10 w-full rounded-(--radius-control) border border-line-strong bg-surface px-3 text-sm"
          >
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} · {b.areaName}
              </option>
            ))}
          </select>
        </label>

        <fieldset>
          <legend className="text-sm font-medium">Blood group needed</legend>
          <div className="mt-1.5 grid grid-cols-4 gap-1.5" role="radiogroup">
            {BLOOD_GROUPS.map((g) => (
              <button
                key={g}
                type="button"
                role="radio"
                aria-checked={group === g}
                aria-label={spokenGroup(g)}
                onClick={() => setGroup(g)}
                className={cn(
                  "focus-ring flex h-10 items-center justify-center rounded-(--radius-control) border",
                  group === g ? "border-ink bg-surface-2" : "border-line",
                )}
              >
                <BloodGroupChip group={g} size="sm" />
              </button>
            ))}
          </div>
        </fieldset>

        <label className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">Close the alert once this many donors accept</span>
          <input
            type="number"
            min={1}
            max={20}
            value={needed}
            onChange={(e) => setNeeded(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
            className="focus-ring h-10 w-20 rounded-(--radius-control) border border-line-strong bg-surface px-3 text-right font-numeric"
          />
        </label>

        <div className="rounded-(--radius-control) border border-line bg-surface-2/60 p-3" aria-live="polite">
          {preview.error ? (
            <p className="text-sm text-critical">{errorMessage(preview.error)}</p>
          ) : !preview.data ? (
            <Skeleton className="h-12" />
          ) : (
            <>
              <p className="font-numeric">
                <span className="text-3xl font-bold">{preview.data.eligibleCount}</span>
                <span className="ml-2 text-sm text-ink-muted">of {preview.data.totalDonors} registered donors will be alerted</span>
              </p>
              {skipped.length > 0 ? (
                <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-ink-muted">
                  {skipped.map(([reason, n]) => (
                    <li key={reason} className="flex justify-between gap-2">
                      <span>{SKIP_LABEL[reason]}</span>
                      <span className="font-numeric">{n}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}
