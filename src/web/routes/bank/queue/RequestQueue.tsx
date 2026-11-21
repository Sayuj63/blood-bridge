import { CircleCheck, Inbox } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { QueueItemDTO } from "../../../../shared/api";
import { COMPONENT_SHORT } from "../../../../shared/domain";
import { ErrorState } from "../../../components/ui/EmptyState";
import { SkeletonRows } from "../../../components/ui/Skeleton";
import { useQueue } from "../hooks";
import { QueueCard } from "./QueueCard";
import { isOpen, sortQueue } from "./status";
import { useArrivals } from "./useArrivals";

/** The live incoming-requests queue: pinned on the right of the Blood Bank desk. */
export function RequestQueue({ siteId }: { siteId: string }) {
  const queue = useQueue(siteId);
  const items = queue.data ? sortQueue(queue.data) : undefined;
  const fresh = useArrivals(items?.map((i) => i.reservation.id));
  const open = items?.filter(isOpen) ?? [];
  const closed = items?.filter((i) => !isOpen(i)) ?? [];
  const awaiting = open.filter((i) => i.reservation.status === "requested").length;
  const latest = open.find((i) => fresh.has(i.reservation.id));

  return (
    <section aria-labelledby="queue-title" className="b-card flex min-h-0 flex-col overflow-hidden">
      <header className="flex items-center gap-2.5 border-b border-[#EAE6E3] bg-[#FFF5F5]/70 px-4 py-3.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#FCEBED] text-[#C93245]">
          <Inbox className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 id="queue-title" className="b-display text-sm font-bold text-[#171717]">
              Incoming requests
            </h2>
            {awaiting > 0 ? (
              <span className="b-num rounded-full bg-[#C93245] px-2 py-0.5 text-[10px] font-bold text-white">
                {awaiting} pending
              </span>
            ) : null}
          </div>
          <p className="text-[11px] text-[#737373]">Live hospital reservations · critical first</p>
        </div>
      </header>

      <p className="sr-only" aria-live="assertive">
        {latest
          ? `New ${latest.request.urgency} request: ${latest.reservation.unitsCount} ${latest.request.bloodGroup} ${COMPONENT_SHORT[latest.request.component]} for ${latest.hospital.name}`
          : ""}
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto p-3.5" aria-busy={queue.isPending}>
        {queue.isPending ? <SkeletonRows rows={3} /> : null}
        {queue.isError ? <ErrorState compact what="the request queue" error={queue.error} onRetry={() => void queue.refetch()} /> : null}
        {items && open.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl bg-[#FAF9F6] px-4 py-8 text-center">
            <span className="grid size-11 place-items-center rounded-2xl bg-[#ECFDF3] text-[#1F7A4D]">
              <CircleCheck className="size-5" aria-hidden />
            </span>
            <p className="b-display mt-3 text-sm font-bold text-[#171717]">All clear: no pending requests</p>
            <p className="mt-1 max-w-[16rem] text-xs leading-relaxed text-[#737373]">
              New hospital reservations appear here the moment stock is held.
            </p>
          </div>
        ) : null}
        <QueueList items={open} fresh={fresh} />
        {closed.length > 0 ? (
          <>
            <h3 className="mt-4 mb-2 text-[10px] font-bold tracking-wider text-[#737373] uppercase">Recently closed · last 30 min</h3>
            <QueueList items={closed} fresh={fresh} />
          </>
        ) : null}
      </div>
    </section>
  );
}

function QueueList({ items, fresh }: { items: QueueItemDTO[]; fresh: ReadonlySet<string> }) {
  const reduce = useReducedMotion();
  if (items.length === 0) return null;
  return (
    <ul className="space-y-3">
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <motion.li
            key={item.reservation.id}
            layout={!reduce}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -14, scale: 0.97 }}
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
