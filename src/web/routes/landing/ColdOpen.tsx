import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { MessageCircle, PhoneOff, PhoneOutgoing } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { heroStat } from "./stats";

interface LogLine {
  /** Minutes past 2am. */
  minute: number;
  icon: ReactNode;
  who: string;
  said: string;
}

const LOG: LogLine[] = [
  { minute: 7, icon: <PhoneOutgoing aria-hidden />, who: "Blood bank, Parel", said: "Rings out. No answer." },
  { minute: 12, icon: <PhoneOutgoing aria-hidden />, who: "Blood bank, Dadar", said: "“We have O-positive. Not O-negative.”" },
  { minute: 19, icon: <PhoneOff aria-hidden />, who: "Blood bank, Sion", said: "“The register is updated in the morning. Call back.”" },
  {
    minute: 26,
    icon: <MessageCircle aria-hidden />,
    who: "Family WhatsApp group",
    said: "URGENT. O-ve platelets needed tonight. Please forward to everyone.",
  },
  { minute: 38, icon: <PhoneOutgoing aria-hidden />, who: "Blood bank, Bandra", said: "“Maybe. Come and check.” It's 40 minutes away." },
];

const START_MINUTE = 8;
const END_MINUTE = 44;

const banks = heroStat("mumbaibanks");

const clock = (minute: number) => `02:${String(Math.floor(minute)).padStart(2, "0")}`;

/**
 * Cold open: 2am, a family phoning blood banks. The clock and the call log
 * advance with scroll while the headline holds the frame.
 */
export function ColdOpen() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion() ?? false;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const minute = useTransform(scrollYProgress, [0, 0.85], [START_MINUTE, END_MINUTE], { clamp: true });
  const clockText = useTransform(minute, clock);
  const cueOpacity = useTransform(scrollYProgress, [0, 0.08], [1, 0]);

  return (
    <section ref={ref} aria-labelledby="cold-open-title" className={reduced ? "relative" : "relative h-[260vh]"}>
      <div className={reduced ? "" : "sticky top-0 h-dvh overflow-hidden"}>
        <div className="mx-auto grid h-full max-w-7xl content-center gap-8 px-4 pt-20 pb-10 sm:px-8 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
          <div className="min-w-0">
            <p className="font-numeric text-sm text-ink-muted">
              <motion.span className="inline-block font-semibold text-accent">{reduced ? clock(END_MINUTE) : clockText}</motion.span>
              <span aria-hidden> · </span>Trauma ward, Sion
            </p>
            <h1 id="cold-open-title" className="mt-4 font-display text-[clamp(2.1rem,1.1rem+4vw,4.9rem)] leading-[0.98] text-balance">
              <span className="block font-medium [font-stretch:100%]">A patient needs O-negative platelets now.</span>
              <span className="mt-3 block">
                {banks.value} blood banks.
                <a
                  href={banks.url}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-1 align-super font-sans text-[0.25em] font-medium text-ink-faint underline decoration-dotted [font-stretch:100%] hover:text-ink-muted"
                  aria-label={`Source: ${banks.source}`}
                >
                  source
                </a>
              </span>
              <span className="block">Zero shared view.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base text-ink-muted sm:text-lg">
              Every one of Mumbai's blood banks keeps its own stock register, and none of them can take a reservation from the others. When it matters most, the only way to search them is a
              phone and a lot of luck.
            </p>
          </div>

          <div className="min-w-0">
            <div className="rounded-(--radius-panel) border border-line bg-surface/70 p-4 backdrop-blur sm:p-5" aria-label="Call log, 2am">
              <div className="flex items-baseline justify-between border-b border-line pb-3">
                <span className="font-label text-sm text-ink-muted">Calls from one phone</span>
                <motion.span
                  className="font-display text-4xl tabular-nums text-ink sm:text-5xl"
                  aria-hidden
                >
                  {reduced ? clock(END_MINUTE) : clockText}
                </motion.span>
              </div>
              <ol className="mt-3 space-y-2.5">
                {LOG.map((line) => (
                  <LogItem key={line.minute} line={line} minute={minute} reduced={reduced} />
                ))}
              </ol>
            </div>
            <p className="mt-2 text-xs text-ink-faint">Dramatised scenario.</p>
          </div>
        </div>

        {reduced ? null : (
          <motion.div
            style={{ opacity: cueOpacity }}
            className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center text-xs text-ink-faint"
            aria-hidden
          >
            <span className="flex flex-col items-center gap-2">
              Scroll to follow the night
              <span className="h-8 w-px bg-gradient-to-b from-ink-faint to-transparent" />
            </span>
          </motion.div>
        )}
      </div>
    </section>
  );
}

function LogItem({ line, minute, reduced }: { line: LogLine; minute: MotionValue<number>; reduced: boolean }) {
  const opacity = useTransform(minute, [line.minute - 2, line.minute], [0, 1]);
  const y = useTransform(minute, [line.minute - 2, line.minute], [14, 0]);
  const whatsapp = line.who.includes("WhatsApp");
  return (
    <motion.li
      style={reduced ? undefined : { opacity, y }}
      className="flex gap-3 rounded-(--radius-control) bg-surface-2/70 px-3 py-2.5"
    >
      <span className={`mt-0.5 shrink-0 [&_svg]:size-4 ${whatsapp ? "text-ok" : "text-ink-faint"}`}>{line.icon}</span>
      <span className="min-w-0">
        <span className="flex items-baseline gap-2">
          <span className="font-numeric text-xs text-ink-faint">{clock(line.minute)}</span>
          <span className="font-label text-sm text-ink">{line.who}</span>
        </span>
        <span className="mt-0.5 block text-sm text-ink-muted">{line.said}</span>
      </span>
    </motion.li>
  );
}
