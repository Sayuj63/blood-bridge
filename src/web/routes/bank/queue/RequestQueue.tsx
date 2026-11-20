import { CircleCheck, Inbox } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { QueueItemDTO } from "../../../../shared/api";
import { COMPONENT_SHORT } from "../../../../shared/domain";
import { Badge } from "../../../components/ui/Badge";
import { EmptyState, ErrorState } from "../../../components/ui/EmptyState";
import { SkeletonRows } from "../../../components/ui/Skeleton";
import { useQueue } from "../hooks";
import { QueueCard } from "./QueueCard";
import { isOpen, sortQueue } from "./status";
import { useArrivals } from "./useArrivals";

/** The live incoming-requests queue: the bank's main job. Key by site id so arrivals reset per bank. */
export function RequestQueue({ siteId }: { siteId: string }) {
  const queue = useQueue(siteId);
  const items = queue.data ? sortQueue(queue.data) : undefined;
  const fresh = useArrivals(items?.map((i) => i.reservation.id));
  const open = items?.filter(isOpen) ?? [];
  const closed = items?.filter((i) => !isOpen(i)) ?? [];
  const awaiting = open.filter((i) => i.reservation.status === "requested").length;
  const latest = open.find((i) => fresh.has(i.reservation.id));

  return (
    <section aria-labelledby="queue-title" className="flex min-h-0 flex-col rounded-(--radius-panel) border border-line bg-surface shadow-panel">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Inbox className="size-4 text-ink-muted" aria-hidden />
        <h2 id="queue-title" className="font-semibold">
          Incoming requests
        </h2>
        {awaiting > 0 ? (
          <Badge tone="warn" size="sm" className="font-numeric">
            {awaiting} to confirm
          </Badge>
        ) : null}
        <span className="ml-auto text-xs text-ink-faint">Critical first</span>
      </header>

      <p className="sr-only" aria-live="assertive">
        {latest ? `New ${latest.request.urgency} request: ${latest.reservation.unitsCount} ${latest.request.bloodGroup} ${COMPONENT_SHORT[latest.request.component]} for ${latest.hospital.name}` : ""}
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto p-3" aria-busy={queue.isPending}>
        {queue.isPending ? <SkeletonRows rows={3} /> : null}
        {queue.isError ? <ErrorState compact what="the request queue" error={queue.error} onRetry={() => void queue.refetch()} /> : null}
        {items && open.length === 0 ? (
          <EmptyState compact icon={<CircleCheck className="text-ok" />} title="All clear: no pending requests" description="New hospital requests appear here the moment they reserve your stock." />
        ) : null}
        <QueueList items={open} fresh={fresh} />
        {closed.length > 0 ? (
          <>
            <h3 className="mt-4 mb-2 font-label text-2xs text-ink-faint uppercase">Recently closed · last 30 min</h3>
            <QueueList items={closed} fresh={fresh} />
          </>
        ) : null}
      </div>
    </section>
  );
}

function QueueList({ items, fresh }: { items: QueueItemDTO[]; fresh: ReadonlySet<string> }) {
  const reduce = useReducedMotion();
  return (
    <ul className="space-y-3">
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <motion.li
            key={item.reservation.id}
            layout={!reduce}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
          >
            <QueueCard item={item} fresh={fresh.has(item.reservation.id)} />
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
