import { ProofCards } from "./ProofCards";
import { StatCards } from "./StatCards";

/** (b) The scale of the problem: national figures, then two local proofs. Every figure sourced. */
export function ScaleSection() {
  return (
    <section aria-labelledby="scale-title" className="mx-auto max-w-7xl px-4 py-24 sm:px-8 sm:py-32">
      <h2 id="scale-title" className="max-w-3xl font-display text-[clamp(1.9rem,1rem+3vw,3.6rem)] leading-[1.02] text-balance">
        It isn't one unlucky night. It's how the system works.
      </h2>
      <p className="mt-5 max-w-2xl text-lg text-ink-muted">
        Blood is collected, tested and stored bank by bank. Supply and need rarely meet in the same place at the same hour.
      </p>
      <StatCards />
      <ProofCards />
    </section>
  );
}
