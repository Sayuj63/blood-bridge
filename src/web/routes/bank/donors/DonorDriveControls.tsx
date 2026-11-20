import { useQuery } from "@tanstack/react-query";
import { Eye, Send } from "lucide-react";
import { useState } from "react";
import type { StockCell } from "../../../../shared/api";
import type { BloodGroup } from "../../../../shared/domain";
import { Button } from "../../../components/ui/Button";
import { ErrorState } from "../../../components/ui/EmptyState";
import { Skeleton } from "../../../components/ui/Skeleton";
import { api } from "../../../lib/api";
import { plural } from "../../../lib/format";
import { queryKeys } from "../../../lib/queryKeys";
import { LEVEL_STYLE } from "../dashboard/levels";
import { NumberStepper } from "../shared/NumberStepper";
import { GROUP_OPTIONS } from "../shared/options";
import { SelectField } from "../shared/SelectField";
import { useAction } from "../shared/useAction";
import { DriveFunnel } from "./DriveFunnel";
import { suggestDriveGroup } from "./suggestGroup";

/** Pick a group, preview who would be alerted (and why others are skipped), then send. */
export function DonorDriveControls({ siteId, cells }: { siteId: string; cells: readonly StockCell[] }) {
  const suggested = suggestDriveGroup(cells);
  const [group, setGroup] = useState<BloodGroup>(suggested?.bloodGroup ?? "O-");
  const [previewed, setPreviewed] = useState<BloodGroup | null>(null);
  const [needed, setNeeded] = useState(3);

  const preview = useQuery({
    queryKey: queryKeys.drivePreview(siteId, group),
    queryFn: () => api.drives.preview({ bankSiteId: siteId, bloodGroup: group }),
    enabled: previewed === group,
  });
  const send = useAction({
    run: () => api.drives.send({ bankSiteId: siteId, bloodGroup: group, donorsNeeded: needed }),
    success: (r) => `Alerts sent to ${plural(r.sent, "donor")}. Replies appear under Incoming donors.`,
    onDone: () => setPreviewed(null),
  });
  const showPreview = previewed === group;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <SelectField label="Blood group" value={group} options={GROUP_OPTIONS} onChange={setGroup} className="w-32" />
        <Button icon={<Eye className="size-4" aria-hidden />} onClick={() => setPreviewed(group)} disabled={showPreview}>
          Preview
        </Button>
        {suggested ? (
          <p className="pb-2 text-sm text-ink-muted">
            Suggested: <strong className="text-ink">{suggested.bloodGroup}</strong> · whole blood {LEVEL_STYLE[suggested.level].label.toLowerCase()}
            {suggested.daysOfCover !== null ? `, ${suggested.daysOfCover}d cover` : ""}
          </p>
        ) : null}
      </div>

      {showPreview && preview.isPending ? <Skeleton className="h-56" /> : null}
      {showPreview && preview.isError ? <ErrorState compact what="the drive preview" error={preview.error} onRetry={() => void preview.refetch()} /> : null}
      {showPreview && preview.data ? (
        <>
          <DriveFunnel preview={preview.data} />
          <div className="flex flex-wrap items-end gap-4">
            <NumberStepper label="Donors needed" value={needed} min={1} max={20} onChange={setNeeded} hint="alerts close once this many say yes" />
            <Button
              variant="primary"
              icon={<Send className="size-4" aria-hidden />}
              disabled={preview.data.eligibleCount === 0}
              loading={send.isPending}
              onClick={() => send.mutate(undefined)}
            >
              Send to {plural(preview.data.eligibleCount, "donor")}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
