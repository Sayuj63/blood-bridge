import { useMatches } from "react-router";
import type { ThemeName } from "../styles/tokens";

/** Per-route metadata, set on route objects in router.tsx as `handle`. */
export interface RouteHandle {
  theme: ThemeName;
  /** Default X-Actor for this view; role views refine it (e.g. `bank:BB-001`). */
  actor: string;
  /** Short role name for the compact embed bar. */
  title: string;
  /** `fill` locks the shell to the viewport on large screens so dashboards scroll panel by panel. */
  layout?: "page" | "fill";
}

const FALLBACK: RouteHandle = { theme: "clinical", actor: "command", title: "Blood Bridge", layout: "page" };

/** The deepest matched route's handle. */
export function useRouteHandle(): RouteHandle {
  const matches = useMatches();
  for (let i = matches.length - 1; i >= 0; i--) {
    const h = matches[i].handle as Partial<RouteHandle> | undefined;
    if (h?.theme) return { ...FALLBACK, ...h };
  }
  return FALLBACK;
}
