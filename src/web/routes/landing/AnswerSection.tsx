import { motion, useReducedMotion } from "motion/react";
import { ArrowLeftRight, ArrowRight, BellRing, Hand, MonitorSmartphone } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

interface Capability {
  icon: ReactNode;
  who: string;
  title: string;
  line: string;
  to: string;
}

const CAPABILITIES: Capability[] = [
  { icon: <MonitorSmartphone aria-hidden />, who: "Hospital", title: "One screen", line: "Every compatible unit in the city, ranked.", to: "/hospital" },
  { icon: <Hand aria-hidden />, who: "Blood bank", title: "One tap to reserve", line: "Confirm in 90 s, or it reroutes itself.", to: "/bank" },
  { icon: <ArrowLeftRight aria-hidden />, who: "Command", title: "Move it before it expires", line: "Spare units go where they run out first.", to: "/command" },
  { icon: <BellRing aria-hidden />, who: "Donor", title: "Ask only the right donors", line: "Eligible, nearby, and they said yes.", to: "/donor" },
];

/** (e) The answer: four roles, one shared picture. Each card opens the view that does it. */
export function AnswerSection() {
  const reduced = useReducedMotion();
  return (
    <section aria-labelledby="answer-title" className="mx-auto max-w-7xl px-4 py-24 sm:px-8 sm:py-32">
      <h2 id="answer-title" className="max-w-3xl font-display text-[clamp(1.9rem,1rem+3vw,3.6rem)] leading-[1.02] text-balance">
        Three people, one shared picture.
      </h2>
      <p className="mt-5 max-w-2xl text-lg text-ink-muted">The hospital asks, the bank answers, the donor decides.</p>

      <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CAPABILITIES.map((c, i) => (
          <motion.li
            key={c.title}
            initial={reduced ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link
              to={c.to}
              className="group flex h-full flex-col rounded-[22px] border border-line bg-surface-2 p-6 transition-colors hover:border-accent/40 hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <div className="flex items-center justify-between">
                <span className="grid size-14 place-items-center rounded-full bg-surface-3 text-accent transition-colors group-hover:bg-accent group-hover:text-accent-ink [&_svg]:size-6">
                  {c.icon}
                </span>
                <span className="font-display text-3xl font-bold text-line">0{i + 1}</span>
              </div>
              <span className="mt-6 text-[12px] font-semibold tracking-[0.14em] text-accent uppercase">{c.who}</span>
              <h3 className="mt-1 font-display text-2xl leading-tight font-bold">{c.title}</h3>
              <p className="mt-2 flex-1 text-[15px] text-ink-muted">{c.line}</p>
              <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
                Open view <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
              </span>
            </Link>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
