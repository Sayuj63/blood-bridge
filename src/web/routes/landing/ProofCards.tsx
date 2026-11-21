import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { SNAPSHOT_FACTS, updateAgesHours } from "./data";
import { SION, SNAPSHOT_SOURCE } from "./stats";

const ease = [0.16, 1, 0.3, 1] as const;
const fmt = new Intl.NumberFormat("en-IN");

/** Two local proofs under the headline figures: Sion's thalassemia gap and the directory's stale clock. */
export function ProofCards() {
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <ProofCard
        index={0}
        title="Sion Hospital, 2025"
        line="Camps couldn't cover even one disease: thalassemia."
        source={SION.source}
        url={SION.url}
        visual={<SionBags />}
      />
      <ProofCard
        index={1}
        title="The directory is hours behind"
        line={`When each of ${SNAPSHOT_FACTS.centres} Mumbai centres last updated e-RaktKosh.`}
        source={SNAPSHOT_SOURCE.source}
        url={SNAPSHOT_SOURCE.url}
        visual={<StaleClock />}
      />
    </div>
  );
}

function ProofCard({ title, line, source, url, visual, index }: { title: string; line: string; source: string; url: string; visual: ReactNode; index: number }) {
  const reduced = useReducedMotion();
  return (
    <motion.figure
      initial={reduced ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={{ duration: 0.7, delay: index * 0.1, ease }}
      className="flex flex-col rounded-[22px] border border-line bg-surface-2 p-6"
    >
      <figcaption>
        <span className="block font-display text-[clamp(1.4rem,1.1rem+0.8vw,1.9rem)] leading-tight font-bold text-ink">{title}</span>
        <span className="mt-1 block text-[15px] text-ink-muted">{line}</span>
      </figcaption>
      <div className="mt-6 flex flex-1 items-center justify-center">{visual}</div>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        title={source}
        className="mt-5 self-start text-[11px] text-ink-faint underline decoration-dotted underline-offset-2 hover:text-ink-muted"
      >
        Source ↗<span className="sr-only">: {source}</span>
      </a>
    </motion.figure>
  );
}

/** A blood bag whose fill level animates up to `level` (0–1). */
function Bag({ level, label, value, muted }: { level: number; label: string; value: number; muted?: boolean }) {
  const reduced = useReducedMotion();
  const inner = { x: 14, y: 30, w: 72, h: 96 };
  const fillH = inner.h * level;
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 140" className="h-40 w-auto" aria-hidden="true">
        <defs>
          <clipPath id={`bag-${label}`}>
            <rect x={inner.x} y={inner.y} width={inner.w} height={inner.h} rx="16" />
          </clipPath>
        </defs>
        <path d="M50 2 L50 18" stroke="var(--bb-accent)" strokeWidth="4" strokeLinecap="round" />
        <rect x="38" y="14" width="24" height="12" rx="4" fill="var(--bb-accent-hover)" />
        <rect x={inner.x} y={inner.y} width={inner.w} height={inner.h} rx="16" fill="var(--bb-surface)" stroke="var(--bb-line)" strokeWidth="3" />
        <g clipPath={`url(#bag-${label})`}>
          {/* Motion maps `y` on SVG to a transform, so the fill rises by scaling from its bottom edge. */}
          <motion.rect
            x={inner.x}
            y={inner.y + inner.h - fillH}
            width={inner.w}
            height={fillH}
            fill={muted ? "var(--bb-ink-muted)" : "var(--bb-accent)"}
            style={{ transformBox: "fill-box", transformOrigin: "bottom" }}
            initial={reduced ? false : { scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true, amount: 0.7 }}
            transition={{ duration: 1.3, ease }}
          />
        </g>
        <rect x={inner.x + 8} y={inner.y + 10} width="7" height="58" rx="3.5" fill="#FFFFFF" opacity="0.35" />
      </svg>
      <span className="mt-2 font-display text-2xl font-bold tabular-nums text-ink">{fmt.format(value)}</span>
      <span className="text-[13px] text-ink-muted">{label}</span>
    </div>
  );
}

/** Needed vs collected, as two bags; the missing bags are called out. */
function SionBags() {
  const gap = SION.needed - SION.collected;
  return (
    <div className="flex items-end gap-6 sm:gap-10" role="img" aria-label={`Needed ${fmt.format(SION.needed)} bags for thalassemia; camps collected ${fmt.format(SION.collected)}; ${fmt.format(gap)} short`}>
      <Bag level={1} label="needed" value={SION.needed} muted />
      <Bag level={SION.collected / SION.needed} label="collected" value={SION.collected} />
      <div className="mb-14 rounded-full bg-accent px-3.5 py-1.5 text-center text-[13px] font-semibold text-accent-ink">
        −{fmt.format(gap)} bags
      </div>
    </div>
  );
}

/** A 24-hour dial: each dot is one centre, placed by how old its last update was. */
function StaleClock() {
  const reduced = useReducedMotion();
  const { min, max } = SNAPSHOT_FACTS.updateAgeHours;
  const R = 78;
  const at = (h: number, r = R) => {
    const a = (h / 24) * 2 * Math.PI - Math.PI / 2;
    return { x: 100 + Math.cos(a) * r, y: 100 + Math.sin(a) * r };
  };
  const arcStart = at(min);
  const arcEnd = at(max);
  const largeArc = max - min > 12 ? 1 : 0;
  return (
    <svg viewBox="0 0 200 200" className="h-52 w-52" role="img" aria-label={`Data ages between ${min} and ${max} hours; each dot is one blood centre`}>
      <circle cx="100" cy="100" r={R} fill="var(--bb-surface)" stroke="var(--bb-line)" strokeWidth="10" />
      <motion.path
        d={`M${arcStart.x} ${arcStart.y} A${R} ${R} 0 ${largeArc} 1 ${arcEnd.x} ${arcEnd.y}`}
        fill="none"
        stroke="var(--bb-accent)"
        strokeWidth="10"
        strokeLinecap="round"
        opacity="0.25"
        initial={reduced ? false : { pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, amount: 0.7 }}
        transition={{ duration: 1.2, ease }}
      />
      {[0, 6, 12, 18].map((h) => {
        const p = at(h, R - 20);
        return (
          <text key={h} x={p.x} y={p.y + 3.5} textAnchor="middle" className="fill-ink-faint text-[10px]">
            {h === 0 ? "now" : `${h}h`}
          </text>
        );
      })}
      {updateAgesHours.map((h, i) => {
        const p = at(Math.min(h, 23.9));
        return (
          <motion.circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="4.5"
            fill="var(--bb-accent)"
            stroke="var(--bb-surface)"
            strokeWidth="1.5"
            initial={reduced ? false : { scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true, amount: 0.7 }}
            transition={{ duration: 0.3, delay: 0.4 + i * 0.03 }}
          />
        );
      })}
      <text x="100" y="98" textAnchor="middle" className="fill-ink font-display text-[26px] font-bold">
        {min}–{max}h
      </text>
      <text x="100" y="116" textAnchor="middle" className="fill-ink-muted text-[11px]">
        old data
      </text>
    </svg>
  );
}
