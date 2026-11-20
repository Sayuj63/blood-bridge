import type { OutcomeSummary } from "../../../../shared/forecast";

const METRICS = [
  { key: "expectedWaste", label: "Units expiring unused" },
  { key: "shortfall", label: "Forecast shortfall" },
] as const;

/** City-wide outcome now vs. with every suggested transfer applied (72h horizon). */
export function OutcomeMeter({ before, after }: { before: OutcomeSummary; after: OutcomeSummary }) {
  return (
    <figure className="rounded-(--radius-control) border border-line bg-surface-2/60 p-3">
      <figcaption className="font-label text-2xs text-ink-faint uppercase">If every suggestion is approved · city, next 72h</figcaption>
      <dl className="mt-2 grid gap-3 sm:grid-cols-2">
        {METRICS.map(({ key, label }) => {
          const b = before[key];
          const a = after[key];
          const max = Math.max(b, a, 1);
          return (
            <div key={key}>
              <dt className="flex items-baseline justify-between text-xs text-ink-muted">
                {label}
                <span className="font-numeric text-sm text-ink">
                  <span className="text-ink-faint line-through">{b}</span> → <strong className="text-ok">{a}</strong>
                </span>
              </dt>
              <dd className="mt-1.5 space-y-1" aria-label={`${label}: ${b} now, ${a} after transfers`}>
                <Bar value={b} max={max} className="bg-line-strong" />
                <Bar value={a} max={max} className="bg-ok" />
              </dd>
            </div>
          );
        })}
      </dl>
    </figure>
  );
}

function Bar({ value, max, className }: { value: number; max: number; className: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
      <div className={`h-full rounded-full transition-[width] duration-(--duration-slow) ${className}`} style={{ width: `${(value / max) * 100}%` }} />
    </div>
  );
}
