import { useEffect, useRef, useState } from "react";

/**
 * IDs that appeared after the first load, held for `holdMs` so the card can
 * be highlighted. Mount once per site (key the parent by site id).
 */
export function useArrivals(ids: readonly string[] | undefined, holdMs = 10_000): ReadonlySet<string> {
  const seen = useRef<Set<string> | null>(null);
  const timers = useRef<number[]>([]);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set());
  const signature = ids?.join(",");

  useEffect(() => {
    if (signature === undefined) return;
    const current = signature ? signature.split(",") : [];
    if (seen.current === null) {
      seen.current = new Set(current);
      return;
    }
    const known = seen.current;
    const added = current.filter((id) => !known.has(id));
    if (added.length === 0) return;
    added.forEach((id) => known.add(id));
    setFresh((prev) => new Set([...prev, ...added]));
    timers.current.push(
      window.setTimeout(() => {
        setFresh((prev) => new Set([...prev].filter((id) => !added.includes(id))));
      }, holdMs),
    );
  }, [signature, holdMs]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  return fresh;
}
