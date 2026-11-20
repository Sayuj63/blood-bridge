import { FlaskConical, Link2, ShieldCheck, UserCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { CompatibilityMatrix } from "../../components/ui/CompatibilityMatrix";

const PROMISES: { icon: ReactNode; title: string; body: ReactNode }[] = [
  {
    icon: <FlaskConical aria-hidden />,
    title: "Honest about what's simulated",
    body: "Blood centre names and locations are real open data. Stock, patients and donors in this demo are simulated, and every screen says so.",
  },
  {
    icon: <Link2 aria-hidden />,
    title: "A ledger that shows tampering",
    body: (
      <>
        Every reservation, transfer and alert is written to a hash-chained audit log. Change one entry and verification names the
        broken link. <Link to="/ledger" className="font-semibold text-bridge underline-offset-4 hover:underline">Try to tamper with it</Link>.
      </>
    ),
  },
  {
    icon: <UserCheck aria-hidden />,
    title: "Donors stay in control",
    body: "Consent for alerts, location and eligibility checks is separate and revocable. Locations are rounded to about a kilometre. Banks see contact details only after a donor says yes.",
  },
  {
    icon: <ShieldCheck aria-hidden />,
    title: "Clinicians make the call",
    body: "Any match that isn't the exact group is flagged for clinician confirmation. The compatibility rules below are simplified demo logic.",
  },
];

/** (f) Trust and privacy. */
export function TrustSection() {
  return (
    <section aria-labelledby="trust-title" className="border-t border-line bg-surface/40">
      <div className="mx-auto grid max-w-7xl gap-14 px-4 py-24 sm:px-8 lg:grid-cols-[1fr_1.1fr] lg:py-32">
        <div>
          <h2 id="trust-title" className="font-display text-[clamp(1.9rem,1rem+3vw,3.2rem)] leading-[1.02] text-balance">
            Built to be trusted with blood.
          </h2>
          <ul className="mt-10 space-y-8">
            {PROMISES.map((p) => (
              <li key={p.title} className="flex gap-4">
                <span className="mt-0.5 shrink-0 text-ink-muted [&_svg]:size-5">{p.icon}</span>
                <div>
                  <h3 className="font-semibold">{p.title}</h3>
                  <p className="mt-1 text-ink-muted">{p.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="min-w-0 self-center rounded-(--radius-panel) border border-line bg-surface p-4 sm:p-6">
          <h3 className="mb-4 font-semibold">Which units can a patient receive?</h3>
          <CompatibilityMatrix />
        </div>
      </div>
    </section>
  );
}
