import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, Package } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { SiteDTO } from "../../../shared/api";
import { POLICY } from "../../../shared/domain";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { FreshnessPill } from "../../components/ui/FreshnessPill";
import { SkeletonRows } from "../../components/ui/Skeleton";
import { Stat } from "../../components/ui/Stat";
import { api, errorMessage } from "../../lib/api";
import { plural } from "../../lib/format";
import { queryKeys } from "../../lib/queryKeys";
import { useTick } from "./useTick";
import { StockUnitRow } from "./StockUnitRow";
import { actAs } from "./useHospitalView";

const offeredCount = (res: unknown, fallback: number): number =>
  typeof res === "object" && res !== null && "offered" in res && typeof res.offered === "number" ? res.offered : fallback;

/** The hospital's own inventory. Short-dated units can be offered to the city for transfer before they expire. */
export function StockPanel({ hospital }: { hospital: SiteDTO }) {
  const queryClient = useQueryClient();
  const now = useTick(60_000);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const query = useQuery({
    queryKey: queryKeys.stock(hospital.id),
    queryFn: ({ signal }) => api.sites.stock(hospital.id, signal),
  });

  const offer = useMutation({
    mutationFn: (unitIds: string[]) => {
      actAs(hospital.id);
      return api.sites.offer(hospital.id, { unitIds });
    },
    onSuccess: (res, unitIds) => {
      toast.success(`Offered ${plural(offeredCount(res, unitIds.length), "unit")} for transfer`, {
        description: "Blood banks and the command centre now see them on the transfer board.",
      });
      setSelected(new Set());
      void queryClient.invalidateQueries({ queryKey: queryKeys.stock(hospital.id) });
    },
    onError: (error) => toast.error("Couldn't offer those units", { description: errorMessage(error) }),
  });

  const soonMs = POLICY.expiringSoonHours * 3_600_000;
  const units = (query.data?.units ?? []).filter((u) => u.status === "available" || u.status === "reserved");
  const isSoon = (expiresAt: number) => expiresAt - now < soonMs;
  const offerable = units.filter((u) => u.status === "available" && !u.offered);
  const expiringIds = offerable.filter((u) => isSoon(u.expiresAt)).map((u) => u.id);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Card as="section" aria-labelledby="stock-title" className="overflow-hidden">
      <CardHeader
        id="stock-title"
        title={`${hospital.shortName} stock`}
        description={`Units expiring within ${POLICY.expiringSoonHours} h are highlighted. Offer them before they go to waste.`}
        actions={query.data ? <FreshnessPill lastSyncAt={query.data.site.lastSyncAt} /> : null}
      />
      {query.isPending ? (
        <SkeletonRows rows={6} className="px-4 pb-4" />
      ) : query.isError ? (
        <ErrorState what="this hospital's stock" error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 border-y border-line bg-surface-2/50 px-4 py-3">
            <Stat label="On hand" value={query.data.totals.onHand} unit="units" />
            <Stat label="Reserved" value={query.data.totals.reserved} unit="units" />
            <Stat label="Expiring ≤48 h" value={query.data.totals.expiring48h} unit="units" tone={query.data.totals.expiring48h > 0 ? "warn" : "neutral"} />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-2.5">
            <Button size="sm" variant="secondary" disabled={expiringIds.length === 0} onClick={() => setSelected(new Set(expiringIds))}>
              Select expiring ({expiringIds.length})
            </Button>
            {selected.size > 0 ? (
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="bridge"
              className="ml-auto"
              disabled={selected.size === 0}
              loading={offer.isPending}
              onClick={() => offer.mutate([...selected])}
              icon={<ArrowRightLeft className="size-4" aria-hidden />}
            >
              Offer {selected.size > 0 ? plural(selected.size, "unit") : "units"} for transfer
            </Button>
          </div>
          {units.length === 0 ? (
            <EmptyState icon={<Package />} title="No units in stock" description="Units received from blood banks appear here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <caption className="sr-only">Units in stock, soonest expiry first</caption>
                <thead className="font-label text-2xs uppercase tracking-wider text-ink-faint">
                  <tr>
                    <th scope="col" className="py-2 pl-3">
                      <span className="sr-only">Select</span>
                    </th>
                    <th scope="col" className="py-2 pr-2">Unit</th>
                    <th scope="col" className="hidden py-2 pr-2 sm:table-cell">ID</th>
                    <th scope="col" className="py-2 pr-2">Expiry</th>
                    <th scope="col" className="py-2 pr-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...units]
                    .sort((a, b) => a.expiresAt - b.expiresAt)
                    .map((u) => (
                      <StockUnitRow key={u.id} unit={u} expiringSoon={isSoon(u.expiresAt)} selected={selected.has(u.id)} onToggle={() => toggle(u.id)} />
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
