import {
  Activity,
  ArrowRightLeft,
  Bell,
  Building2,
  ChevronDown,
  ClipboardList,
  Droplets,
  FlaskConical,
  Grid3x3,
  LayoutDashboard,
  Menu,
  Search,
  TrendingUp,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import type { SiteDTO } from "../../../shared/api";
import { Logo } from "../../brand/Logo";
import { Button } from "../../components/ui/Button";
import { cn } from "../../lib/cn";
import { formatIST, freshnessLabel, relativeTime } from "../../lib/format";
import { useForecast } from "../../lib/queries";
import { useRealtime } from "../../lib/realtime";
import type { HospitalSection } from "./useHospitalView";

interface NavItem {
  id: HospitalSection;
  label: string;
  shortLabel: string;
  icon: typeof LayoutDashboard;
}

const NAV_ITEMS: readonly NavItem[] = [
  { id: "overview", label: "Overview", shortLabel: "Overview", icon: LayoutDashboard },
  { id: "inventory", label: "Blood Inventory", shortLabel: "Inventory", icon: Droplets },
  { id: "insights", label: "Predictive Insights", shortLabel: "Insights", icon: TrendingUp },
  { id: "reservations", label: "Reservations", shortLabel: "Tracking", icon: ClipboardList },
  { id: "transfers", label: "Transfers", shortLabel: "Transfers", icon: ArrowRightLeft },
];

function istGreeting(now: number): string {
  const hourStr = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    hour12: false,
  }).format(now);
  const hour = Number.parseInt(hourStr, 10);
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatISTDate(now: number): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(now);
}

export interface HospitalLayoutProps {
  hospital: SiteDTO;
  hospitals: SiteDTO[];
  onSelectHospital: (id: string) => void;
  section: HospitalSection;
  onSection: (section: HospitalSection) => void;
  embed: boolean;
  activeRequestCount: number;
  atRiskCount: number;
  transferSuggestionCount: number;
  lastInventorySyncAt: number;
  onJumpToFindBlood: () => void;
  onOpenCompatibility: () => void;
  children: ReactNode;
}

export function HospitalLayout({
  hospital,
  hospitals,
  onSelectHospital,
  section,
  onSection,
  embed,
  activeRequestCount,
  atRiskCount,
  transferSuggestionCount,
  lastInventorySyncAt,
  onJumpToFindBlood,
  onOpenCompatibility,
  children,
}: HospitalLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [seenSeq, setSeenSeq] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const pickerId = useId();
  const { recent, status } = useRealtime();
  const surge = useForecast().data?.surge ?? null;
  const now = Date.now();

  const unreadCount = useMemo(() => recent.filter((e) => e.seq > seenSeq).length, [recent, seenSeq]);
  const activeNavLabel = NAV_ITEMS.find((n) => n.id === section)?.label ?? "Overview";

  // Global keyboard shortcut: press "/" outside form controls to jump straight to Find Blood.
  useEffect(() => {
    const onShortcut = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) {
        return;
      }
      e.preventDefault();
      onJumpToFindBlood();
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, [onJumpToFindBlood]);

  // Escape closes mobile drawer and returns focus cleanly to the menu trigger.
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileNavOpen(false);
        requestAnimationFrame(() => menuBtnRef.current?.focus());
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileNavOpen]);

  useEffect(() => {
    if (!notifOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNotifOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [notifOpen]);

  const badgeFor = (id: HospitalSection): number | null => {
    if (id === "reservations" && activeRequestCount > 0) return activeRequestCount;
    if (id === "insights" && atRiskCount > 0) return atRiskCount;
    if (id === "transfers" && transferSuggestionCount > 0) return transferSuggestionCount;
    return null;
  };

  const handleNav = (next: HospitalSection) => {
    onSection(next);
    setMobileNavOpen(false);
  };

  /* Slim frame for `/stage` embedded iframes */
  if (embed) {
    return (
      <div className="hospital-theme flex min-h-0 flex-1 flex-col">
        <div className="border-b border-[#EAE6E3] bg-[#A82436] px-3 py-2.5 text-white">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <select
                aria-label="Acting hospital"
                value={hospital.id}
                onChange={(e) => onSelectHospital(e.target.value)}
                className="focus-ring max-w-full cursor-pointer rounded-md bg-transparent text-sm font-semibold text-white"
              >
                {hospitals.map((h) => (
                  <option key={h.id} value={h.id} className="text-[#171717]">
                    {h.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none]" role="navigation" aria-label="Hospital sections">
              {NAV_ITEMS.map((item) => {
                const active = section === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSection(item.id)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "focus-ring shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                      active ? "bg-white text-[#A82436]" : "text-white/80 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    {item.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-[96rem] flex-1 flex-col gap-4 p-3">{children}</div>
      </div>
    );
  }

  const syncMinutes = Math.max(0, Math.round((now - lastInventorySyncAt) / 60_000));

  const sidebarContent = (
    <div className="h-sidebar flex h-full flex-col">
      {/* Brand + Hospital Selector */}
      <div className="border-b border-white/12 px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-xl bg-white shadow-xs">
              <Logo size={20} compact />
            </span>
            <div>
              <p className="h-display text-sm font-bold tracking-tight text-white">Blood Bridge</p>
              <p className="text-[11px] font-medium text-[#FCEBED]/75">Hospital Command</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
            className="focus-ring rounded-lg p-1.5 text-white/75 hover:bg-white/10 lg:hidden"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="mt-4 rounded-xl bg-black/20 p-2.5 ring-1 ring-white/15">
          <label htmlFor={pickerId} className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#FCEBED]/70">
            <Building2 className="size-3 text-[#FCEBED]" aria-hidden />
            Facility
          </label>
          <div className="relative mt-1 flex items-center">
            <select
              id={pickerId}
              value={hospital.id}
              onChange={(e) => onSelectHospital(e.target.value)}
              className="focus-ring w-full cursor-pointer appearance-none truncate rounded bg-transparent pr-5 text-[13px] font-semibold text-white outline-none"
            >
              {hospitals.map((h) => (
                <option key={h.id} value={h.id} className="text-[#171717]">
                  {h.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-0 size-3.5 text-[#FCEBED]/75" aria-hidden />
          </div>
          <p className="mt-0.5 truncate text-[11px] text-[#FCEBED]/70">{hospital.areaName} · Mumbai</p>
        </div>
      </div>

      {/* Navigation */}
      <nav aria-label="Hospital navigation" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            const count = badgeFor(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleNav(item.id)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "focus-ring group relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13.5px] font-semibold transition-colors",
                    active ? "text-[#A82436]" : "text-[#FCEBED]/80 hover:bg-white/10 hover:text-white",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="hospital-nav-pill"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                      className="absolute inset-0 rounded-xl bg-white shadow-sm"
                    />
                  ) : null}
                  <Icon
                    className={cn("relative z-10 size-4 shrink-0", active ? "text-[#C93245]" : "text-[#FCEBED]/70 group-hover:text-white")}
                    aria-hidden
                  />
                  <span className="relative z-10 min-w-0 flex-1 truncate">{item.label}</span>
                  {count !== null ? (
                    <span
                      className={cn(
                        "h-num relative z-10 rounded-full px-2 py-0.5 text-[11px] font-bold leading-none",
                        active ? "bg-[#FCEBED] text-[#C93245]" : "bg-white/15 text-white",
                      )}
                    >
                      {count}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-5 border-t border-white/12 pt-4">
          <button
            type="button"
            onClick={() => {
              onOpenCompatibility();
              setMobileNavOpen(false);
            }}
            className="focus-ring flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-[#FCEBED]/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Grid3x3 className="size-4 shrink-0 text-[#FCEBED]/70" aria-hidden />
            <span>Compatibility Matrix</span>
          </button>
        </div>
      </nav>

      {/* Footer: Desk identity & Simulated data tag */}
      <div className="space-y-2.5 border-t border-white/12 p-3">
        <div className="flex items-center gap-2.5 rounded-xl bg-black/20 px-3 py-2.5 ring-1 ring-white/10">
          <span className="h-display grid size-8 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-[#A82436]" aria-hidden>
            TM
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">Transfusion Desk</p>
            <p className="truncate text-[11px] text-[#FCEBED]/70">{hospital.shortName}</p>
          </div>
          <span
            className={cn(
              "size-2 shrink-0 rounded-full ring-2 ring-white/25",
              status === "open" ? "bg-[#4ADE80]" : status === "offline" ? "bg-[#FCA5A5]" : "bg-[#FDE047]",
            )}
            title={`Realtime: ${status}`}
          />
        </div>
        <div className="flex items-center justify-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-medium text-[#FCEBED]/85">
          <FlaskConical className="size-3 shrink-0" aria-hidden />
          <span>Simulated demo data</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="hospital-theme flex min-h-0 flex-1">
      {/* Deep Crimson Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 lg:sticky lg:top-14 lg:block lg:h-[calc(100dvh-3.5rem)]">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Hospital navigation">
          <div className="fixed inset-0 bg-[#171717]/45 backdrop-blur-[2px]" onClick={() => setMobileNavOpen(false)} />
          <div className="relative z-10 w-68 max-w-[85vw] shadow-2xl">{sidebarContent}</div>
        </div>
      ) : null}

      {/* Main Alabaster + Blush Workspace */}
      <div className="flex min-w-0 flex-1 flex-col bg-[#FAF9F6]">
        {/* Sleek Minimal Top Bar */}
        <header className="border-b border-[#EAE6E3] bg-[#FFF5F5]/90 px-4 py-3 sm:px-6">
          <div className="mx-auto flex max-w-[94rem] items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                ref={menuBtnRef}
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open hospital navigation"
                aria-expanded={mobileNavOpen}
                className="focus-ring grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl border border-[#EAE6E3] bg-white text-[#171717] hover:bg-[#FCEBED] lg:hidden"
              >
                <Menu className="size-4" aria-hidden />
              </button>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="h-display truncate text-base font-bold text-[#171717] sm:text-lg">
                    {istGreeting(now)}, {hospital.shortName}
                  </h1>
                  {surge ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#C93245] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                      <Activity className="size-3" aria-hidden />
                      Surge · {surge.label}
                    </span>
                  ) : null}
                </div>
                <p className="h-num mt-0.5 flex items-center gap-2 text-xs text-[#737373]">
                  <span>{formatISTDate(now)}</span>
                  <span aria-hidden>·</span>
                  <span>{freshnessLabel(syncMinutes)}</span>
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={onJumpToFindBlood}
                aria-keyshortcuts="/"
                title="Jump to Find Blood (shortcut: /)"
                icon={<Search className="size-3.5" aria-hidden />}
                className="h-primary-cta h-9 rounded-xl px-3.5 font-bold"
              >
                <span>Find blood</span>
                <kbd
                  aria-hidden
                  className="ml-0.5 hidden rounded bg-white/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white sm:inline-block"
                >
                  /
                </kbd>
              </Button>

              <div ref={notifRef} className="relative">
                <button
                  type="button"
                  aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
                  aria-expanded={notifOpen}
                  onClick={() => {
                    setNotifOpen((v) => !v);
                    if (recent[0]) setSeenSeq(recent[0].seq);
                  }}
                  className="focus-ring relative grid size-9 place-items-center rounded-xl border border-[#EAE6E3] bg-white text-[#171717] transition-colors hover:border-[#C93245]/40 hover:bg-[#FCEBED]/50"
                >
                  <Bell className="size-4" aria-hidden />
                  {unreadCount > 0 ? (
                    <span className="h-num absolute -top-1 -right-1 grid min-w-4 place-items-center rounded-full bg-[#C93245] px-1 text-[10px] font-bold text-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  ) : null}
                </button>

                {notifOpen ? (
                  <div
                    role="region"
                    aria-label="Live operational updates"
                    className="h-card absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden shadow-xl"
                  >
                    <div className="flex items-center justify-between border-b border-[#EAE6E3] bg-[#FFF5F5] px-4 py-2.5">
                      <span className="h-display text-xs font-bold text-[#171717]">Live network feed</span>
                      <span className="text-[11px] font-medium text-[#C93245]">{status === "open" ? "Live" : status}</span>
                    </div>
                    {recent.length === 0 ? (
                      <p className="px-4 py-6 text-center text-xs text-[#737373]">
                        Waiting for live stock, reservation, or transfer events.
                      </p>
                    ) : (
                      <ul className="max-h-72 divide-y divide-[#EAE6E3] overflow-y-auto">
                        {recent.slice(0, 10).map((ev) => (
                          <li key={ev.seq} className="px-4 py-2.5 text-xs">
                            <p className="font-medium text-[#171717]">{ev.headline ?? ev.topics.join(", ")}</p>
                            <p className="h-num mt-0.5 text-[11px] text-[#737373]">
                              {formatIST(ev.at)} · {relativeTime(ev.at, now)}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        {/* Live screen-reader section announcement */}
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {hospital.name}: {activeNavLabel}
        </p>

        {/* Smoothly Animated Page Canvas */}
        <motion.div
          key={section}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto flex w-full max-w-[94rem] flex-1 flex-col gap-5 px-4 py-5 sm:px-6"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
