import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { HandHeart, HeartHandshake, MapPin, ShieldCheck, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import type { DonorAlertDTO, DonorDTO } from "../../../../shared/api";
import { COMPONENT_LABEL } from "../../../../shared/domain";
import { BloodGroupChip } from "../../../components/ui/BloodGroupChip";
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
 * Full-screen alert over the phone column. It follows the alert's live status:
 * incoming → "I can come" pass → thank-you once the bank records the donation,
 * or a warm "enough donors" note if the need is filled first.
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
          className="fixed inset-y-0 left-1/2 z-50 flex w-full max-w-[420px] -translate-x-1/2 flex-col bg-scrim"
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
            className="relative m-2 mt-[max(0.5rem,env(safe-area-inset-top))] mb-[max(0.5rem,env(safe-area-inset-bottom))] flex flex-1 flex-col overflow-y-auto rounded-(--radius-panel) bg-canvas shadow-panel outline-none"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 48, scale: 0.94 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
            transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 28 }}
          >
            <Button variant="ghost" size="icon" className="absolute top-2 right-2 z-10 size-11" aria-label={alert.status === "sent" ? "Decide later" : "Close"} onClick={onClose}>
              <X className="size-5" aria-hidden />
            </Button>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={alert.status}
                className="flex flex-1 flex-col px-5 pt-6 pb-5"
                initial={reduce ? false : { opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: -24 }}
                transition={{ duration: reduce ? 0 : 0.22 }}
              >
                {alert.status === "sent" ? (
                  <Incoming alert={alert} donor={donor} responding={responding} onRespond={onRespond} />
                ) : alert.status === "accepted" ? (
                  <Screen
                    icon={<HandHeart className="size-7" aria-hidden />}
                    title={`Thank you, ${firstName(donor.name)}. See you soon.`}
                    description={`${alert.bankName} now has your name and phone, so they know you're coming.`}
                    action={<Button variant="secondary" size="lg" className="w-full" onClick={onClose}>Done</Button>}
                  >
                    <VisitPass alert={alert} />
                  </Screen>
                ) : alert.status === "arrived" ? (
                  <Screen
                    tone="ok"
                    icon={<HeartHandshake className="size-7" aria-hidden />}
                    title="Donation complete. Thank you!"
                    description={`${alert.bankName} has recorded your donation. Rest up, drink some water, and enjoy the rest of your day.`}
                    action={<Button variant="primary" size="lg" className="w-full" onClick={onClose}>Back to home</Button>}
                  >
                    {donor.eligibleFrom ? (
                      <p className="rounded-(--radius-panel) bg-surface-2 p-4 text-center text-ink">
                        You'll be eligible again on
                        <span className="mt-1 block font-numeric text-xl font-bold">{formatDate(donor.eligibleFrom)}</span>
                        <span className="mt-1 block text-sm text-ink-muted">We won't send you alerts before then.</span>
                      </p>
                    ) : null}
                  </Screen>
                ) : (
                  <Screen
                    tone="ok"
                    icon={<HeartHandshake className="size-7" aria-hidden />}
                    title="Enough donors are on their way"
                    description={`Thank you for being ready to help. ${alert.bankName} has the donors it needs for now, so there's no need to go.`}
                    action={<Button variant="primary" size="lg" className="w-full" onClick={onClose}>Okay</Button>}
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
      <span className={tone === "ok" ? "grid size-14 place-items-center rounded-full bg-ok-soft text-ok" : "grid size-14 place-items-center rounded-full bg-accent/10 text-accent"}>
        {icon}
      </span>
      <h2 id="takeover-title" className="mt-4 pr-8 font-display text-2xl leading-tight text-ink">
        {title}
      </h2>
      <p id="takeover-desc" className="mt-2 text-ink-muted">
        {description}
      </p>
      {children ? <div className="mt-5">{children}</div> : null}
      <div className="mt-auto pt-6">{action}</div>
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
      <div className="flex items-center gap-2 pr-10">
        <UrgencyTag urgency={alert.urgency} size="lg" />
        <span className="font-label text-sm text-ink-muted">{URGENCY_COPY[alert.urgency]}</span>
      </div>
      <div className="mt-5 flex items-center gap-4">
        <span className="relative grid place-items-center">
          <span aria-hidden className="absolute inset-0 animate-pulse-ring rounded-(--radius-chip) bg-accent/25" />
          <BloodGroupChip group={alert.bloodGroup} variant="label" size="xl" className="relative" />
        </span>
        <div className="min-w-0">
          <h2 id="takeover-title" className="font-display text-2xl leading-tight text-ink">
            Your blood group is needed nearby
          </h2>
          <p className="mt-1 text-sm text-ink-muted">{COMPONENT_LABEL[alert.component]}</p>
        </div>
      </div>
      <p id="takeover-desc" className="mt-5 flex items-start gap-2 text-ink">
        <MapPin className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
        <span>
          <span className="font-semibold">{alert.bankName}</span>
          <span className="block text-sm text-ink-muted">
            <span className="font-numeric">{alert.distanceKm.toFixed(1)} km</span> from {donor.areaName}
          </span>
        </span>
      </p>
      <div className="mt-4">
        <AlertMessage alert={alert} />
      </div>
      <p className="mt-4 flex gap-2 text-sm text-ink-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
        No patient details are shared with you. The bank sees your name and phone only if you tap “I can come”.
      </p>
      <div className="mt-auto grid gap-2 pt-6">
        <Button variant="primary" size="xl" className="w-full" loading={responding} onClick={() => onRespond(alert.id, "accept")}>
          I can come
        </Button>
        <Button variant="secondary" size="lg" className="w-full" disabled={responding} onClick={() => onRespond(alert.id, "decline")}>
          Not now
        </Button>
      </div>
    </>
  );
}
