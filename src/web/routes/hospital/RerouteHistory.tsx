import { ArrowRight, History, Shuffle } from "lucide-react";
import { motion } from "motion/react";
import type { RequestDTO } from "../../../shared/api";
import { Badge } from "../../components/ui/Badge";
import { formatIST } from "../../lib/format";
import { RESERVATION_STATUS, closedReason, isLive } from "./statusMeta";

/** "Rerouted to X" banner, shown when an earlier bank declined or timed out and another bank took over. */
export function RerouteBanner({ request }: { request: RequestDTO }) {
  const closed = request.reservations.filter((r) => !isLive(r));
  const active = request.active;
  if (!active || closed.length === 0) return null;
  // Reservations arrive newest first; the one just before the active bank is the reroute cause.
  const previous = closed.find((r) => r.createdAt <= active.createdAt) ?? closed[0];

  return (
    <motion.div
      key={active.id}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      role="status"
      className="flex items-start gap-3 rounded-(--radius-panel) border border-bridge/40 bg-bridge-soft p-4"
    >
      <Shuffle className="mt-0.5 size-5 shrink-0 text-bridge" aria-hidden />
      <p className="text-sm text-ink">
        <span className="font-semibold">Rerouted to {active.bankName}.</span> {previous.bankName}{" "}
        {previous.status === "expired" ? "didn't confirm in time" : closedReason(previous)}, so the next-best bank was reserved automatically.
      </p>
    </motion.div>
  );
}

/** Every bank tried for this request, oldest first, with why each attempt ended. */
export function RerouteHistory({ request }: { request: RequestDTO }) {
  if (request.reservations.length < 2 && request.reservations.every(isLive)) return null;
  const attempts = [...request.reservations].reverse();

  return (
    <section aria-labelledby={`history-${request.id}`} className="rounded-(--radius-panel) border border-line bg-surface p-4">
      <h3 id={`history-${request.id}`} className="flex items-center gap-2 text-sm font-semibold">
        <History className="size-4 text-ink-muted" aria-hidden />
        Routing history
      </h3>
      <ol className="mt-3 space-y-2">
        {attempts.map((r, i) => {
          const meta = RESERVATION_STATUS[r.status];
          return (
            <li key={r.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="font-numeric text-xs text-ink-faint">{formatIST(r.createdAt)}</span>
              {i > 0 ? <ArrowRight className="size-3.5 text-ink-faint" aria-label="then" /> : null}
              <span className="font-medium">{r.bankName}</span>
              <Badge tone={meta.tone} size="sm">
                {meta.label}
              </Badge>
              {!isLive(r) ? <span className="text-ink-muted">{closedReason(r)}</span> : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
