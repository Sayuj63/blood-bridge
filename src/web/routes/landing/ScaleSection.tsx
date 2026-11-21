import { motion, useReducedMotion } from "motion/react";
import { SNAPSHOT_FACTS, updateAgesHours } from "./data";
import { SourceNote } from "./SourceNote";
import { StatCards } from "./StatCards";
import { SION, SNAPSHOT_SOURCE } from "./stats";

const ease = [0.16, 1, 0.3, 1] as const;
const fmt = new Intl.NumberFormat("en-IN");
const AXIS_HOURS = 24;

/** (b) The scale of the problem, every figure sourced. */
export function ScaleSection() {
  const reduced = useReducedMotion();
  return (
    <section aria-labelledby="scale-title" className="mx-auto max-w-7xl px-4 py-24 sm:px-8 sm:py-32">
      <h2 id="scale-title" className="max-w-3xl font-display text-[clamp(1.9rem,1rem+3vw,3.6rem)] leading-[1.02] text-balance">
        It isn't one unlucky night. It's how the system works.
      </h2>
      <p className="mt-5 max-w-2xl text-lg text-ink-muted">
        Blood is collected, tested and stored bank by bank. Supply and need rarely meet in the same place at the same hour.
      </p>

      <StatCards />

      <div className="mt-20 grid gap-12 lg:grid-cols-2">
        <SionBars />
        <motion.figure
          initial={reduced ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7, ease }}
          className="rounded-(--radius-panel) border border-line bg-surface p-6"
        >
          <h3 className="text-xl font-semibold">The directory can't tell you what's on the shelf right now.</h3>
          <p className="mt-3 text-ink-muted">
            India's national register, e-RaktKosh, lists stock per blood centre. When we read it for {SNAPSHOT_FACTS.centres} Mumbai
            centres, their last updates were between{" "}
            <strong className="font-numeric text-ink">{SNAPSHOT_FACTS.updateAgeHours.min}</strong> and{" "}
            <strong className="font-numeric text-ink">{SNAPSHOT_FACTS.updateAgeHours.max} hours</strong> old.
          </p>
          <div className="relative mt-8 h-10" aria-hidden>
            <div className="absolute inset-x-0 top-1/2 h-px bg-line-strong" />
            <div className="absolute top-1/2 left-0 h-3 w-px -translate-y-1/2 bg-line-strong" />
            {updateAgesHours.map((h, i) => (
              <span
                key={i}
                className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-warn"
                style={{ left: `${(h / AXIS_HOURS) * 100}%`, marginTop: `${((i % 3) - 1) * 9}px` }}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between font-numeric text-2xs text-ink-faint" aria-hidden>
            <span>updated at fetch time</span>
            <span>{AXIS_HOURS}h old</span>
          </div>
          <p className="mt-2 text-xs text-ink-muted">Each dot is one blood centre.</p>
          <SourceNote className="mt-4 block" source={SNAPSHOT_SOURCE.source} url={SNAPSHOT_SOURCE.url} />
        </motion.figure>
      </div>
    </section>
  );
}

/** Sion Hospital, 2025: two bars, collected vs needed for thalassemia alone. */
function SionBars() {
  const reduced = useReducedMotion();
  const pct = (SION.collected / SION.needed) * 100;
  return (
    <figure className="rounded-(--radius-panel) border border-line bg-surface p-6">
      <h3 className="text-xl font-semibold">At Sion Hospital, camps couldn't keep up with one disease.</h3>
      <p className="mt-3 text-ink-muted">Blood collected by camps in 2025, against bags needed for thalassemia patients alone.</p>
      <div className="mt-6 space-y-4">
        {[
          { label: "Needed for thalassemia", value: SION.needed, width: 100, tone: "bg-ink-muted" },
          { label: "Collected by camps", value: SION.collected, width: pct, tone: "bg-accent" },
        ].map((b, i) => (
          <div key={b.label}>
            <div className="flex justify-between text-sm">
              <span className="text-ink-muted">{b.label}</span>
              <span className="font-numeric font-semibold">{fmt.format(b.value)}</span>
            </div>
            <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-surface-3">
              <motion.div
                className={`h-full origin-left rounded-full ${b.tone}`}
                style={{ width: `${b.width}%` }}
                initial={reduced ? false : { scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true, amount: 0.8 }}
                transition={{ duration: 1.1, delay: i * 0.25, ease }}
              />
            </div>
          </div>
        ))}
      </div>
      <SourceNote className="mt-4 block" source={SION.source} url={SION.url} />
    </figure>
  );
}
