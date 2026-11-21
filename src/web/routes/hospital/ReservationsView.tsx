import { AlertCircle, ArrowRight, ClipboardList, Plus, Search } from "lucide-react";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import type { RequestDTO, SiteDTO } from "../../../shared/api";
import { COMPONENT_SHORT } from "../../../shared/domain";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { SkeletonRows } from "../../components/ui/Skeleton";
import { cn } from "../../lib/cn";
import { relativeTime } from "../../lib/format";
import { RequestDetail } from "./RequestDetail";
import { requestStatus } from "./statusMeta";
import { useHospitalMutations } from "./useHospitalMutations";
import { useTick } from "./useTick";

type RequestFilter = "all" | "active" | "pending" | "fulfilled";

export interface ReservationsViewProps {
  hospital: SiteDTO;
  requests: RequestDTO[];
  requestsLoading: boolean;
  requestsError: unknown;
  onRetryRequests: () => void;
  selectedId: string | null;
  onSelect: (requestId: string | null) => void;
  onNewRequest: () => void;
}

export function ReservationsView({
  hospital,
  requests,
  requestsLoading,
  requestsError,
  onRetryRequests,
  selectedId,
  onSelect,
  onNewRequest,
}: ReservationsViewProps) {
  const now = useTick(15_000);
  const [filter, setFilter] = useState<RequestFilter>("all");
  const [donorsAlerted, setDonorsAlerted] = useState<Record<string, number>>({});
  const filterTabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const FILTER_IDS: readonly RequestFilter[] = ["all", "active", "pending", "fulfilled"];
  const { reserve, reserveSplit, critical } = useHospitalMutations(hospital.id, { openRequest: onSelect });

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (filter === "active") return r.status === "open";
      if (filter === "pending") return r.status === "open" && (r.active?.status === "requested" || !r.active);
      if (filter === "fulfilled") return r.status === "fulfilled";
      return true;
    });
  }, [requests, filter]);

  const effectiveId = selectedId ?? filteredRequests[0]?.id ?? requests[0]?.id ?? null;

  const counts = useMemo(
    () => ({
      all: requests.length,
      active: requests.filter((r) => r.status === "open").length,
      pending: requests.filter((r) => r.status === "open" && (r.active?.status === "requested" || !r.active)).length,
      fulfilled: requests.filter((r) => r.status === "fulfilled").length,
    }),
    [requests],
  );

  const statusPie = useMemo(() => {
    const items = [
      { name: "Fulfilled", value: counts.fulfilled, color: "#FCEBED" },
      { name: "In progress", value: Math.max(0, counts.active - counts.pending), color: "#FFFFFF" },
      { name: "Pending bank", value: counts.pending, color: "#FDE047" },
    ].filter((d) => d.value > 0);
    return items.length ? items : [{ name: "Idle", value: 1, color: "rgba(255,255,255,0.22)" }];
  }, [counts]);

  const reservingSiteId = reserve.isPending ? reserve.variables.bankSiteId : null;

  return (
    <div className="space-y-5">
      {/* Crimson Reservation Telemetry Ribbon */}
      <section aria-label="Reservation telemetry" className="h-hero-crimson flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusPie}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={24}
                  outerRadius={36}
                  paddingAngle={2}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {statusPie.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{ backgroundColor: "#171717", border: "none", borderRadius: "8px", fontSize: "11px", color: "#FFFFFF" }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="h-num text-sm font-extrabold text-white">{counts.all}</span>
            </div>
          </div>
          <div>
            <h2 className="h-display text-base font-bold text-white">Reservations &amp; Live Tracking</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="h-num rounded-lg bg-white/15 px-2.5 py-1 font-bold text-white">{counts.active} Active</span>
              <span className="h-num rounded-lg bg-white/15 px-2.5 py-1 font-bold text-[#FCEBED]">{counts.pending} Pending bank</span>
              <span className="h-num rounded-lg bg-white/15 px-2.5 py-1 font-bold text-white">{counts.fulfilled} Delivered</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onNewRequest}
          className="focus-ring group inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-white px-4 text-xs font-bold text-[#A82436] shadow-md transition-all hover:-translate-y-0.5 hover:bg-[#FFF5F5] hover:shadow-lg"
        >
          <Plus className="size-4" aria-hidden />
          <span>New blood request</span>
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </button>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-12">
        {/* Left: Request List */}
        <section aria-label="Hospital requests list" className="h-card overflow-hidden lg:col-span-4">
          <div className="border-b border-[#EAE6E3] bg-[#FFF5F5]/60 px-3.5 pt-2.5">
            <div
              role="tablist"
              aria-label="Filter requests"
              onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                const idx = FILTER_IDS.indexOf(filter);
                let next: number | null = null;
                if (e.key === "ArrowRight") next = (idx + 1) % FILTER_IDS.length;
                else if (e.key === "ArrowLeft") next = (idx - 1 + FILTER_IDS.length) % FILTER_IDS.length;
                else if (e.key === "Home") next = 0;
                else if (e.key === "End") next = FILTER_IDS.length - 1;
                if (next === null) return;
                e.preventDefault();
                setFilter(FILTER_IDS[next]);
                filterTabRefs.current[next]?.focus();
              }}
              className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]"
            >
              {(
                [
                  { id: "all", label: `All (${counts.all})` },
                  { id: "active", label: `Active (${counts.active})` },
                  { id: "pending", label: `Pending (${counts.pending})` },
                  { id: "fulfilled", label: `Done (${counts.fulfilled})` },
                ] as const
              ).map((tab, i) => (
                <button
                  key={tab.id}
                  ref={(el) => {
                    filterTabRefs.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  aria-selected={filter === tab.id}
                  tabIndex={filter === tab.id ? 0 : -1}
                  onClick={() => setFilter(tab.id)}
                  className="h-tab focus-ring shrink-0 cursor-pointer px-2.5 py-2 text-xs font-bold text-[#737373] hover:text-[#171717]"
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {requestsLoading ? (
            <SkeletonRows rows={4} className="p-3.5" />
          ) : requestsError ? (
            <ErrorState compact what="hospital requests" error={requestsError} onRetry={onRetryRequests} />
          ) : filteredRequests.length === 0 ? (
            <EmptyState
              compact
              icon={<ClipboardList />}
              title={requests.length === 0 ? "No requests yet" : "No matches"}
              description={requests.length === 0 ? "Reserve compatible stock via Find Blood to track delivery live." : "Switch tabs above."}
              action={
                requests.length === 0 ? (
                  <Button size="sm" variant="primary" onClick={onNewRequest} icon={<Search className="size-3.5" aria-hidden />}>
                    Find blood
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="max-h-[38rem] divide-y divide-[#EAE6E3] overflow-y-auto">
              {filteredRequests.map((r) => {
                const status = requestStatus(r);
                const selected = r.id === effectiveId;
                const overdue = r.status === "open" && r.neededBy < now;
                const awaitingBank = r.status === "open" && r.active?.status === "requested";
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(r.id)}
                      aria-current={selected ? "true" : undefined}
                      className={cn(
                        "focus-ring flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors",
                        selected ? "bg-[#FCEBED]/70" : "bg-white hover:bg-[#FFF5F5]",
                      )}
                    >
                      <span className="h-num mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-[#C93245] text-xs font-extrabold text-white">
                        {r.bloodGroup.replace("-", "−")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-bold text-[#171717]">
                            {r.unitsNeeded}× {COMPONENT_SHORT[r.component]} · {r.ward}
                          </span>
                          <Badge tone={status.tone} size="sm">
                            {status.label}
                          </Badge>
                        </div>
                        <p className="h-num mt-1 truncate text-[11px] text-[#737373]">
                          {relativeTime(r.createdAt, now)}
                          {r.active ? ` · ${r.active.bankName}` : ""}
                        </p>
                        {overdue || awaitingBank ? (
                          <p className={cn("mt-1 inline-flex items-center gap-1 text-[11px] font-bold", overdue ? "text-[#C93245]" : "text-[#A16207]")}>
                            <AlertCircle className="size-3" aria-hidden />
                            {overdue ? "Delayed" : "Awaiting bank"}
                          </p>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Right: 5-Stage Visual Stepper & Route Map */}
        <div className="min-w-0 lg:col-span-8">
          {effectiveId ? (
            <RequestDetail
              key={effectiveId}
              requestId={effectiveId}
              hospital={hospital}
              reservingSiteId={reservingSiteId}
              onReserve={(request, option) => reserve.mutate({ requestId: request.id, bankSiteId: option.siteId })}
              onCritical={(id) =>
                critical.mutate(
                  { requestId: id },
                  { onSuccess: ({ requestId, sent }) => setDonorsAlerted((prev) => ({ ...prev, [requestId]: sent })) },
                )
              }
              criticalPending={critical.isPending}
              onReserveSplit={(id) => reserveSplit.mutate({ requestId: id })}
              splitPending={reserveSplit.isPending}
              donorsAlerted={donorsAlerted[effectiveId]}
            />
          ) : (
            <div className="h-card-blush p-8">
              <EmptyState
                icon={<ClipboardList />}
                title="Live 5-stage tracker ready"
                description="Requested → Bank confirmed → Reserved → Picked up → Delivered."
                action={
                  <Button variant="primary" onClick={onNewRequest} icon={<Search className="size-4" aria-hidden />}>
                    Find blood now
                  </Button>
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
