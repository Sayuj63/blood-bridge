import { useEffect, useState } from "react";

/**
 * Current epoch ms, refreshed every `intervalMs`. A local stand-in for lib/useNow
 * in this view's larger components: useNow re-subscribes on every render and, as
 * sole subscriber, resets its clock on each re-subscribe, which can loop renders.
 */
export function useTick(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}
