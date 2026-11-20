import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef } from "react";

/** Split "~1 million" into prefix "~", number 1, suffix " million". Values with more than one number stay static. */
function parse(value: string): { prefix: string; n: number; decimals: number; grouped: boolean; suffix: string } | null {
  const m = /^(\D*?)(\d[\d,]*(?:\.\d+)?)(\D*)$/.exec(value);
  if (!m) return null;
  const raw = m[2];
  return {
    prefix: m[1],
    n: Number(raw.replace(/,/g, "")),
    decimals: raw.includes(".") ? raw.split(".")[1].length : 0,
    grouped: raw.includes(","),
    suffix: m[3],
  };
}

/**
 * A sourced figure that counts up once when it scrolls into view. Writes text
 * directly (no React re-render per frame). The final text always equals `value`.
 */
export function CountUp({ value, className }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduced = useReducedMotion();
  const parts = useMemo(() => parse(value), [value]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !parts || reduced || !inView) return;
    const fmt = new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: parts.decimals,
      maximumFractionDigits: parts.decimals,
      useGrouping: parts.grouped,
    });
    const controls = animate(0, parts.n, {
      duration: 1.6,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        el.textContent = `${parts.prefix}${fmt.format(v)}${parts.suffix}`;
      },
      onComplete: () => {
        el.textContent = value;
      },
    });
    return () => controls.stop();
  }, [inView, reduced, value, parts]);

  return (
    <span className={className}>
      <span ref={ref} aria-hidden>
        {value}
      </span>
      <span className="sr-only">{value}</span>
    </span>
  );
}
