import { Bell, FlaskConical, House, Settings2, UserPlus } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import type { DonorDTO } from "../../../shared/api";
import { Logo } from "../../brand/Logo";
import { cn } from "../../lib/cn";

export const TABS = ["home", "alerts", "settings"] as const;
export type Tab = (typeof TABS)[number];

const TAB_META: Record<Tab, { label: string; icon: typeof House }> = {
  home: { label: "Home", icon: House },
  alerts: { label: "Alerts", icon: Bell },
  settings: { label: "Settings", icon: Settings2 },
};

interface DonorFrameProps {
  top: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  inert?: boolean;
  embed?: boolean;
  /** Desktop sidebar props — omitted during onboarding or loading. */
  sidebar?: {
    donor: DonorDTO;
    tab: Tab;
    onTab: (tab: Tab) => void;
    alertCount: number;
    onOpenSwitcher?: () => void;
    onSignUp?: () => void;
  };
}

/**
 * Adaptive responsive frame matching Hospital Command's layout architecture:
 * - Mobile & `/stage` `?embed=1`: full-bleed mobile layout with pinned bottom tab bar.
 * - Desktop (`>= lg`, standalone): luminous crimson left sidebar + airy warm-ivory workspace.
 */
export function DonorFrame({ top, children, footer, inert, embed = false, sidebar }: DonorFrameProps) {
  const showDesktopSidebar = !embed && sidebar !== undefined;

  return (
    <div className="donor-theme flex min-h-0 w-full max-w-full flex-1 overflow-x-clip">
      {/* Desktop Luminous Crimson Sidebar */}
      {showDesktopSidebar ? (
        <aside className="d-sidebar hidden w-64 shrink-0 flex-col lg:sticky lg:top-14 lg:flex lg:h-[calc(100dvh-3.5rem)]">
          <div className="border-b border-white/12 px-4 py-4">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-xl bg-white shadow-xs">
                <Logo size={20} compact />
              </span>
              <div>
                <p className="d-display text-sm font-bold tracking-tight text-white">Blood Bridge</p>
                <p className="text-[11px] font-medium text-[#FCEBED]/80">Donor Portal</p>
              </div>
            </div>

            {/* Compact Donor Identity Tile (no redundant metrics) */}
            <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-black/18 p-2.5 ring-1 ring-white/15">
              <span className="d-num grid size-9 shrink-0 place-items-center rounded-lg bg-white text-xs font-extrabold text-[#A82436]">
                {sidebar.donor.bloodGroup.replace("-", "−")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-white">{sidebar.donor.name}</p>
                <p className="truncate text-[11px] text-[#FCEBED]/75">{sidebar.donor.areaName} · Mumbai</p>
              </div>
            </div>
          </div>

          <nav aria-label="Donor navigation" className="flex-1 overflow-y-auto px-3 py-4">
            <ul className="space-y-1">
              {TABS.map((t) => {
                const active = t === sidebar.tab;
                const { label, icon: Icon } = TAB_META[t];
                return (
                  <li key={t}>
                    <button
                      type="button"
                      aria-current={active ? "page" : undefined}
                      onClick={() => sidebar.onTab(t)}
                      className={cn(
                        "focus-ring group relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13.5px] font-semibold transition-colors",
                        active ? "text-[#A82436]" : "text-[#FCEBED]/85 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      {active ? (
                        <motion.span
                          layoutId="donor-desktop-pill"
                          transition={{ type: "spring", stiffness: 420, damping: 32 }}
                          className="absolute inset-0 rounded-xl bg-white shadow-sm"
                        />
                      ) : null}
                      <Icon
                        className={cn("relative z-10 size-4 shrink-0", active ? "text-[#C93245]" : "text-[#FCEBED]/75 group-hover:text-white")}
                        aria-hidden
                      />
                      <span className="relative z-10 flex-1">{label}</span>
                      {t === "alerts" && sidebar.alertCount > 0 ? (
                        <span
                          className={cn(
                            "d-num relative z-10 rounded-full px-2 py-0.5 text-[11px] font-bold leading-none",
                            active ? "bg-[#FCEBED] text-[#C93245]" : "bg-white/20 text-white",
                          )}
                        >
                          {sidebar.alertCount}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>

            {sidebar.onSignUp ? (
              <div className="mt-5 border-t border-white/12 pt-4">
                <button
                  type="button"
                  onClick={sidebar.onSignUp}
                  className="focus-ring flex w-full items-center gap-2.5 rounded-xl bg-white/12 px-3 py-2.5 text-left text-xs font-semibold text-white ring-1 ring-white/15 transition-colors hover:bg-white/20"
                >
                  <UserPlus className="size-4 shrink-0 text-[#FCEBED]" aria-hidden />
                  <span>Become a donor</span>
                </button>
              </div>
            ) : null}
          </nav>

          <div className="border-t border-white/12 p-3">
            <div className="flex items-center justify-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-medium text-[#FCEBED]/90">
              <FlaskConical className="size-3 shrink-0" aria-hidden />
              <span>Simulated demo data</span>
            </div>
          </div>
        </aside>
      ) : null}

      {/* Main Content Surface */}
      <div
        inert={inert}
        className={cn(
          "relative flex min-w-0 w-full max-w-full flex-1 flex-col bg-[#FAF9F6]",
          footer && (showDesktopSidebar ? "pb-[calc(5.75rem+env(safe-area-inset-bottom))] lg:pb-10" : "pb-[calc(5.75rem+env(safe-area-inset-bottom))]"),
        )}
      >
        {/* Clean Minimal Top Bar (mirrors Hospital Command header rhythm) */}
        {top ? (
          <header className="w-full border-b border-[#EAE6E3] bg-[#FFF5F5]/85 px-4 py-3 sm:px-6 lg:px-8">
            <div className={cn("mx-auto flex w-full items-center justify-between gap-3", showDesktopSidebar ? "max-w-[78rem]" : "max-w-[540px]")}>
              {top}
            </div>
          </header>
        ) : null}

        <div
          className={cn(
            "mx-auto flex w-full flex-1 flex-col px-4 py-5 sm:px-6 lg:px-8 lg:py-6",
            showDesktopSidebar ? "max-w-[78rem]" : "max-w-[540px]",
          )}
        >
          {children}
        </div>

        {/* Mobile Bottom Tab Bar */}
        {footer ? <div className={cn(showDesktopSidebar && "lg:hidden")}>{footer}</div> : null}
      </div>
    </div>
  );
}

/** Mobile bottom tab bar, thumb-friendly 56px touch targets with safe-area padding & spring indicator. */
export function TabBar({ tab, onChange, alertCount }: { tab: Tab; onChange: (tab: Tab) => void; alertCount: number }) {
  return (
    <nav
      aria-label="Donor sections"
      className="fixed inset-x-0 bottom-0 z-30 w-full border-t border-[#EAE6E3] bg-white/95 pb-[max(0.375rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_-8px_rgba(23,23,23,0.1)] backdrop-blur-md"
    >
      <ul className="mx-auto grid w-full max-w-[540px] grid-cols-3 gap-1 px-2.5 pt-1.5">
        {TABS.map((t) => {
          const active = t === tab;
          const { label, icon: Icon } = TAB_META[t];
          return (
            <li key={t}>
              <button
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => onChange(t)}
                className={cn(
                  "focus-ring relative flex min-h-14 w-full touch-manipulation flex-col items-center justify-center gap-1 rounded-2xl text-xs font-bold transition-colors active:scale-[0.97]",
                  active ? "text-[#A82436]" : "text-[#737373] hover:text-[#171717]",
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="donor-mobile-tab"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    className="absolute inset-0 rounded-2xl bg-[#FCEBED]"
                  />
                ) : null}
                <span className="relative z-10">
                  <Icon className="size-5" aria-hidden />
                  {t === "alerts" && alertCount > 0 ? (
                    <span className="d-num absolute -top-1.5 -right-2.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#C93245] px-1 text-[10px] font-extrabold text-white ring-2 ring-white">
                      {alertCount}
                    </span>
                  ) : null}
                </span>
                <span className="relative z-10">
                  {label}
                  {t === "alerts" && alertCount > 0 ? <span className="sr-only">, {alertCount} waiting</span> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
