import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { Check, CornerUpRight } from "lucide-react";
import { useRef, useState } from "react";

/** Illustrative WhatsApp reconstruction. Minutes after 2:00am. */
const CHAT: { at: number; from: string; text: string; forwarded?: boolean }[] = [
  { at: 10, from: "Priya", text: "URGENT 🙏 O-ve platelets needed at Sion hospital tonight. Please forward." },
  { at: 34, from: "Rahul", text: "URGENT 🙏 O-ve platelets needed at Sion hospital tonight. Please forward.", forwarded: true },
  { at: 52, from: "Aunty", text: "Try the blood bank near Dadar station, my friend knows someone" },
  { at: 81, from: "Priya", text: "Called. Wrong number." },
  { at: 104, from: "Unknown", text: "Is this still needed or already arranged?" },
  { at: 139, from: "Rahul", text: "Someone said Thane has some. Call after 9am." },
  { at: 186, from: "Priya", text: "Still searching. Please keep sharing." },
];

/** Blood Bridge doing the same job. Seconds from the first tap. */
const FLOW: { at: number; text: string }[] = [
  { at: 0, text: "Nurse picks O−, platelets, 2 units, critical" },
  { at: 8, text: "Compatible, in-date units across the city, ranked" },
  { at: 15, text: "One tap: reserve at the best-ranked bank" },
  { at: 29, text: "Bank confirms the hold" },
  { at: 41, text: "Reserved. Courier dispatched." },
];

const CHAT_END = 190;
const FLOW_END = 41;

const chatClock = (m: number) => {
  const h = 2 + Math.floor(m / 60);
  return `${String(h).padStart(2, "0")}:${String(Math.floor(m % 60)).padStart(2, "0")}`;
};
const flowClock = (s: number) => `0:${String(Math.floor(s)).padStart(2, "0")}`;

/**
 * Replay the scramble: the same request, side by side. Left, a WhatsApp chain
 * whose clock races through hours. Right, Blood Bridge finishing in seconds.
 * Both advance with scroll.
 */
export function ScrambleReplay() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion() ?? false;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const chatMinute = useTransform(scrollYProgress, [0.05, 0.9], [0, CHAT_END], { clamp: true });
  const flowSecond = useTransform(scrollYProgress, [0.05, 0.55], [0, FLOW_END], { clamp: true });
  const chatText = useTransform(chatMinute, chatClock);
  const flowText = useTransform(flowSecond, flowClock);
  // Chat messages are added (not faded) so the newest sits at the bottom, like a real chat.
  const [shown, setShown] = useState(reduced ? CHAT.length : 1);
  useMotionValueEvent(chatMinute, "change", (m) => {
    const n = Math.max(1, CHAT.filter((c) => c.at <= m).length);
    if (n !== shown) setShown(n);
  });

  return (
    <section ref={ref} aria-labelledby="replay-title" className={reduced ? "relative" : "relative h-[240vh]"}>
      <div className={reduced ? "py-24" : "sticky top-0 flex h-dvh flex-col justify-center overflow-hidden py-16"}>
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-8">
          <h2 id="replay-title" className="max-w-3xl font-display text-[clamp(1.7rem,1rem+2.4vw,3.2rem)] leading-[1.02] text-balance">
            Replay the same night.
          </h2>
          <div className="mt-6 grid items-start gap-4 md:grid-cols-2 md:gap-6">
            <div className="flex min-h-0 flex-col rounded-(--radius-panel) border border-line bg-[#0b141a] p-3 sm:p-4">
              <div className="flex items-baseline justify-between border-b border-white/10 pb-2">
                <span className="font-label text-sm text-[#d1d7db]">Family group chat</span>
                <motion.span className="font-display text-3xl tabular-nums text-[#d1d7db] sm:text-4xl" aria-hidden>
                  {reduced ? chatClock(CHAT_END) : chatText}
                </motion.span>
              </div>
              <ol className="mt-3 flex h-[min(24rem,34dvh)] flex-col justify-end gap-2 overflow-hidden" aria-live="off">
                {CHAT.slice(0, reduced ? CHAT.length : shown).map((m) => (
                  <Bubble key={m.at} msg={m} reduced={reduced} />
                ))}
              </ol>
              <p className="mt-auto pt-3 text-2xs text-[#8696a0]">Illustrative reconstruction, not a real chat.</p>
            </div>

            <div className="flex flex-col rounded-(--radius-panel) border border-bridge/40 bg-surface p-3 sm:p-4">
              <div className="flex items-baseline justify-between border-b border-line pb-2">
                <span className="font-label text-sm text-ink-muted">Blood Bridge, hospital view</span>
                <motion.span className="font-display text-3xl tabular-nums text-bridge sm:text-4xl" aria-hidden>
                  {reduced ? flowClock(FLOW_END) : flowText}
                </motion.span>
              </div>
              <ol className="mt-3 space-y-2">
                {FLOW.map((s) => (
                  <FlowStep key={s.at} step={s} second={flowSecond} reduced={reduced} />
                ))}
              </ol>
              <p className="mt-auto pt-3 text-2xs text-ink-faint">Target timings for the live demo flow.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Bubble({ msg, reduced }: { msg: (typeof CHAT)[number]; reduced: boolean }) {
  return (
    <motion.li
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="max-w-[88%] shrink-0 rounded-lg rounded-tl-none bg-[#202c33] px-3 py-1.5"
    >
      <span className="block text-xs font-semibold text-[#53bdeb]">{msg.from}</span>
      {msg.forwarded ? (
        <span className="flex items-center gap-1 text-2xs text-[#8696a0] italic">
          <CornerUpRight className="size-3" aria-hidden /> Forwarded
        </span>
      ) : null}
      <span className="block text-sm text-[#e9edef]">{msg.text}</span>
      <span className="block text-right font-numeric text-2xs text-[#8696a0]">{chatClock(msg.at)}</span>
    </motion.li>
  );
}

function FlowStep({ step, second, reduced }: { step: (typeof FLOW)[number]; second: MotionValue<number>; reduced: boolean }) {
  const opacity = useTransform(second, [step.at - 3, step.at], [0.25, 1]);
  const scale = useTransform(second, [step.at - 3, step.at], [0.6, 1]);
  const last = step.at === FLOW_END;
  return (
    <motion.li style={reduced ? undefined : { opacity }} className="flex items-center gap-3 rounded-(--radius-control) bg-surface-2/70 px-3 py-2.5">
      <motion.span
        style={reduced ? undefined : { scale }}
        className={`grid size-6 shrink-0 place-items-center rounded-full ${last ? "bg-bridge text-[#03201d]" : "bg-surface-3 text-bridge"}`}
      >
        <Check className="size-3.5" aria-hidden />
      </motion.span>
      <span className={`text-sm ${last ? "font-semibold text-ink" : "text-ink-muted"}`}>{step.text}</span>
      <span className="ml-auto font-numeric text-xs text-ink-faint">{flowClock(step.at)}</span>
    </motion.li>
  );
}
