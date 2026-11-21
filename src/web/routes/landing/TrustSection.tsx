import { ArrowUpRight, FlaskConical, Link2, ShieldCheck, UserCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { CompatibilityMatrix } from "../../components/ui/CompatibilityMatrix";

const PROMISES: { icon: ReactNode; title: string; line: ReactNode }[] = [
  { icon: <FlaskConical aria-hidden />, title: "Honest by default", line: "Real banks, simulated people. Every screen says so." },
  {
    icon: <Link2 aria-hidden />,
    title: "Tamper-evident ledger",
    line: (
      <>
        Edit one entry and verification names it.{" "}
        <Link to="/ledger" className="inline-flex items-center font-semibold text-accent underline-offset-4 hover:underline">
          Try it <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </>
    ),
  },
  { icon: <UserCheck aria-hidden />, title: "Donors in control", line: "Separate, revocable consent. Contact shared only after a yes." },
  { icon: <ShieldCheck aria-hidden />, title: "Clinicians decide", line: "Every non-exact match is flagged for confirmation." },
];

/** (f) Trust and privacy: four promises at a glance, and the compatibility rules in the open. */
export function TrustSection() {
  return (
    <section aria-labelledby="trust-title" className="border-t border-line">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-24 sm:px-8 lg:grid-cols-[1fr_1.1fr] lg:py-32">
        <div>
          <h2 id="trust-title" className="font-display text-[clamp(1.9rem,1rem+3vw,3.2rem)] leading-[1.02] text-balance">
            Built to be trusted with blood.
          </h2>
          <ul className="mt-10 grid gap-3 sm:grid-cols-2">
            {PROMISES.map((p) => (
              <li key={p.title} className="rounded-[18px] border border-line bg-surface-2 p-5">
                <span className="grid size-10 place-items-center rounded-full bg-surface-3 text-accent [&_svg]:size-5">{p.icon}</span>
                <h3 className="mt-4 font-display text-lg font-bold">{p.title}</h3>
                <p className="mt-1 text-sm text-ink-muted">{p.line}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="min-w-0 self-center rounded-[22px] border border-line bg-surface p-4 sm:p-6">
          <h3 className="mb-1 font-display text-xl font-bold">Who can receive what?</h3>
          <p className="mb-4 text-sm text-ink-muted">Simplified demo logic, shown in the open.</p>
          <CompatibilityMatrix />
        </div>
      </div>
    </section>
  );
}
