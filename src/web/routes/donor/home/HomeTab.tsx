import {
  Award,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Droplet,
  Heart,
  HeartHandshake,
  MessageCircle,
  PartyPopper,
} from "lucide-react";
import type { DonorAlertDTO, DonorDTO, DonorSignupDTO } from "../../../../shared/api";
import { buttonVariants } from "../../../components/ui/Button";
import { cn } from "../../../lib/cn";
import { useMeta } from "../../../lib/queries";
import { DAY_MS, formatDate } from "../copy";
import { DonorCard } from "../keepsake/DonorCard";
import { ReminderButton } from "../keepsake/ReminderButton";
import { useClock } from "../useClock";
import { ImpactCard } from "./ImpactCard";
import { NearbyBanks } from "./NearbyBanks";

export function HomeTab({
  donor,
  pending,
  justJoined,
  whatsappJoin,
  onOpenAlert,
}: {
  donor: DonorDTO;
  /** An alert still waiting for an answer, if any. */
  pending: DonorAlertDTO | undefined;
  /** Shown once after the quick join. */
  justJoined: boolean;
  /** Click-to-chat after a signup that chose WhatsApp. */
  whatsappJoin?: DonorSignupDTO["whatsappJoin"];
  onOpenAlert: (alertId: string) => void;
}) {
  const now = useClock(60_000);
  const intervalDays = useMeta().data?.eligibilityRules.minDaysBetweenDonations ?? 90;
  const wait =
    !donor.eligible && donor.eligibleFrom !== null && donor.lastDonationAt !== null
      ? { from: donor.lastDonationAt, until: donor.eligibleFrom }
      : null;
  const waiting = wait !== null;
  const daysLeft = wait ? Math.max(1, Math.ceil((wait.until - now) / DAY_MS)) : 0;
  const progressPct = wait ? Math.min(98, Math.max(5, Math.round(((now - wait.from) / (wait.until - wait.from)) * 100))) : 100;
  const rhLabel = donor.bloodGroup.endsWith("-") ? "RhD negative" : "RhD positive";

  return (
    <div className="space-y-6">
      {/* Contextual Banners (only when active) */}
      {justJoined ? (
        <div role="status" className="d-card flex items-start gap-3 border-[#BBF7D0] bg-[#ECFDF3] p-4">
          <PartyPopper className="mt-0.5 size-5 shrink-0 text-[#1F7A4D]" aria-hidden />
          <div>
            <p className="d-display text-sm font-bold text-[#171717]">You&apos;re in.</p>
            <p className="mt-0.5 text-xs text-[#525252]">Keep this screen open — an alert may arrive within a minute.</p>
          </div>
        </div>
      ) : null}

      {whatsappJoin?.waLink ? (
        <section aria-labelledby="wa-join-title" className="d-card-blush space-y-3 p-5">
          <div className="flex gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#FCEBED] text-[#C93245]">
              <MessageCircle className="size-4" aria-hidden />
            </span>
            <div>
              <h2 id="wa-join-title" className="d-display text-sm font-bold text-[#171717]">
                One last tap: confirm WhatsApp
              </h2>
              <p className="mt-0.5 text-xs text-[#737373]">
                Send the prefilled message to link your number. Reply STOP any time.
              </p>
            </div>
          </div>
          <a
            href={whatsappJoin.waLink}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ variant: "primary", size: "lg" }),
              "h-auto min-h-12 w-full rounded-xl bg-[#C93245] py-2.5 text-center whitespace-normal hover:bg-[#A82436]",
            )}
          >
            <MessageCircle className="size-4 shrink-0" aria-hidden />
            Open WhatsApp: say hi to Blood Bridge
          </a>
          <p className="text-center font-mono text-[11px] text-[#737373]">Message: {whatsappJoin.text}</p>
        </section>
      ) : null}

      {pending ? (
        <button
          type="button"
          onClick={() => onOpenAlert(pending.id)}
          className="focus-ring flex w-full items-center gap-3.5 rounded-2xl border border-[#C93245] bg-[#FFF5F5] p-4 text-left shadow-sm transition-colors hover:bg-[#FCEBED]"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#C93245] text-white">
            <BellRing className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="d-display text-sm font-bold text-[#171717]">
              {pending.bankName} needs {pending.bloodGroup}
            </p>
            <p className="text-xs text-[#737373]">Tap to respond · {pending.distanceKm.toFixed(1)} km away</p>
          </div>
          <span className="shrink-0 rounded-xl bg-[#C93245] px-4 py-2 text-xs font-bold text-white">Respond</span>
        </button>
      ) : null}

      {/* 1. CLEAN 4-KPI OVERVIEW ROW (mirrors Hospital Overview — zero giant red box collision) */}
      <section aria-label="Donor overview" className="grid grid-cols-2 gap-3.5 sm:gap-4 xl:grid-cols-4">
        {/* KPI 1: Eligibility Readiness */}
        <div className="d-card flex flex-col justify-between p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#737373]">Eligibility</span>
            <span
              className={cn(
                "grid size-8 place-items-center rounded-xl",
                waiting ? "bg-[#FCEBED] text-[#C93245]" : "bg-[#ECFDF3] text-[#1F7A4D]",
              )}
            >
              {waiting ? <CalendarClock className="size-4" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}
            </span>
          </div>
          <div className="mt-3">
            <p className={cn("d-display text-xl font-extrabold leading-tight", waiting ? "text-[#A82436]" : "text-[#171717]")}>
              {waiting ? `${daysLeft}d left` : "Ready now"}
            </p>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#F1ECE9]">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%`, backgroundColor: waiting ? "#C93245" : "#1F7A4D" }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-[#737373]">
              <span className="truncate">
                {waiting && donor.eligibleFrom ? `Due ${formatDate(donor.eligibleFrom)}` : `${intervalDays}-day interval`}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 2: Blood Group */}
        <div className="d-card flex flex-col justify-between p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#737373]">Blood group</span>
            <span className="grid size-8 place-items-center rounded-xl bg-[#FCEBED] text-[#C93245]">
              <Droplet className="size-4" aria-hidden />
            </span>
          </div>
          <div className="mt-3">
            <p className="d-num text-2xl font-extrabold leading-none text-[#A82436]">{donor.bloodGroup.replace("-", "−")}</p>
            <p className="mt-2 truncate text-[11px] text-[#737373]">
              {rhLabel} · {donor.donations.length > 0 ? "Verified" : "Self-declared"}
            </p>
          </div>
        </div>

        {/* KPI 3: Units Donated */}
        <div className="d-card flex flex-col justify-between p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#737373]">Units donated</span>
            <span className="grid size-8 place-items-center rounded-xl bg-[#FCEBED] text-[#C93245]">
              <Heart className="size-4" aria-hidden />
            </span>
          </div>
          <div className="mt-3">
            <p className="d-num text-2xl font-extrabold leading-none text-[#171717]">{donor.impact.unitsDonated}</p>
            <p className="mt-2 truncate text-[11px] text-[#737373]">
              {donor.lastDonationAt ? `Last ${formatDate(donor.lastDonationAt)}` : "No visits yet"}
            </p>
          </div>
        </div>

        {/* KPI 4: Alerts Supported */}
        <div className="d-card flex flex-col justify-between p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#737373]">Alerts answered</span>
            <span className="grid size-8 place-items-center rounded-xl bg-[#FAF9F6] text-[#737373] ring-1 ring-[#EAE6E3]">
              <BellRing className="size-4" aria-hidden />
            </span>
          </div>
          <div className="mt-3">
            <p className="d-num text-2xl font-extrabold leading-none text-[#171717]">{donor.impact.requestsSupported}</p>
            <p className="mt-2 truncate text-[11px] text-[#737373]">Cap {donor.maxAlertsPerWeek} alerts / week</p>
          </div>
        </div>
      </section>

      {/* Thumb-friendly full-width calendar reminder CTA when resting between donations */}
      {waiting && donor.eligibleFrom !== null ? (
        <ReminderButton
          donorId={donor.id}
          eligibleFrom={donor.eligibleFrom}
          className="min-h-12 w-full rounded-xl border-[#F2D7DB] bg-[#FFF5F5] text-sm font-bold text-[#A82436] hover:bg-[#FCEBED] sm:w-auto"
        />
      ) : null}

      {/* 2. SPACIOUS 2-COLUMN BENTO */}
      <div className="grid items-start gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <ImpactCard donor={donor} />
          <NearbyBanks donor={donor} />
        </div>

        <div className="lg:col-span-5">
          {donor.donations[0] ? (
            <section className="d-card p-5 sm:p-6" aria-label="Shareable donor certificate">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#FCEBED] text-[#C93245]">
                    <Award className="size-4" aria-hidden />
                  </span>
                  <div>
                    <h2 className="d-display text-sm font-bold text-[#171717]">Donation keepsake</h2>
                    <p className="text-[11px] text-[#737373]">Shareable PNG certificate</p>
                  </div>
                </div>
              </div>
              <DonorCard donor={donor} donation={donor.donations[0]} />
            </section>
          ) : (
            <section className="d-card p-6 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#FCEBED] text-[#C93245]">
                <HeartHandshake className="size-6" aria-hidden />
              </span>
              <h2 className="d-display mt-3 text-sm font-bold text-[#171717]">Your donor card awaits</h2>
              <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-[#737373]">
                After your first recorded donation, a shareable Blood Bridge certificate is generated automatically here.
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
