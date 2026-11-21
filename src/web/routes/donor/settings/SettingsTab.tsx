import { BadgeCheck, Bell, Globe, LogOut, MapPin, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import type { DonorDTO } from "../../../../shared/api";
import { LANGUAGES, LANGUAGE_LABEL } from "../../../../shared/domain";
import { Button } from "../../../components/ui/Button";
import { Dialog } from "../../../components/ui/Dialog";
import { cn } from "../../../lib/cn";
import { ConsentList } from "../ConsentSwitch";
import { PRIVACY_PROMISE } from "../copy";
import { useOptOut, useUpdatePreferences } from "../data";
import { QuietHours } from "./QuietHours";

const WEEKLY_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;

export function SettingsTab({ donor }: { donor: DonorDTO }) {
  const update = useUpdatePreferences(donor.id);
  const optOut = useOptOut(donor.id);
  const [confirming, setConfirming] = useState(false);

  const consentCount = [donor.consentAlerts, donor.consentLocation, donor.consentEligibility].filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Clean Page Title + Compact Profile Summary Card */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="d-display text-lg font-bold text-[#171717]">Donor Preferences</h2>
          <p className="text-xs text-[#737373]">Control your privacy consents, quiet hours, weekly alert cap, and language.</p>
        </div>
        <span className="d-num inline-flex items-center gap-1.5 rounded-full bg-[#FCEBED] px-3 py-1 text-xs font-bold text-[#A82436]">
          <BadgeCheck className="size-3.5" aria-hidden />
          {donor.donations.length === 0 ? "Self-declared group" : "Verified donor"} · {consentCount}/3 consents on
        </span>
      </div>

      {/* Compact Profile Strip */}
      <section className="d-card flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
        <div className="flex items-center gap-3.5">
          <span className="d-num grid size-12 shrink-0 place-items-center rounded-xl bg-[#FCEBED] text-lg font-extrabold text-[#A82436]">
            {donor.bloodGroup.replace("-", "−")}
          </span>
          <div className="min-w-0">
            <p className="d-display truncate text-sm font-bold text-[#171717]">{donor.name}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[#737373]">
              <span className="d-num">{donor.phone}</span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3 text-[#C93245]" aria-hidden />
                {donor.areaName}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="block text-[11px] text-[#737373]">Weekly cap</span>
            <span className="d-num font-bold text-[#171717]">{donor.maxAlertsPerWeek} / week</span>
          </div>
          <div className="h-7 w-px bg-[#EAE6E3]" aria-hidden />
          <div>
            <span className="block text-[11px] text-[#737373]">Language</span>
            <span className="font-bold text-[#171717]">{LANGUAGE_LABEL[donor.language]}</span>
          </div>
        </div>
      </section>

      {/* Spacious 2-col desktop / 1-col mobile bento */}
      <div className="grid items-start gap-6 lg:grid-cols-12">
        {/* Left Column: Privacy Consents + Language */}
        <div className="space-y-6 lg:col-span-6">
          <section aria-labelledby="share-title" className="d-card p-5 sm:p-6">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-xl bg-[#FCEBED] text-[#C93245]">
                <ShieldCheck className="size-4" aria-hidden />
              </span>
              <div>
                <h3 id="share-title" className="d-display text-sm font-bold text-[#171717]">
                  What you share
                </h3>
                <p className="text-[11px] text-[#737373]">Changes apply immediately</p>
              </div>
            </div>

            <div className="mt-4">
              <ConsentList values={donor} onChange={(key, next) => update.mutate({ [key]: next })} />
            </div>

            <p className="mt-4 flex items-start gap-2.5 rounded-xl bg-[#ECFDF3] p-3.5 text-xs leading-relaxed text-[#1F7A4D]">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{PRIVACY_PROMISE}</span>
            </p>
          </section>

          <section aria-labelledby="lang-title" className="d-card p-5 sm:p-6">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-xl bg-[#FCEBED] text-[#C93245]">
                <Globe className="size-4" aria-hidden />
              </span>
              <div>
                <h3 id="lang-title" className="d-display text-sm font-bold text-[#171717]">
                  Alert language
                </h3>
                <p className="text-[11px] text-[#737373]">Translated by an open model; English is always one tap away.</p>
              </div>
            </div>
            <div role="radiogroup" aria-labelledby="lang-title" className="mt-4 grid grid-cols-3 gap-2">
              {LANGUAGES.map((l) => {
                const active = donor.language === l;
                return (
                  <button
                    key={l}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => update.mutate({ language: l })}
                    className={cn(
                      "focus-ring flex min-h-12 touch-manipulation items-center justify-center rounded-xl border text-sm font-bold transition-all active:scale-[0.98]",
                      active
                        ? "border-[#C93245] bg-[#C93245] text-white shadow-xs"
                        : "border-[#EAE6E3] bg-[#FAF9F6] text-[#171717] hover:border-[#F2D7DB] hover:bg-[#FFF5F5]",
                    )}
                  >
                    {LANGUAGE_LABEL[l]}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right Column: Reachability & Opt-out */}
        <div className="space-y-6 lg:col-span-6">
          <section aria-labelledby="reach-pref-title" className="d-card p-5 sm:p-6">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-xl bg-[#FCEBED] text-[#C93245]">
                <SlidersHorizontal className="size-4" aria-hidden />
              </span>
              <div>
                <h3 id="reach-pref-title" className="d-display text-sm font-bold text-[#171717]">
                  When we can reach you
                </h3>
                <p className="text-[11px] text-[#737373]">Quiet hours and weekly alert cap</p>
              </div>
            </div>

            <div className="mt-4 space-y-5">
              <QuietHours
                start={donor.quietHoursStart}
                end={donor.quietHoursEnd}
                onChange={(quietHoursStart, quietHoursEnd) => update.mutate({ quietHoursStart, quietHoursEnd })}
              />

              <div className="border-t border-[#EAE6E3] pt-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-[#171717]" id="weekly-label">
                    <Bell className="size-3.5 text-[#C93245]" aria-hidden />
                    At most {donor.maxAlertsPerWeek} {donor.maxAlertsPerWeek === 1 ? "alert" : "alerts"} a week
                  </p>
                  <span className="d-num rounded-full bg-[#FCEBED] px-2 py-0.5 text-[11px] font-bold text-[#A82436]">
                    Hard cap
                  </span>
                </div>
                <div role="radiogroup" aria-labelledby="weekly-label" className="mt-3 grid grid-cols-7 gap-1 sm:gap-1.5">
                  {WEEKLY_OPTIONS.map((n) => {
                    const active = donor.maxAlertsPerWeek === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={`${n} ${n === 1 ? "alert" : "alerts"} per week`}
                        onClick={() => update.mutate({ maxAlertsPerWeek: n })}
                        className={cn(
                          "d-num focus-ring flex h-12 touch-manipulation items-center justify-center rounded-xl border text-sm font-extrabold transition-all active:scale-95",
                          active
                            ? "border-[#C93245] bg-[#C93245] text-white shadow-xs"
                            : "border-[#EAE6E3] bg-[#FAF9F6] text-[#171717] hover:border-[#F2D7DB] hover:bg-[#FFF5F5]",
                        )}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2.5 text-xs text-[#737373]">Even in a shortage, we never exceed your weekly limit.</p>
              </div>
            </div>
          </section>

          <section aria-labelledby="optout-title" className="d-card-blush p-5 sm:p-6">
            <h3 id="optout-title" className="d-display text-sm font-bold text-[#A82436]">
              Opt out of everything
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-[#737373]">
              Stop all alerts and sharing at once. Your donation history stays safe, and you can opt back in any time.
            </p>
            <Button
              variant="danger"
              size="lg"
              className="mt-4 w-full rounded-xl"
              icon={<LogOut className="size-4" aria-hidden />}
              onClick={() => setConfirming(true)}
            >
              Opt out of everything
            </Button>
          </section>
        </div>
      </div>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        side="bottom"
        title="Opt out of everything?"
        description="We'll switch off alerts, location and eligibility sharing, and withdraw any alert still waiting for you."
        className="sm:left-1/2 sm:max-w-[440px] sm:-translate-x-1/2"
        footer={
          <>
            <Button size="lg" className="rounded-xl" onClick={() => setConfirming(false)}>
              Keep my settings
            </Button>
            <Button
              variant="danger"
              size="lg"
              className="rounded-xl"
              loading={optOut.isPending}
              onClick={() => optOut.mutate(true, { onSuccess: () => setConfirming(false) })}
            >
              Opt out
            </Button>
          </>
        }
      />
    </div>
  );
}
