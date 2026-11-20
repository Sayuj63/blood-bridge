import { Bell, House, Settings2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export const TABS = ["home", "alerts", "settings"] as const;
export type Tab = (typeof TABS)[number];

const TAB_META: Record<Tab, { label: string; icon: ReactNode }> = {
  home: { label: "Home", icon: <House className="size-5" aria-hidden /> },
  alerts: { label: "Alerts", icon: <Bell className="size-5" aria-hidden /> },
  settings: { label: "Settings", icon: <Settings2 className="size-5" aria-hidden /> },
};

/** Phone column, a full-width screen on mobile and a centred ~420px column on wide screens. */
export function DonorFrame({ top, children, footer, inert }: { top: ReactNode; children: ReactNode; footer?: ReactNode; inert?: boolean }) {
  return (
    <div className="flex flex-1 justify-center sm:bg-surface-2 sm:py-0">
      <div
        inert={inert}
        className={cn(
          "relative flex w-full max-w-[420px] flex-col bg-canvas sm:border-x sm:border-line",
          footer ? "pb-[calc(4.5rem+env(safe-area-inset-bottom))]" : "pb-6",
        )}
      >
        <div className="flex min-h-14 items-center gap-2 px-4 pt-3">{top}</div>
        <div className="flex flex-1 flex-col px-4 pt-2 pb-4">{children}</div>
        {footer}
      </div>
    </div>
  );
}

/** Bottom tab bar, pinned to the bottom of the phone column. */
export function TabBar({ tab, onChange, alertCount }: { tab: Tab; onChange: (tab: Tab) => void; alertCount: number }) {
  return (
    <nav
      aria-label="Donor sections"
      className="fixed bottom-0 left-1/2 z-30 w-full max-w-[420px] -translate-x-1/2 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:border-x"
    >
      <ul className="grid grid-cols-3">
        {TABS.map((t) => {
          const active = t === tab;
          const { label, icon } = TAB_META[t];
          return (
            <li key={t}>
              <button
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => onChange(t)}
                className={cn(
                  "focus-ring relative flex h-16 w-full flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                  active ? "text-accent" : "text-ink-muted hover:text-ink",
                )}
              >
                <span className="relative">
                  {icon}
                  {t === "alerts" && alertCount > 0 ? (
                    <span className="absolute -top-1.5 -right-2.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 font-numeric text-2xs font-bold text-accent-ink">
                      {alertCount}
                    </span>
                  ) : null}
                </span>
                <span>
                  {label}
                  {t === "alerts" && alertCount > 0 ? <span className="sr-only">, {alertCount} waiting</span> : null}
                </span>
                {active ? <span aria-hidden className="absolute top-0 h-0.5 w-10 rounded-full bg-accent" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
