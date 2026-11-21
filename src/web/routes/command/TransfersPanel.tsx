import { ArrowLeftRight, ArrowRight, Check, Droplet, Leaf, Minus, Package, PackageCheck, Pencil, Plus, Truck, X } from "lucide-react";
import { useState } from "react";
import type { TransferBoardDTO, TransferDTO, TransferSuggestionDTO } from "../../../shared/api";
import { COMPONENT_SHORT } from "../../../shared/domain";
import { Badge } from "../../components/ui/Badge";
import { BloodGroupChip } from "../../components/ui/BloodGroupChip";
import { Button } from "../../components/ui/Button";
import { ErrorState } from "../../components/ui/EmptyState";
import { SkeletonRows } from "../../components/ui/Skeleton";
import { cn } from "../../lib/cn";
import { formatHours, plural } from "../../lib/format";
import { Panel } from "./Panel";
import type { useCommandActions } from "./useCommandActions";

type Actions = ReturnType<typeof useCommandActions>;

export interface TransfersPanelProps {
  board: TransferBoardDTO | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  actions: Actions;
  /** Key of the transfer whose arc is emphasised on the map. */
  focused: string | null;
  onFocus: (key: string | null) => void;
}

/** Expiry-aware transfer plan: approve, modify quantity or dismiss each suggestion; track approved moves. */
export function TransfersPanel({ board, isLoading, error, onRetry, actions, focused, onFocus }: TransfersPanelProps) {
  const suggestions = [...(board?.suggestions ?? [])].sort((a, b) => a.priority - b.priority);
  const active = (board?.active ?? []).filter((t) => t.status === "approved");

  return (
    <Panel id="transfers" icon={<ArrowLeftRight aria-hidden />} title="Transfer plan" meta={board ? `${active.length} moving · ${suggestions.length} suggested` : undefined}>
      {error ? (
        <ErrorState compact what="transfer suggestions" error={error} onRetry={onRetry} />
      ) : isLoading ? (
        <SkeletonRows rows={5} className="p-3" />
      ) : (
        <>
          {suggestions.length === 0 ? (
            <p className="p-3 text-sm text-ink-muted">
              No transfers needed right now. Suggestions appear when one site is forecast to run short while another holds units that
              would expire unused.
            </p>
          ) : (
            <ul aria-label="Suggested transfers, most urgent first">
              {suggestions.map((s) => (
                <SuggestionRow key={s.key} s={s} actions={actions} focused={focused === s.key} onFocus={onFocus} />
              ))}
            </ul>
          )}
          {active.length > 0 ? (
            <>
              <h3 className="border-y border-line bg-surface-2/60 px-3 py-1.5 font-label text-xs text-ink-muted">Approved, in motion</h3>
              <ul aria-label="Approved transfers">
                {active.map((t) => (
                  <ActiveRow key={t.id} t={t} actions={actions} focused={focused === t.id} onFocus={onFocus} />
                ))}
              </ul>
            </>
          ) : null}
        </>
      )}
    </Panel>
  );
}

function Route({ from, to }: { from: string; to: string }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-sm">
      <span className="truncate">{from}</span>
      <ArrowRight className="size-3.5 shrink-0 text-bridge" aria-label="to" />
      <span className="truncate font-semibold">{to}</span>
    </div>
  );
}

function SuggestionRow({
  s,
  actions,
  focused,
  onFocus,
}: {
  s: TransferSuggestionDTO;
  actions: Actions;
  focused: boolean;
  onFocus: (key: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState(s.quantity);
  const target = { fromSiteId: s.fromSiteId, toSiteId: s.toSiteId, bloodGroup: s.bloodGroup, component: s.component };
  const pending =
    (actions.approve.isPending && actions.approve.variables?.toSiteId === s.toSiteId && actions.approve.variables.fromSiteId === s.fromSiteId) ||
    (actions.dismiss.isPending && actions.dismiss.variables?.toSiteId === s.toSiteId && actions.dismiss.variables.fromSiteId === s.fromSiteId);

  return (
    <li
      onMouseEnter={() => onFocus(s.key)}
      onMouseLeave={() => onFocus(null)}
      onFocus={() => onFocus(s.key)}
      className={cn("border-b border-line/70 px-3 py-2.5 transition-colors", focused && "bg-bridge-soft")}
    >
      <div className="flex items-start gap-2.5">
        <BloodGroupChip group={s.bloodGroup} />
        <div className="min-w-0 flex-1">
          <Route from={s.fromName} to={s.toName} />
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-numeric text-2xs text-ink-muted [&_svg]:size-3.5">
            <span className="inline-flex items-center gap-1" title="Units moved">
              <Package aria-hidden /> {s.quantity} {COMPONENT_SHORT[s.component]}
            </span>
            <span className="inline-flex items-center gap-1" title="Travel time">
              <Truck aria-hidden /> {s.etaMinutes}m
            </span>
            {s.receiverStockoutHours !== null ? (
              <span className="inline-flex items-center gap-1 text-critical" title="Receiver runs dry in">
                <Droplet aria-hidden /> {s.receiverStockoutHours < 1 / 60 ? "dry now" : formatHours(s.receiverStockoutHours)}
              </span>
            ) : null}
            {s.rescuedFromExpiry > 0 ? (
              <span className="inline-flex items-center gap-1 text-accent-hover" title="Units saved from expiry">
                <Leaf aria-hidden /> {s.rescuedFromExpiry}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-12">
        {editing ? (
          <div className="flex items-center rounded-(--radius-control) border border-line" role="group" aria-label="Quantity">
            <Button size="icon" variant="ghost" className="size-8" aria-label="One fewer" onClick={() => setQty((q) => Math.max(1, q - 1))}>
              <Minus className="size-3.5" aria-hidden />
            </Button>
            <input
              type="number"
              min={1}
              max={50}
              value={qty}
              onChange={(e) => setQty(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
              className="w-10 bg-transparent text-center font-numeric text-sm outline-none"
              aria-label="Units to move"
            />
            <Button size="icon" variant="ghost" className="size-8" aria-label="One more" onClick={() => setQty((q) => Math.min(50, q + 1))}>
              <Plus className="size-3.5" aria-hidden />
            </Button>
          </div>
        ) : null}
        <Button
          size="sm"
          variant="bridge"
          loading={pending && actions.approve.isPending}
          disabled={pending}
          icon={<Check className="size-3.5" aria-hidden />}
          onClick={() => actions.approve.mutate({ ...target, quantity: editing ? qty : s.quantity })}
        >
          Approve{editing ? ` ${qty}` : ""}
        </Button>
        {!editing ? (
          <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" aria-hidden />} onClick={() => setEditing(true)}>
            Modify qty
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          disabled={pending}
          icon={<X className="size-3.5" aria-hidden />}
          onClick={() => actions.dismiss.mutate(target)}
        >
          Dismiss
        </Button>
      </div>
    </li>
  );
}

function ActiveRow({ t, actions, focused, onFocus }: { t: TransferDTO; actions: Actions; focused: boolean; onFocus: (key: string | null) => void }) {
  return (
    <li
      onMouseEnter={() => onFocus(t.id)}
      onMouseLeave={() => onFocus(null)}
      className={cn("flex items-center gap-2.5 border-b border-line/70 px-3 py-2", focused && "bg-bridge-soft")}
    >
      <Truck className="size-4 shrink-0 text-bridge" aria-hidden />
      <BloodGroupChip group={t.bloodGroup} size="sm" />
      <div className="min-w-0 flex-1">
        <Route from={t.fromName} to={t.toName} />
        <div className="font-numeric text-2xs text-ink-muted">
          {plural(t.quantity, "unit")} {COMPONENT_SHORT[t.component]} · ETA {t.etaMinutes} min
          {t.rescuedFromExpiry > 0 ? ` · ${t.rescuedFromExpiry} saved from expiry` : ""}
        </div>
      </div>
      <Badge tone="bridge" size="sm">
        Moving
      </Badge>
      <Button
        size="sm"
        variant="ghost"
        aria-label={`Mark ${t.quantity} units to ${t.toName} delivered`}
        loading={actions.complete.isPending && actions.complete.variables === t.id}
        icon={<PackageCheck className="size-3.5" aria-hidden />}
        onClick={() => actions.complete.mutate(t.id)}
      />
    </li>
  );
}
