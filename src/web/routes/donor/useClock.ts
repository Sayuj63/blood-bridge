import { useEffect, useState } from "react";

/**
 * Current epoch ms, refreshed every `intervalMs`. A local stand-in for
 * lib/useNow, whose per-render subscribe closure makes a lone subscriber
 * resubscribe and re-render in a loop.
 */
export function useClock(intervalMs = 60_000): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
