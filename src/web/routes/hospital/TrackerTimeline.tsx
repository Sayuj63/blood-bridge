import { Check } from "lucide-react";
import { motion } from "motion/react";
import type { TimelineStep } from "../../../shared/api";
import { cn } from "../../lib/cn";
import { formatIST } from "../../lib/format";

const STEP_LABEL: Record<TimelineStep["step"], string> = {
  requested: "Requested",
  confirmed: "Bank confirmed",
  reserved: "Reserved",
  picked_up: "Picked up",
  delivered: "Delivered",
};

/**
 * Requested → Bank confirmed → Reserved → Picked up → Delivered, with the IST time
 * each step happened. Horizontal when there is room, vertical in narrow panels.
 */
export function TrackerTimeline({ steps }: { steps: TimelineStep[] }) {
  const current = steps.findIndex((s) => s.at === null);

  return (
    <ol className="grid gap-0 @lg:grid-cols-5" aria-label="Reservation progress">
      {steps.map((s, i) => {
        const done = s.at !== null;
        const isCurrent = i === current;
        return (
          <li
            key={s.step}
            aria-current={isCurrent ? "step" : undefined}
            className="relative flex gap-3 pb-4 last:pb-0 @lg:flex-col @lg:items-center @lg:gap-2 @lg:pb-0 @lg:text-center"
          >
            {/* Connector to the next step: vertical in narrow layouts, horizontal when wide. */}
            {i < steps.length - 1 ? (
              <span aria-hidden className="absolute top-8 bottom-0 left-[0.9375rem] w-0.5 bg-line @lg:top-[0.9375rem] @lg:right-[-50%] @lg:bottom-auto @lg:left-1/2 @lg:h-0.5 @lg:w-auto">
                <motion.span
                  className="block size-full origin-top bg-ok @lg:origin-left"
                  initial={false}
                  animate={{ scale: steps[i + 1].at !== null ? 1 : 0 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                />
              </span>
            ) : null}
            <span
              aria-hidden
              className={cn(
                "relative z-10 grid size-8 shrink-0 place-items-center rounded-full border-2 transition-colors duration-(--duration-base)",
                done && "border-ok bg-ok text-white",
                isCurrent && "border-accent bg-surface text-accent",
                !done && !isCurrent && "border-line bg-surface text-ink-faint",
              )}
            >
              {done ? (
                <motion.span initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 22 }}>
                  <Check className="size-4" strokeWidth={3} />
                </motion.span>
              ) : isCurrent ? (
                <>
                  <span className="absolute inset-0 animate-pulse-ring rounded-full bg-accent/40" />
                  <span className="size-2.5 rounded-full bg-accent" />
                </>
              ) : (
                <span className="font-numeric text-xs font-bold">{i + 1}</span>
              )}
            </span>
            <span className="min-w-0 pt-1 @lg:pt-0">
              <span className={cn("block text-sm font-semibold", !done && !isCurrent && "text-ink-muted")}>{STEP_LABEL[s.step]}</span>
              <span className="block font-numeric text-xs text-ink-muted">
                {s.at !== null ? formatIST(s.at, true) : isCurrent ? "In progress" : "Pending"}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
