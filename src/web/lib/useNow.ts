import { useCallback, useSyncExternalStore } from "react";

/**
 * One shared clock per interval, so fifty countdowns on a screen cost one timer.
 * Components re-render only when the interval ticks.
 */
const clocks = new Map<number, { now: number; listeners: Set<() => void>; timer: number | null }>();

function clock(intervalMs: number) {
  let c = clocks.get(intervalMs);
  if (!c) {
    c = { now: Date.now(), listeners: new Set(), timer: null };
    clocks.set(intervalMs, c);
  }
  return c;
}

function subscribe(intervalMs: number, listener: () => void): () => void {
  const c = clock(intervalMs);
  c.listeners.add(listener);
  if (c.timer === null) {
    c.now = Date.now();
    c.timer = window.setInterval(() => {
      c.now = Date.now();
      c.listeners.forEach((l) => l());
    }, intervalMs);
  }
  return () => {
    c.listeners.delete(listener);
    if (c.listeners.size === 0 && c.timer !== null) {
      window.clearInterval(c.timer);
      c.timer = null;
    }
  };
}

/** Current epoch ms, refreshed every `intervalMs` (default 1s). */
export function useNow(intervalMs = 1000): number {
<<<<<<< Updated upstream
  // A stable subscribe function: a new one each render makes React resubscribe every render,
  // and resubscribing restarts the clock, which re-renders again — an infinite loop.
  const subscribeToClock = useCallback((l: () => void) => subscribe(intervalMs, l), [intervalMs]);
  const snapshot = useCallback(() => clock(intervalMs).now, [intervalMs]);
  return useSyncExternalStore(subscribeToClock, snapshot, () => Date.now());
=======
  const sub = useCallback((l: () => void) => subscribe(intervalMs, l), [intervalMs]);
  const snap = useCallback(() => clock(intervalMs).now, [intervalMs]);
  return useSyncExternalStore(sub, snap, () => Date.now());
>>>>>>> Stashed changes
}
