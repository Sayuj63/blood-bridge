import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { HandHeart, HeartHandshake, MapPin, ShieldCheck, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import type { DonorAlertDTO, DonorDTO } from "../../../../shared/api";
import { COMPONENT_LABEL } from "../../../../shared/domain";
import { Button } from "../../../components/ui/Button";
import { UrgencyTag } from "../../../components/ui/UrgencyTag";
import { URGENCY_COPY, firstName, formatDate } from "../copy";
import { AlertMessage } from "./AlertMessage";
import { VisitPass } from "./VisitPass";

interface AlertTakeoverProps {
  alert: DonorAlertDTO | null;
  donor: DonorDTO;
  responding: boolean;
  onRespond: (alertId: string, response: "accept" | "decline") => void;
  onClose: () => void;
}

/**
 * Full-screen alert modal centered cleanly for mobile & desktop. Follows the alert's
 * live status: incoming → "I can come" visit pass → thank-you once the bank records
 * the donation, or a warm "enough donors" note if the need is filled first.
 */
export function AlertTakeover({ alert, donor, responding, onRespond, onClose }: AlertTakeoverProps) {
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const open = alert !== null;

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {alert ? (
        <motion.div
          key="takeover"
          className="donor-theme fixed inset-0 z-50 flex items-stretch justify-center bg-[#171717]/55 p-2 backdrop-blur-[3px] sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.2 }}
        >
          <motion.div
            ref={panelRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="takeover-title"
            aria-describedby="takeover-desc"
            tabIndex={-1}
            className="relative mt-[env(safe-area-inset-top)] mb-[env(safe-area-inset-bottom)] flex max-h-[min(92dvh,760px)] w-full max-w-[440px] flex-col overflow-y-auto rounded-2xl border border-[#EAE6E3] bg-[#FAF9F6] shadow-2xl outline-none"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 36, scale: 0.95 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.97 }}
            transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 340, damping: 28 }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label={alert.status === "sent" ? "Decide later" : "Close"}
              className="focus-ring absolute top-3 right-3 z-20 grid size-11 touch-manipulation place-items-center rounded-full bg-white/95 text-[#171717] shadow-xs ring-1 ring-[#EAE6E3] transition-colors hover:bg-[#FCEBED] hover:text-[#A82436]"
            >
              <X className="size-4" aria-hidden />
            </button>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={alert.status}
                className="flex flex-1 flex-col p-5"
                initial={reduce ? false : { opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: -20 }}
                transition={{ duration: reduce ? 0 : 0.2 }}
              >
                {alert.status === "sent" ? (
                  <Incoming alert={alert} donor={donor} responding={responding} onRespond={onRespond} />
                ) : alert.status === "accepted" ? (
                  <Screen
                    icon={<HandHeart className="size-6" aria-hidden />}
                    title={`Thank you, ${firstName(donor.name)}. See you soon.`}
                    description={`${alert.bankName} now has your name and phone, so they know you're coming.`}
                    action={
                      <Button variant="secondary" size="lg" className="w-full rounded-xl" onClick={onClose}>
                        Done
                      </Button>
                    }
                  >
                    <VisitPass alert={alert} />
                  </Screen>
                ) : alert.status === "arrived" ? (
                  <Screen
                    tone="ok"
                    icon={<HeartHandshake className="size-6" aria-hidden />}
                    title="Donation complete. Thank you!"
                    description={`${alert.bankName} has recorded your donation. Rest up, drink some water, and enjoy the rest of your day.`}
                    action={
                      <Button variant="primary" size="lg" className="w-full rounded-xl bg-[#C93245] hover:bg-[#A82436]" onClick={onClose}>
                        Back to home
                      </Button>
                    }
                  >
                    {donor.eligibleFrom ? (
                      <div className="d-card-blush p-4 text-center">
                        <p className="text-xs font-medium text-[#737373]">You&apos;ll be eligible again on</p>
                        <p className="d-num mt-1 text-xl font-extrabold text-[#A82436]">{formatDate(donor.eligibleFrom)}</p>
                        <p className="mt-1 text-xs text-[#737373]">We won&apos;t send you alerts before then.</p>
                      </div>
                    ) : null}
                  </Screen>
                ) : (
                  <Screen
                    tone="ok"
                    icon={<HeartHandshake className="size-6" aria-hidden />}
                    title="Enough donors are on their way"
                    description={`Thank you for being ready to help. ${alert.bankName} has the donors it needs for now, so there's no need to go.`}
                    action={
                      <Button variant="primary" size="lg" className="w-full rounded-xl bg-[#C93245] hover:bg-[#A82436]" onClick={onClose}>
                        Okay
                      </Button>
                    }
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Screen({
  icon,
  title,
  description,
  action,
  children,
  tone = "accent",
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action: ReactNode;
  children?: ReactNode;
  tone?: "accent" | "ok";
}) {
  return (
    <>
      <span
        className={
          tone === "ok"
            ? "grid size-13 place-items-center rounded-2xl bg-[#ECFDF3] text-[#15803D]"
            : "grid size-13 place-items-center rounded-2xl bg-[#FCEBED] text-[#C93245]"
        }
      >
        {icon}
      </span>
      <h2 id="takeover-title" className="d-display mt-4 pr-10 text-xl font-bold leading-snug text-[#171717]">
        {title}
      </h2>
      <p id="takeover-desc" className="mt-1.5 text-sm leading-relaxed text-[#737373]">
        {description}
      </p>
      {children ? <div className="mt-4">{children}</div> : null}
      <div className="mt-auto pt-5">{action}</div>
    </>
  );
}

function Incoming({
  alert,
  donor,
  responding,
  onRespond,
}: {
  alert: DonorAlertDTO;
  donor: DonorDTO;
  responding: boolean;
  onRespond: (alertId: string, response: "accept" | "decline") => void;
}) {
  return (
    <>
      {/* Crimson Header Strip */}
      <div className="d-hero-crimson p-4 pr-12">
        <div className="flex flex-wrap items-center gap-2">
          <UrgencyTag urgency={alert.urgency} size="sm" />
          <span className="text-xs font-semibold text-[#FCEBED]">{URGENCY_COPY[alert.urgency]}</span>
        </div>
        <div className="mt-3.5 flex items-center gap-3.5">
          <span className="relative grid shrink-0 place-items-center">
            <span aria-hidden className="absolute inset-0 animate-pulse-ring rounded-2xl bg-white/30" />
            <span className="d-num relative grid size-14 place-items-center rounded-2xl bg-white text-xl font-extrabold text-[#A82436] shadow-sm">
              {alert.bloodGroup.replace("-", "−")}
            </span>
          </span>
          <div className="min-w-0">
            <h2 id="takeover-title" className="d-display text-lg font-bold leading-snug text-white">
              Your blood group is needed nearby
            </h2>
            <p className="mt-0.5 text-xs font-medium text-[#FCEBED]">{COMPONENT_LABEL[alert.component]}</p>
          </div>
        </div>
      </div>

      {/* Bank Distance Row */}
      <div id="takeover-desc" className="d-card mt-4 flex items-start gap-3 p-3.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#FCEBED] text-[#C93245]">
          <MapPin className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#171717]">{alert.bankName}</p>
          <p className="mt-0.5 text-xs text-[#737373]">
            <span className="d-num font-bold text-[#A82436]">{alert.distanceKm.toFixed(1)} km</span> from {donor.areaName}
          </p>
        </div>
      </div>

      <div className="mt-3.5">
        <AlertMessage alert={alert} />
      </div>

      <p className="mt-3.5 flex items-start gap-2 rounded-xl bg-[#ECFDF3] px-3.5 py-2.5 text-xs leading-relaxed text-[#15803D]">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>No patient details are shared. The bank sees your name and phone only if you tap &ldquo;I can come&rdquo;.</span>
      </p>

      <div className="mt-auto grid gap-2 pt-5">
        <Button
          variant="primary"
          size="xl"
          className="w-full rounded-xl bg-[#C93245] font-bold hover:bg-[#A82436]"
          loading={responding}
          onClick={() => onRespond(alert.id, "accept")}
        >
          I can come
        </Button>
        <Button
          variant="secondary"
          size="lg"
          className="w-full rounded-xl border-[#EAE6E3] bg-white text-[#171717] hover:bg-[#FFF5F5]"
          disabled={responding}
          onClick={() => onRespond(alert.id, "decline")}
        >
          Not now
        </Button>
      </div>
    </>
  );
}
