import { Droplet, Hospital, Radar, ShieldCheck, Smartphone } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Link, NavLink, Outlet, useSearchParams } from "react-router";
import { Logo } from "../brand/Logo";
import { LiveDot } from "../components/ui/LiveDot";
import { SimulatedBadge } from "../components/ui/SimulatedBadge";
import { setActor } from "../lib/api";
import { cn } from "../lib/cn";
import { useForecast } from "../lib/queries";
import { useRealtime } from "../lib/realtime";
import { useRouteHandle } from "./routeHandle";
import { SurgeBanner } from "./SurgeBanner";

const ROLES: { to: string; label: string; icon: ReactNode }[] = [
  { to: "/hospital", label: "Hospital", icon: <Hospital className="size-4" aria-hidden /> },
  { to: "/bank", label: "Blood bank", icon: <Droplet className="size-4" aria-hidden /> },
  { to: "/donor", label: "Donor", icon: <Smartphone className="size-4" aria-hidden /> },
  { to: "/command", label: "Command", icon: <Radar className="size-4" aria-hidden /> },
  { to: "/ledger", label: "Ledger", icon: <ShieldCheck className="size-4" aria-hidden /> },
];

/**
 * Frame for every working view: brand, role switcher, live connection, the
 * Simulated badge, and the surge banner when a scenario is running.
 * `?embed=1` renders a slim bar for the /stage iframes.
 */
export function AppShell() {
  const handle = useRouteHandle();
  const [params] = useSearchParams();
  const embed = params.get("embed") === "1";
  const { status } = useRealtime();
  const surge = useForecast().data?.surge ?? null;

  useEffect(() => {
    setActor(handle.actor);
  }, [handle.actor]);

  return (
    <div data-theme={handle.theme} className={cn("flex min-h-dvh flex-col bg-canvas text-ink", handle.layout === "fill" && "lg:h-dvh lg:overflow-hidden")}>
      <a
        href="#main"
        className="focus-ring sr-only z-50 rounded-md bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-surface/92 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        {embed ? (
          <div className="flex h-11 items-center gap-2 px-3">
            <Logo size={20} compact />
            <span className="font-label text-sm text-ink">{handle.title}</span>
            <LiveDot status={status} showLabel={false} className="ml-1" />
            <span className="ml-auto">
              <SimulatedBadge compact />
            </span>
          </div>
        ) : (
          <div className="flex h-14 items-center gap-3 px-3 sm:px-5">
            <Link to="/" className="focus-ring shrink-0 rounded-md" aria-label="Blood Bridge home">
              <Logo size={26} className="hidden sm:inline-flex" />
              <Logo size={26} compact className="sm:hidden" />
            </Link>
            <nav aria-label="Views" className="-mx-1 min-w-0 flex-1 overflow-x-auto px-1 [scrollbar-width:none]">
              <ul className="flex items-center gap-0.5">
                {ROLES.map((r) => (
                  <li key={r.to}>
                    <NavLink
                      to={r.to}
                      className={({ isActive }) =>
                        cn(
                          "focus-ring flex h-9 items-center gap-1.5 whitespace-nowrap rounded-(--radius-control) px-2.5 text-sm font-medium transition-colors",
                          isActive ? "bg-surface-2 text-ink command:bg-surface-3" : "text-ink-muted hover:bg-surface-2 hover:text-ink",
                        )
                      }
                    >
                      {r.icon}
                      <span>{r.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="flex shrink-0 items-center gap-3">
              <LiveDot status={status} className="hidden md:inline-flex" />
              <LiveDot status={status} showLabel={false} className="md:hidden" />
              <span className="hidden lg:inline-flex">
                <SimulatedBadge />
              </span>
              <span className="lg:hidden">
                <SimulatedBadge compact />
              </span>
            </div>
          </div>
        )}
        {surge ? <SurgeBanner surge={surge} compact={embed} /> : null}
      </header>
      <main id="main" className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}
