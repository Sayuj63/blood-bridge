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
 * 5-stage visual stepper: Requested → Bank confirmed → Reserved → Picked up → Delivered,
 * with IST timestamps. Horizontal when there is room, vertical in narrow containers.
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
            {i < steps.length - 1 ? (
              <span
                aria-hidden
                className="absolute top-7 bottom-0 left-[0.875rem] w-0.5 bg-[#EAE6E3] @lg:top-[0.875rem] @lg:right-[-50%] @lg:bottom-auto @lg:left-1/2 @lg:h-0.5 @lg:w-auto"
              >
                <motion.span
                  className="block size-full origin-top bg-[#15803D] @lg:origin-left"
                  initial={false}
                  animate={{ scale: steps[i + 1].at !== null ? 1 : 0 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                />
              </span>
            ) : null}
            <span
              aria-hidden
              className={cn(
                "relative z-10 grid size-7 shrink-0 place-items-center rounded-full border-2 transition-colors",
                done && "border-[#15803D] bg-[#15803D] text-white",
                isCurrent && "border-[#C93245] bg-white text-[#C93245]",
                !done && !isCurrent && "border-[#D6CFC9] bg-white text-[#8A8580]",
              )}
            >
              {done ? (
                <Check className="size-3.5" strokeWidth={3} />
              ) : isCurrent ? (
                <span className="size-2 rounded-full bg-[#C93245]" />
              ) : (
                <span className="h-num text-[11px] font-semibold">{i + 1}</span>
              )}
            </span>
            <span className="min-w-0 pt-0.5 @lg:pt-0">
              <span className={cn("block text-xs font-semibold", done || isCurrent ? "text-[#171717]" : "text-[#737373]")}>
                {STEP_LABEL[s.step]}
              </span>
              <span className="h-num block text-[11px] text-[#737373]">
                {s.at !== null ? formatIST(s.at, true) : isCurrent ? "In progress" : "Pending"}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
