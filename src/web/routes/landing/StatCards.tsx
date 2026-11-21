import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { CountUp } from "./CountUp";
import { heroStat } from "./stats";

const ease = [0.16, 1, 0.3, 1] as const;

/** Four headline figures, each told by a picture instead of a sentence. Sources stay one tap away. */
export function StatCards() {
  return (
    <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card statKey="gap" value="~1M" label="units short, every year" visual={<GapBar />} index={0} />
      <Card statKey="discarded5y" value="28 lakh" label="units thrown away in 5 years" visual={<DropGrid />} index={1} />
      <Card statKey="expiry" value="97%" label="of discards at a Chennai hospital had expired" visual={<ExpiryRing />} index={2} />
      <Card statKey="mumbaibanks" value="58" label="Mumbai blood banks. No shared booking." visual={<IslandDots />} index={3} />
    </div>
  );
}

function Card({ statKey, value, label, visual, index }: { statKey: string; value: string; label: string; visual: ReactNode; index: number }) {
  const reduced = useReducedMotion();
  const s = heroStat(statKey);
  return (
    <motion.figure
      initial={reduced ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.7, delay: index * 0.09, ease }}
      className="flex flex-col rounded-[22px] border border-line bg-surface-2 p-5"
    >
      <div className="grid h-32 place-items-center">{visual}</div>
      <figcaption className="mt-4">
        <span className="block font-display text-[clamp(2.2rem,1.6rem+1.6vw,3.2rem)] leading-none font-bold text-accent tabular-nums">
          <CountUp value={value} />
        </span>
        <span className="mt-2 block text-[15px] leading-snug text-ink">{label}</span>
      </figcaption>
      <a
        href={s.url}
        target="_blank"
        rel="noreferrer"
        title={s.source}
        className="mt-auto self-start pt-4 text-[11px] text-ink-faint underline decoration-dotted underline-offset-2 hover:text-ink-muted"
      >
        Source ↗<span className="sr-only">: {s.source}</span>
      </a>
    </motion.figure>
  );
}

/** India's yearly need as one bar: 93% met, the missing slice is the shortfall (Mammen et al. 2022). */
function GapBar() {
  const reduced = useReducedMotion();
  return (
    <div className="w-full" role="img" aria-label="Supply meets about 93 percent of India's yearly need; the remaining 7 percent, about one million units, is missing">
      <div className="flex justify-between text-[11px] text-ink-muted">
        <span>Yearly need</span>
        <span className="font-semibold text-accent">~1M short</span>
      </div>
      <div className="relative mt-2 h-9 overflow-hidden rounded-full bg-[repeating-linear-gradient(135deg,var(--color-line)_0_6px,transparent_6px_12px)] ring-1 ring-line">
        <motion.div
          className="h-full origin-left rounded-full bg-accent"
          style={{ width: "93%" }}
          initial={reduced ? false : { scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true, amount: 0.8 }}
          transition={{ duration: 1.2, ease }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-ink-muted">
        <span>93% supplied</span>
        <span>7% gap</span>
      </div>
    </div>
  );
}

function Drop({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 16" className={className} aria-hidden="true">
      <path d="M6 0.5 C6 0.5 0.8 6.6 0.8 10.2 A5.2 5.2 0 0 0 11.2 10.2 C11.2 6.6 6 0.5 6 0.5 Z" fill="currentColor" />
    </svg>
  );
}

/** 28 drops, one per lakh units discarded. */
function DropGrid() {
  const reduced = useReducedMotion();
  return (
    <div role="img" aria-label="28 drops, each one lakh units discarded" className="flex flex-col items-center gap-2">
      <div className="grid grid-cols-7 gap-x-2 gap-y-1.5 text-accent">
        {Array.from({ length: 28 }, (_, i) => (
          <motion.span
            key={i}
            initial={reduced ? false : { opacity: 0, y: -10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.35, delay: i * 0.035, ease }}
          >
            <Drop className="h-5 w-4" />
          </motion.span>
        ))}
      </div>
      <span className="text-[11px] text-ink-muted">each drop = 1 lakh units</span>
    </div>
  );
}

/** A ring that fills to 97%. */
function ExpiryRing() {
  const reduced = useReducedMotion();
  const r = 46;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 120 120" className="size-32 -rotate-90" role="img" aria-label="97 percent of discarded units had expired">
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--color-line)" strokeWidth="14" />
      <motion.circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="14"
        strokeDasharray={c}
        initial={reduced ? { strokeDashoffset: c * 0.03 } : { strokeDashoffset: c }}
        whileInView={{ strokeDashoffset: c * 0.03 }}
        viewport={{ once: true, amount: 0.8 }}
        transition={{ duration: 1.4, ease }}
      />
      <g className="rotate-90 origin-center">
        <text x="60" y="58" textAnchor="middle" className="fill-ink-muted text-[11px]">
          expired
        </text>
        <text x="60" y="74" textAnchor="middle" className="fill-ink-muted text-[11px]">
          unused
        </text>
      </g>
    </svg>
  );
}

/** 58 isolated dots: every bank on its own island, nothing connecting them. */
function IslandDots() {
  const reduced = useReducedMotion();
  // Deterministic scatter (golden-angle spiral, jittered) so the layout is stable across renders.
  const dots = Array.from({ length: 58 }, (_, i) => {
    const a = i * 2.39996;
    const rad = 7 + Math.sqrt(i / 58) * 50;
    return { x: 100 + Math.cos(a) * rad * 1.6, y: 62 + Math.sin(a) * rad * 0.95 };
  });
  return (
    <svg viewBox="0 0 200 124" className="h-32 w-full" role="img" aria-label="58 dots, one per Mumbai blood bank, none connected">
      {dots.map((d, i) => (
        <motion.circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={i % 9 === 0 ? 4.2 : 3.2}
          fill={i % 9 === 0 ? "var(--color-accent)" : "var(--color-accent-hover)"}
          opacity={i % 9 === 0 ? 1 : 0.55}
          initial={reduced ? false : { scale: 0 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.3, delay: i * 0.015 }}
        />
      ))}
    </svg>
  );
}
