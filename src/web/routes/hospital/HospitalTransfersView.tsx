import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ArrowRightLeft, Check, Minus, PackageCheck, Pencil, Plus, Truck, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import type { ApproveTransferInput, DismissTransferInput, SiteDTO, TransferBoardDTO, TransferSuggestionDTO } from "../../../shared/api";
import { COMPONENT_LABEL, COMPONENT_SHORT } from "../../../shared/domain";
import { CityMap, type MapArc, type MapMarker } from "../../components/map/CityMap";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { SkeletonRows } from "../../components/ui/Skeleton";
import { api, errorMessage } from "../../lib/api";
import { cn } from "../../lib/cn";
import { formatHours, formatIST, plural } from "../../lib/format";
import { queryKeys } from "../../lib/queryKeys";
import { ConfirmActionDialog } from "./ConfirmActionDialog";
import { MapErrorBoundary } from "./MapErrorBoundary";
import { actAs } from "./useHospitalView";

const TOOLTIP_STYLE = {
  backgroundColor: "#FFFFFF",
  border: "1px solid #EAE6E3",
  borderRadius: "10px",
  boxShadow: "0 10px 24px -10px rgb(127 20 34 / 0.2)",
  fontSize: "12px",
};

export interface HospitalTransfersViewProps {
  hospital: SiteDTO;
  sites: SiteDTO[];
  board: TransferBoardDTO | undefined;
  boardLoading: boolean;
  boardError: unknown;
  onRetryBoard: () => void;
}

export function HospitalTransfersView({
  hospital,
  sites,
  board,
  boardLoading,
  boardError,
  onRetryBoard,
}: HospitalTransfersViewProps) {
  const qc = useQueryClient();
  const [focused, setFocused] = useState<string | null>(null);
  const [onlyMine, setOnlyMine] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState<{ s: TransferSuggestionDTO; qty: number } | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [customQty, setCustomQty] = useState<Record<string, number>>({});

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: queryKeys.forecast() });
    void qc.invalidateQueries({ queryKey: ["transfers"] });
    void qc.invalidateQueries({ queryKey: queryKeys.stock(hospital.id) });
  };

  const approve = useMutation({
    mutationFn: (input: ApproveTransferInput) => {
      actAs(hospital.id);
      return api.transfers.approve(input);
    },
    onSuccess: (t) => {
      toast.success(`Transfer approved: ${t.quantity} × ${t.bloodGroup} to ${t.toName}`);
      setConfirmApprove(null);
      setEditingKey(null);
      refresh();
    },
    onError: (e) => toast.error("Could not approve transfer", { description: errorMessage(e) }),
  });

  const dismiss = useMutation({
    mutationFn: (input: DismissTransferInput) => {
      actAs(hospital.id);
      return api.transfers.dismiss(input);
    },
    onSuccess: () => {
      toast.info("Transfer suggestion dismissed");
      refresh();
    },
    onError: (e) => toast.error("Could not dismiss suggestion", { description: errorMessage(e) }),
  });

  const complete = useMutation({
    mutationFn: (id: string) => {
      actAs(hospital.id);
      return api.transfers.complete(id);
    },
    onSuccess: (t) => {
      toast.success(`Marked delivered to ${t.toName}`);
      refresh();
    },
    onError: (e) => toast.error("Could not complete transfer", { description: errorMessage(e) }),
  });

  const suggestions = useMemo(() => {
    const raw = [...(board?.suggestions ?? [])].sort((a, b) => a.priority - b.priority);
    return onlyMine ? raw.filter((s) => s.fromSiteId === hospital.id || s.toSiteId === hospital.id) : raw;
  }, [board, onlyMine, hospital.id]);

  const activeTransfers = useMemo(() => {
    const raw = (board?.active ?? []).filter((t) => t.status === "approved");
    return onlyMine ? raw.filter((t) => t.fromSiteId === hospital.id || t.toSiteId === hospital.id) : raw;
  }, [board, onlyMine, hospital.id]);

  const completedTransfers = useMemo(() => {
    const raw = (board?.active ?? []).filter((t) => t.status === "completed");
    return onlyMine ? raw.filter((t) => t.fromSiteId === hospital.id || t.toSiteId === hospital.id) : raw;
  }, [board, onlyMine, hospital.id]);

  // Visual before/after impact chart data
  const impactChartData = useMemo(() => {
    if (!board) return [];
    return [
      { metric: "Expiring waste", before: board.before.expectedWaste, after: board.after.expectedWaste },
      { metric: "72h shortfall", before: board.before.shortfall, after: board.after.shortfall },
      { metric: "24h unmet", before: board.before.shortfall24h, after: board.after.shortfall24h },
    ];
  }, [board]);

  // Expiry rescue vs idle surplus transfer pie chart
  const rescuePie = useMemo(() => {
    const rescued = suggestions.reduce((n, s) => n + s.rescuedFromExpiry, 0);
    const surplus = Math.max(0, suggestions.reduce((n, s) => n + s.quantity, 0) - rescued);
    const list = [
      { name: "Saved from expiry", value: rescued, color: "#C93245" },
      { name: "Idle surplus moved", value: surplus, color: "#E8A2AB" },
    ].filter((d) => d.value > 0);
    return list.length ? list : [{ name: "None", value: 1, color: "#EAE6E3" }];
  }, [suggestions]);

  const { markers, arcs } = useMemo(() => {
    const byId = new Map(sites.map((s) => [s.id, s]));
    const activeIds = new Set<string>([hospital.id]);
    const list: MapArc[] = [];

    for (const s of suggestions) {
      activeIds.add(s.fromSiteId);
      activeIds.add(s.toSiteId);
      const from = byId.get(s.fromSiteId);
      const to = byId.get(s.toSiteId);
      if (from && to) list.push({ id: s.key, from, to, state: "suggested", tone: "bridge", emphasis: focused === s.key });
    }
    for (const t of activeTransfers) {
      activeIds.add(t.fromSiteId);
      activeIds.add(t.toSiteId);
      const from = byId.get(t.fromSiteId);
      const to = byId.get(t.toSiteId);
      if (from && to) list.push({ id: t.id, from, to, state: "active", tone: "accent", emphasis: focused === t.id });
    }

    const mapMarkers: MapMarker[] = [...activeIds].flatMap((id) => {
      const s = byId.get(id);
      if (!s) return [];
      return [
        {
          id: s.id,
          lat: s.lat,
          lng: s.lng,
          label: `${s.name} (${s.areaName})`,
          tone: s.id === hospital.id ? "info" : "accent",
          shape: s.kind === "hospital" ? "square" : "round",
          size: s.id === hospital.id ? "lg" : "md",
          highlighted: s.id === hospital.id,
        },
      ];
    });
    return { markers: mapMarkers, arcs: list };
  }, [sites, suggestions, activeTransfers, focused, hospital.id]);

  const totalProposedUnits = suggestions.reduce((n, s) => n + s.quantity, 0);
  const totalRescuedUnits = suggestions.reduce((n, s) => n + s.rescuedFromExpiry, 0);

  return (
    <div className="space-y-5">
      {/* Scope Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Transfer scope"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "Home" || e.key === "End") {
              e.preventDefault();
              setOnlyMine((v) => !v);
            }
          }}
          className="inline-flex border-b border-[#EAE6E3]"
        >
          <button
            type="button"
            role="tab"
            aria-selected={!onlyMine}
            tabIndex={!onlyMine ? 0 : -1}
            onClick={() => setOnlyMine(false)}
            className="h-tab focus-ring cursor-pointer px-4 py-2 text-xs font-bold text-[#737373] hover:text-[#171717]"
          >
            All Mumbai ({board?.suggestions.length ?? 0})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={onlyMine}
            tabIndex={onlyMine ? 0 : -1}
            onClick={() => setOnlyMine(true)}
            className="h-tab focus-ring cursor-pointer px-4 py-2 text-xs font-bold text-[#737373] hover:text-[#171717]"
          >
            Involving {hospital.shortName}
          </button>
        </div>

        <div className="h-num flex items-center gap-2 text-xs font-bold">
          <span className="rounded-full bg-[#FCEBED] px-3 py-1 text-[#C93245]">{suggestions.length} proposals</span>
          <span className="rounded-full bg-white px-3 py-1 text-[#171717] ring-1 ring-[#EAE6E3]">{activeTransfers.length} moving</span>
        </div>
      </div>

      {/* VISUAL IMPACT ANALYTICS ROW: BEFORE/AFTER BAR CHART + RESCUE DONUT */}
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="h-card p-4 lg:col-span-7">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="h-display text-xs font-bold text-[#171717]">Transfer plan impact · Before vs After</h2>
            <div className="flex items-center gap-3 text-[11px] font-medium text-[#737373]">
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-xs bg-[#C93245]" aria-hidden /> Before
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-xs bg-[#171717]" aria-hidden /> After plan
              </span>
            </div>
          </div>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={impactChartData} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAE6E3" />
                <XAxis dataKey="metric" tick={{ fill: "#171717", fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#737373", fontSize: 10 }} axisLine={false} tickLine={false} />
                <RechartsTooltip cursor={{ fill: "#FFF5F5" }} contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="before" name="Before transfers" fill="#C93245" radius={[6, 6, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                <Bar dataKey="after" name="After plan" fill="#171717" radius={[6, 6, 0, 0]} maxBarSize={28} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="h-card-blush flex items-center justify-between gap-4 p-4 lg:col-span-5">
          <div className="relative h-36 w-36 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={rescuePie}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={60}
                  paddingAngle={3}
                  cornerRadius={4}
                  isAnimationActive={false}
                >
                  {rescuePie.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="h-num text-base font-extrabold text-[#C93245]">{totalProposedUnits}</span>
              <span className="text-[9px] font-semibold uppercase text-[#737373]">Units</span>
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <h2 className="h-display text-xs font-bold text-[#171717]">Expiry rescue split</h2>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between rounded-lg bg-white/85 px-2.5 py-1.5 ring-1 ring-[#EAE6E3]">
                <span className="flex items-center gap-1.5 text-[#525252]">
                  <span className="size-2 rounded-full bg-[#C93245]" aria-hidden /> Expiry saved
                </span>
                <span className="h-num font-bold text-[#171717]">{totalRescuedUnits}u</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white/85 px-2.5 py-1.5 ring-1 ring-[#EAE6E3]">
                <span className="flex items-center gap-1.5 text-[#525252]">
                  <span className="size-2 rounded-full bg-[#E8A2AB]" aria-hidden /> Surplus moved
                </span>
                <span className="h-num font-bold text-[#171717]">{Math.max(0, totalProposedUnits - totalRescuedUnits)}u</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-[#FCEBED]/70 px-2.5 py-1.5">
                <span className="font-medium text-[#A82436]">Completed (24h)</span>
                <span className="h-num font-bold text-[#A82436]">{completedTransfers.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {boardError ? (
        <ErrorState what="transfer board" error={boardError} onRetry={onRetryBoard} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-12">
          {/* Regional Transfer Map */}
          <div className="h-card h-80 overflow-hidden lg:sticky lg:top-20 lg:col-span-5 lg:h-[34rem]">
            <MapErrorBoundary fallbackTitle="Regional transfer route map">
              <CityMap
                theme="clinical"
                markers={markers}
                arcs={arcs}
                fitToMarkers
                fitPadding={45}
                label="Regional blood transfer routes across Mumbai"
                className="size-full [&_.maplibregl-map]:h-full"
              />
            </MapErrorBoundary>
          </div>

          {/* Transfer Cards */}
          <div className="space-y-4 lg:col-span-7">
            <section className="h-card overflow-hidden" aria-labelledby="suggested-transfers-title">
              <div className="flex items-center justify-between border-b border-[#EAE6E3] bg-[#FFF5F5]/60 px-4 py-3">
                <h3 id="suggested-transfers-title" className="h-display text-sm font-bold text-[#171717]">
                  Suggested transfers ({suggestions.length})
                </h3>
                <span className="text-[11px] font-medium text-[#737373]">Hover to highlight route</span>
              </div>
              {boardLoading ? (
                <SkeletonRows rows={4} className="p-4" />
              ) : suggestions.length === 0 ? (
                <EmptyState
                  compact
                  icon={<ArrowRightLeft />}
                  title={onlyMine ? `No transfers routed through ${hospital.shortName}` : "No transfers needed"}
                  description={onlyMine ? "Switch to All Mumbai to review city-wide rebalancing." : "Stock is balanced across sites."}
                  action={onlyMine ? <Button size="sm" variant="secondary" onClick={() => setOnlyMine(false)}>Show All Mumbai</Button> : undefined}
                />
              ) : (
                <ul className="divide-y divide-[#EAE6E3]">
                  {suggestions.map((s) => {
                    const editing = editingKey === s.key;
                    const qty = customQty[s.key] ?? s.quantity;
                    const isFocused = focused === s.key;
                    return (
                      <li
                        key={s.key}
                        onMouseEnter={() => setFocused(s.key)}
                        onMouseLeave={() => setFocused(null)}
                        className={cn("p-4 transition-colors", isFocused && "bg-[#FFF5F5]")}
                      >
                        <div className="flex items-start gap-3">
                          <span className="h-num mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-[#C93245] text-xs font-extrabold text-white">
                            {s.bloodGroup.replace("-", "−")}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5 text-sm">
                              <span className="font-semibold text-[#171717]">{s.fromName}</span>
                              <ArrowRight className="size-3.5 text-[#C93245]" aria-hidden />
                              <span className="font-bold text-[#171717]">{s.toName}</span>
                            </div>
                            <div className="h-num mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                              <span className="rounded bg-[#FCEBED] px-1.5 py-0.5 font-bold text-[#A82436]">
                                {plural(s.quantity, "unit")} {COMPONENT_SHORT[s.component]}
                              </span>
                              <span className="text-[#737373]">ETA ~{s.etaMinutes}m</span>
                              {s.receiverStockoutHours !== null ? (
                                <span className="font-bold text-[#C93245]">Dry ~{formatHours(s.receiverStockoutHours)}</span>
                              ) : null}
                              {s.rescuedFromExpiry > 0 ? (
                                <span className="font-bold text-[#15803D]">{s.rescuedFromExpiry} rescued</span>
                              ) : null}
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {editing ? (
                                <div className="inline-flex items-center rounded-xl border border-[#EAE6E3] bg-white">
                                  <button
                                    type="button"
                                    aria-label="Decrease quantity"
                                    onClick={() => setCustomQty((p) => ({ ...p, [s.key]: Math.max(1, qty - 1) }))}
                                    className="focus-ring grid size-7 place-items-center text-[#525252] hover:bg-[#FAF9F6]"
                                  >
                                    <Minus className="size-3.5" aria-hidden />
                                  </button>
                                  <span className="h-num w-8 text-center text-xs font-bold text-[#171717]">{qty}</span>
                                  <button
                                    type="button"
                                    aria-label="Increase quantity"
                                    onClick={() => setCustomQty((p) => ({ ...p, [s.key]: Math.min(50, qty + 1) }))}
                                    className="focus-ring grid size-7 place-items-center text-[#525252] hover:bg-[#FAF9F6]"
                                  >
                                    <Plus className="size-3.5" aria-hidden />
                                  </button>
                                </div>
                              ) : null}

                              <Button
                                size="sm"
                                variant="primary"
                                icon={<Check className="size-3.5" aria-hidden />}
                                onClick={() => setConfirmApprove({ s, qty })}
                                className="rounded-xl"
                              >
                                Approve{editing ? ` (${qty})` : ""}
                              </Button>

                              {!editing ? (
                                <Button size="sm" variant="secondary" icon={<Pencil className="size-3" aria-hidden />} onClick={() => setEditingKey(s.key)}>
                                  Qty
                                </Button>
                              ) : null}

                              <Button
                                size="sm"
                                variant="ghost"
                                className="ml-auto"
                                loading={dismiss.isPending && dismiss.variables?.fromSiteId === s.fromSiteId && dismiss.variables?.toSiteId === s.toSiteId}
                                icon={<X className="size-3.5" aria-hidden />}
                                onClick={() =>
                                  dismiss.mutate({
                                    fromSiteId: s.fromSiteId,
                                    toSiteId: s.toSiteId,
                                    bloodGroup: s.bloodGroup,
                                    component: s.component,
                                  })
                                }
                              >
                                Dismiss
                              </Button>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {activeTransfers.length > 0 ? (
              <section className="h-card-blush overflow-hidden" aria-labelledby="active-transfers-title">
                <div className="border-b border-[#EAE6E3] px-4 py-2.5">
                  <h3 id="active-transfers-title" className="h-display text-xs font-bold uppercase tracking-wider text-[#A82436]">
                    In transit ({activeTransfers.length})
                  </h3>
                </div>
                <ul className="divide-y divide-[#EAE6E3] bg-white">
                  {activeTransfers.map((t) => (
                    <li
                      key={t.id}
                      onMouseEnter={() => setFocused(t.id)}
                      onMouseLeave={() => setFocused(null)}
                      className={cn("flex flex-wrap items-center gap-3 p-3.5", focused === t.id && "bg-[#FFF5F5]")}
                    >
                      <Truck className="size-4 shrink-0 text-[#C93245]" aria-hidden />
                      <span className="h-num rounded-lg bg-[#C93245] px-2 py-0.5 text-xs font-bold text-white">
                        {t.bloodGroup.replace("-", "−")}
                      </span>
                      <div className="min-w-0 flex-1 text-xs">
                        <p className="font-bold text-[#171717]">
                          {t.fromName} → {t.toName}
                        </p>
                        <p className="h-num text-[#737373]">
                          {plural(t.quantity, "unit")} {COMPONENT_LABEL[t.component]} · ETA ~{t.etaMinutes}m
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={complete.isPending && complete.variables === t.id}
                        icon={<PackageCheck className="size-3.5" aria-hidden />}
                        onClick={() => complete.mutate(t.id)}
                      >
                        Delivered
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {completedTransfers.length > 0 ? (
              <section className="h-card overflow-hidden" aria-labelledby="completed-transfers-title">
                <div className="border-b border-[#EAE6E3] bg-[#FAF9F6] px-4 py-2.5">
                  <h3 id="completed-transfers-title" className="h-display text-xs font-bold uppercase tracking-wider text-[#737373]">
                    Completed ({completedTransfers.length})
                  </h3>
                </div>
                <ul className="divide-y divide-[#EAE6E3]">
                  {completedTransfers.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs">
                      <span className="font-semibold text-[#171717]">
                        {plural(t.quantity, "unit")} {t.bloodGroup} {COMPONENT_SHORT[t.component]} · {t.fromName} → {t.toName}
                      </span>
                      <span className="h-num font-semibold text-[#15803D]">{t.completedAt ? formatIST(t.completedAt) : ""}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </div>
      )}

      <ConfirmActionDialog
        open={confirmApprove !== null}
        onClose={() => setConfirmApprove(null)}
        onConfirm={() => {
          if (!confirmApprove) return;
          const { s, qty } = confirmApprove;
          approve.mutate({
            fromSiteId: s.fromSiteId,
            toSiteId: s.toSiteId,
            bloodGroup: s.bloodGroup,
            component: s.component,
            quantity: qty,
          });
        }}
        pending={approve.isPending}
        title="Authorize blood transfer?"
        description="Units will move to in-transit status immediately."
        confirmLabel="Approve & dispatch"
      >
        {confirmApprove ? (
          <div className="rounded-xl bg-[#FFF5F5] p-3 text-xs ring-1 ring-[#EAE6E3]">
            <p className="font-bold text-[#171717]">
              {plural(confirmApprove.qty, "unit")} · {confirmApprove.s.bloodGroup} {COMPONENT_LABEL[confirmApprove.s.component]}
            </p>
            <p className="mt-1 text-[#737373]">
              {confirmApprove.s.fromName} → {confirmApprove.s.toName} · ETA ~{confirmApprove.s.etaMinutes}m
            </p>
          </div>
        ) : null}
      </ConfirmActionDialog>
    </div>
  );
}
