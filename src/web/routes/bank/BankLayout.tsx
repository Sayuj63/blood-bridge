import {
  ArrowLeftRight,
  Building2,
  ChevronDown,
  ClipboardCheck,
  Droplets,
  FlaskConical,
  LayoutDashboard,
  MapPin,
  Menu,
  PackagePlus,
  Phone,
  Users,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import { useId, useState, type ReactNode } from "react";
import type { SiteDTO } from "../../../shared/api";
import { Logo } from "../../brand/Logo";
import { FreshnessPill } from "../../components/ui/FreshnessPill";
import { cn } from "../../lib/cn";

export type BankTab = "stock" | "update" | "transfers" | "donors";
export const BANK_TABS: readonly BankTab[] = ["stock", "update", "transfers", "donors"];
export const isBankTab = (v: string | null): v is BankTab => v !== null && (BANK_TABS as readonly string[]).includes(v);

interface NavItem {
  id: BankTab;
  label: string;
  shortLabel: string;
  icon: typeof LayoutDashboard;
}

const NAV_ITEMS: readonly NavItem[] = [
  { id: "stock", label: "Overview & Stock", shortLabel: "Stock", icon: LayoutDashboard },
  { id: "update", label: "Update Stock", shortLabel: "Update", icon: PackagePlus },
  { id: "transfers", label: "Transfers", shortLabel: "Transfers", icon: ArrowLeftRight },
  { id: "donors", label: "Donor Drive", shortLabel: "Donors", icon: Users },
];

export interface BankLayoutProps {
  site: SiteDTO;
  banks: readonly SiteDTO[];
  onSelectSite: (siteId: string) => void;
  tab: BankTab;
  onTab: (tab: BankTab) => void;
  embed: boolean;
  pendingTransfers: number;
  incomingDonors: number;
  openRequests: number;
  children: ReactNode;
}

/**
 * Unified Blood Bank workspace shell mirroring Hospital Command & Donor Portal:
 * - Desktop (`>= lg`, standalone): luminous crimson left sidebar + blush top bar + warm ivory canvas.
 * - Mobile (`< lg`): slide-out crimson drawer + compact header.
 * - Embedded (`/stage` `?embed=1`): slim crimson strip with bank switcher & tab pills.
 */
export function BankLayout({
  site,
  banks,
  onSelectSite,
  tab,
  onTab,
  embed,
  pendingTransfers,
  incomingDonors,
  openRequests,
  children,
}: BankLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pickerId = useId();

  const badgeFor = (id: BankTab): number | null => {
    if (id === "transfers" && pendingTransfers > 0) return pendingTransfers;
    if (id === "donors" && incomingDonors > 0) return incomingDonors;
    return null;
  };

  const handleNav = (next: BankTab) => {
    onTab(next);
    setMobileNavOpen(false);
  };

  /* Slim frame for /stage embedded iframes */
  if (embed) {
    return (
      <div className="bank-theme flex min-h-0 flex-1 flex-col">
        <div className="border-b border-[#EAE6E3] bg-[#A82436] px-3 py-2.5 text-white">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <select
                aria-label="Acting blood bank"
                value={site.id}
                onChange={(e) => onSelectSite(e.target.value)}
                className="focus-ring max-w-full cursor-pointer rounded-md bg-transparent text-sm font-semibold text-white"
              >
                {banks.map((b) => (
                  <option key={b.id} value={b.id} className="text-[#171717]">
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none]" role="navigation" aria-label="Blood bank sections">
              {NAV_ITEMS.map((item) => {
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onTab(item.id)}
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
        <div className="mx-auto flex w-full max-w-[96rem] flex-1 flex-col gap-5 p-3">{children}</div>
      </div>
    );
  }

  const sidebarContent = (
    <div className="b-sidebar flex h-full flex-col">
      {/* Brand + Blood Bank Selector */}
      <div className="border-b border-white/12 px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-xl bg-white shadow-xs">
              <Logo size={20} compact />
            </span>
            <div>
              <p className="b-display text-sm font-bold tracking-tight text-white">Blood Bridge</p>
              <p className="text-[11px] font-medium text-[#FCEBED]/80">Blood Bank Desk</p>
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

        <div className="mt-4 rounded-xl bg-black/18 p-2.5 ring-1 ring-white/15">
          <label htmlFor={pickerId} className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#FCEBED]/70">
            <Building2 className="size-3 text-[#FCEBED]" aria-hidden />
            Blood Bank
          </label>
          <div className="relative mt-1 flex items-center">
            <select
              id={pickerId}
              value={site.id}
              onChange={(e) => onSelectSite(e.target.value)}
              className="focus-ring w-full cursor-pointer appearance-none truncate rounded bg-transparent pr-5 text-[13px] font-semibold text-white outline-none"
            >
              {banks.map((b) => (
                <option key={b.id} value={b.id} className="text-[#171717]">
                  {b.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-0 size-3.5 text-[#FCEBED]/75" aria-hidden />
          </div>
          <p className="mt-0.5 truncate text-[11px] text-[#FCEBED]/75">{site.areaName} · Mumbai</p>
        </div>
      </div>

      {/* Navigation */}
      <nav aria-label="Blood bank navigation" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            const count = badgeFor(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleNav(item.id)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "focus-ring group relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13.5px] font-semibold transition-colors",
                    active ? "text-[#A82436]" : "text-[#FCEBED]/85 hover:bg-white/10 hover:text-white",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="bank-nav-pill"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                      className="absolute inset-0 rounded-xl bg-white shadow-sm"
                    />
                  ) : null}
                  <Icon
                    className={cn("relative z-10 size-4 shrink-0", active ? "text-[#C93245]" : "text-[#FCEBED]/75 group-hover:text-white")}
                    aria-hidden
                  />
                  <span className="relative z-10 min-w-0 flex-1 truncate">{item.label}</span>
                  {count !== null ? (
                    <span
                      className={cn(
                        "b-num relative z-10 rounded-full px-2 py-0.5 text-[11px] font-bold leading-none",
                        active ? "bg-[#FCEBED] text-[#C93245]" : "bg-white/20 text-white",
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
      </nav>

      {/* Footer: Live queue pulse & Demo tag */}
      <div className="space-y-2.5 border-t border-white/12 p-3">
        <div className="flex items-center gap-2.5 rounded-xl bg-black/18 px-3 py-2.5 ring-1 ring-white/12">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-[#A82436]" aria-hidden>
            <Droplets className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">Live Queue</p>
            <p className="b-num truncate text-[11px] text-[#FCEBED]/75">
              {openRequests === 0 ? "All clear" : `${openRequests} active request${openRequests === 1 ? "" : "s"}`}
            </p>
          </div>
          <span
            className={cn("size-2 shrink-0 rounded-full ring-2 ring-white/25", openRequests > 0 ? "bg-[#FDE047]" : "bg-[#4ADE80]")}
            aria-hidden
          />
        </div>
        <div className="flex items-center justify-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-medium text-[#FCEBED]/90">
          <FlaskConical className="size-3 shrink-0" aria-hidden />
          <span>Simulated demo data</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bank-theme flex min-h-0 flex-1">
      {/* Desktop Luminous Crimson Sidebar */}
      <aside className="hidden w-64 shrink-0 lg:sticky lg:top-14 lg:block lg:h-[calc(100dvh-3.5rem)]">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Blood bank navigation">
          <div className="fixed inset-0 bg-[#171717]/45 backdrop-blur-[2px]" onClick={() => setMobileNavOpen(false)} />
          <div className="relative z-10 w-68 max-w-[85vw] shadow-2xl">{sidebarContent}</div>
        </div>
      ) : null}

      {/* Main Warm Ivory Workspace */}
      <div className="flex min-w-0 flex-1 flex-col bg-[#FAF9F6]">
        {/* Clean Minimal Blush Top Header */}
        <header className="border-b border-[#EAE6E3] bg-[#FFF5F5]/85 px-4 py-3 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[92rem] flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open blood bank navigation"
                className="focus-ring grid size-9 shrink-0 place-items-center rounded-xl border border-[#EAE6E3] bg-white text-[#171717] hover:bg-[#FCEBED] lg:hidden"
              >
                <Menu className="size-4" aria-hidden />
              </button>
              <div className="min-w-0">
                <h1 className="b-display truncate text-base font-bold text-[#171717] sm:text-lg">{site.name}</h1>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[#737373]">
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <MapPin className="size-3 shrink-0 text-[#C93245]" aria-hidden />
                    <span className="truncate">{site.address || site.areaName}</span>
                  </span>
                  {site.phone ? (
                    <span className="b-num inline-flex items-center gap-1">
                      <Phone className="size-3 text-[#737373]" aria-hidden />
                      {site.phone}
                    </span>
                  ) : null}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2.5">
              <FreshnessPill lastSyncAt={site.lastSyncAt} />
              {tab !== "update" ? (
                <button
                  type="button"
                  onClick={() => onTab("update")}
                  className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#C93245] px-3.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-[#A82436]"
                >
                  <ClipboardCheck className="size-3.5" aria-hidden />
                  <span>Update stock</span>
                </button>
              ) : null}
            </div>
          </div>
        </header>

        {/* Smoothly Animated Page Canvas */}
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto flex w-full max-w-[92rem] flex-1 flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-6"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
