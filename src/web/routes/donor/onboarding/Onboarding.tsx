import { ArrowLeft, Droplet, FlaskConical, ShieldCheck } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import type { DonorSignupDTO } from "../../../../shared/api";
import type { BloodGroup, Language } from "../../../../shared/domain";
import { Button } from "../../../components/ui/Button";
import { ErrorState } from "../../../components/ui/EmptyState";
import { SkeletonRows } from "../../../components/ui/Skeleton";
import { errorMessage } from "../../../lib/api";
import { cn } from "../../../lib/cn";
import { useMeta } from "../../../lib/queries";
import { ConsentList, type ConsentValues } from "../ConsentSwitch";
import { PRIVACY_PROMISE } from "../copy";
import { useSignup } from "../data";
import { ContactOptIn, NO_CONTACT, type ContactDraft } from "./ContactOptIn";
import { AreaSelect, BloodGroupPicker, LanguagePicker, TextField } from "./fields";

/**
 * `full` — "Become a donor": every field, consents default off.
 * `quick` — the stage QR join for judges: three fast steps, consents default on (still switchable).
 */
export type OnboardingMode = "full" | "quick";

type FieldKey = "name" | "phone" | "bloodGroup" | "areaId" | "contactPhone" | "contactConsent";
type Step = "details" | "name" | "group" | "consent";

const STEPS: Record<OnboardingMode, readonly Step[]> = {
  full: ["details", "consent"],
  quick: ["name", "group", "consent"],
};

const STEP_FIELDS: Record<Step, readonly FieldKey[]> = {
  details: ["name", "phone", "bloodGroup", "areaId"],
  name: ["name"],
  group: ["bloodGroup", "areaId"],
  consent: ["contactPhone", "contactConsent"],
};

const PHONE_PATTERN = /^[+\d][\d\s-]{6,18}$/;
/**
 * Quick join skips the phone so it fits in 20 seconds. A clearly fake number
 * keeps the record valid; the bank sees it only if this demo donor taps "I can come".
 */
const DEMO_PHONE = "+91 00000 00000";

interface Draft {
  name: string;
  phone: string;
  bloodGroup: BloodGroup | null;
  areaId: string;
  language: Language;
  lastDonation: string;
  consents: ConsentValues;
  contact: ContactDraft;
}

function fieldError(key: FieldKey, draft: Draft): string | undefined {
  switch (key) {
    case "name":
      return draft.name.trim().length >= 2 ? undefined : "Please enter your name (at least 2 letters).";
    case "phone":
      return PHONE_PATTERN.test(draft.phone.trim()) ? undefined : "Enter a valid phone number, e.g. +91 98200 12345.";
    case "bloodGroup":
      return draft.bloodGroup ? undefined : "Choose your blood group.";
    case "areaId":
      return draft.areaId ? undefined : "Choose your neighbourhood.";
    case "contactPhone":
      return draft.contact.channel === "none" || PHONE_PATTERN.test(draft.contact.phone.trim())
        ? undefined
        : "Enter the number to alert, e.g. +91 98200 12345.";
    case "contactConsent":
      return draft.contact.channel === "none" || draft.contact.consent ? undefined : "Tick the box to get alerts on this number.";
  }
}

/** Date input value → epoch ms at midday IST, so the calendar day never shifts by timezone. */
const dateToMs = (value: string): number | null => (value ? Date.parse(`${value}T12:00:00+05:30`) : null);

const todayIso = (): string => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);

export function Onboarding({
  mode,
  onDone,
  onCancel,
}: {
  mode: OnboardingMode;
  onDone: (donor: DonorSignupDTO) => void;
  onCancel?: () => void;
}) {
  const meta = useMeta();
  const signup = useSignup();
  const steps = STEPS[mode];
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [draft, setDraft] = useState<Draft>(() => {
    const on = mode === "quick";
    return {
      name: "",
      phone: "",
      bloodGroup: null,
      areaId: "",
      language: "en",
      lastDonation: "",
      consents: { consentAlerts: on, consentLocation: on, consentEligibility: on },
      contact: NO_CONTACT,
    };
  });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const step = steps[stepIndex];
  const last = stepIndex === steps.length - 1;

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const goTo = (index: number) => {
    setStepIndex(index);
    window.scrollTo({ top: 0 });
    // Move focus to the new step's heading so screen readers hear where they are.
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const submit = () => {
    if (!draft.bloodGroup) return;
    const contact = draft.contact.channel === "none" ? null : draft.contact;
    signup.mutate(
      {
        name: draft.name.trim(),
        // A donor who gives a WhatsApp/SMS number in quick join gets it as their contact phone too.
        phone: mode === "quick" ? (contact?.phone.trim() ?? DEMO_PHONE) : draft.phone.trim(),
        bloodGroup: draft.bloodGroup,
        areaId: draft.areaId,
        language: draft.language,
        ...draft.consents,
        lastDonationAt: mode === "quick" ? null : dateToMs(draft.lastDonation),
        ...(contact ? { contactChannel: contact.channel, contactPhone: contact.phone.trim(), contactConsent: contact.consent } : {}),
      },
      { onSuccess: onDone },
    );
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const found = Object.fromEntries(
      STEP_FIELDS[step].map((k) => [k, fieldError(k, draft)]).filter(([, msg]) => msg !== undefined),
    ) as Partial<Record<FieldKey, string>>;
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const first = Object.keys(found)[0];
      document.querySelector<HTMLElement>(`[data-field="${first}"] input, [data-field="${first}"] select, [data-field="${first}"] button`)?.focus();
      return;
    }
    if (last) submit();
    else goTo(stepIndex + 1);
  };

  const title =
    step === "consent"
      ? "You decide what's shared"
      : mode === "quick"
        ? step === "name"
          ? "Become a donor in 20 seconds"
          : "Your blood group and area"
        : "Become a donor";

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-1 flex-col gap-4">
      {/* Top Progress Bar */}
      <div className="flex items-center gap-2">
        {stepIndex > 0 || onCancel ? (
          <button
            type="button"
            aria-label={stepIndex > 0 ? "Back" : "Cancel sign-up"}
            onClick={() => (stepIndex > 0 ? goTo(stepIndex - 1) : onCancel?.())}
            className="focus-ring grid size-11 touch-manipulation place-items-center rounded-xl border border-[#EAE6E3] bg-white text-[#171717] transition-colors hover:bg-[#FFF5F5] hover:text-[#A82436]"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </button>
        ) : null}
        <p className="d-num text-xs font-bold uppercase tracking-wider text-[#737373]" aria-live="polite">
          Step {stepIndex + 1} of {steps.length}
        </p>
        <ol className="ml-auto flex gap-1.5" aria-hidden>
          {steps.map((s, i) => (
            <li
              key={s}
              className={cn(
                "h-2 rounded-full transition-all",
                i <= stepIndex ? "w-7 bg-[#C93245]" : "w-5 bg-[#F4D3D8]",
              )}
            />
          ))}
        </ol>
      </div>

      {/* Luminous Crimson Step Header */}
      <div className="d-hero-crimson p-5">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#FCEBED]">
          <Droplet className="size-4" aria-hidden />
          <span>Blood Bridge Mumbai</span>
        </div>
        <h1 ref={headingRef} tabIndex={-1} className="d-display mt-2 text-2xl font-bold leading-tight text-white outline-none">
          {title}
        </h1>
        {mode === "quick" ? (
          <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/18 px-3 py-1 text-[11px] font-semibold text-white ring-1 ring-white/20">
            <FlaskConical className="size-3.5 shrink-0" aria-hidden />
            Demo donor profile · simulated, deleted on reset
          </span>
        ) : (
          <p className="mt-1.5 text-xs text-[#FCEBED]/90">
            Voluntary, privacy-first alerts only when your blood group is genuinely short nearby.
          </p>
        )}
      </div>

      {step === "consent" ? (
        <ConsentStep
          draft={draft}
          mode={mode}
          errors={errors}
          onChange={(consents) => update("consents", consents)}
          onContactChange={(contact) => {
            update("contact", contact);
            setErrors((e) => ({ ...e, contactPhone: undefined, contactConsent: undefined }));
          }}
        />
      ) : meta.isPending && (step === "details" || step === "group") ? (
        <div className="d-card p-4">
          <SkeletonRows rows={4} />
        </div>
      ) : meta.isError ? (
        <div className="d-card p-4">
          <ErrorState what="the list of areas" error={meta.error} onRetry={() => void meta.refetch()} compact />
        </div>
      ) : (
        <div className="d-card space-y-5 p-4 sm:p-5">
          {step === "details" || step === "name" ? (
            <div data-field="name">
              <TextField
                label={mode === "quick" ? "Your first name" : "Your name"}
                autoComplete={mode === "quick" ? "given-name" : "name"}
                autoFocus={mode === "quick"}
                enterKeyHint="next"
                placeholder={mode === "quick" ? "e.g. Meera" : "Full name"}
                value={draft.name}
                onChange={(e) => update("name", e.target.value)}
                error={errors.name}
                maxLength={60}
              />
            </div>
          ) : null}
          {step === "details" ? (
            <div data-field="phone">
              <TextField
                label="Phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+91 98200 12345"
                hint="Shared with a blood bank only after you tap “I can come”."
                value={draft.phone}
                onChange={(e) => update("phone", e.target.value)}
                error={errors.phone}
              />
            </div>
          ) : null}
          {step === "details" || step === "name" ? (
            <LanguagePicker value={draft.language} onChange={(l) => update("language", l)} />
          ) : null}
          {step === "details" || step === "group" ? (
            <>
              <div data-field="bloodGroup">
                <BloodGroupPicker value={draft.bloodGroup} onChange={(g) => update("bloodGroup", g)} error={errors.bloodGroup} />
              </div>
              <div data-field="areaId">
                <AreaSelect areas={meta.data?.areas ?? []} value={draft.areaId} onChange={(a) => update("areaId", a)} error={errors.areaId} />
              </div>
            </>
          ) : null}
          {step === "details" ? (
            <TextField
              label="Last donation (optional)"
              type="date"
              max={todayIso()}
              hint="Leave blank if you've never donated or don't remember."
              value={draft.lastDonation}
              onChange={(e) => update("lastDonation", e.target.value)}
            />
          ) : null}
        </div>
      )}

      {signup.isError ? (
        <p role="alert" className="rounded-xl border border-[#F2D7DB] bg-[#FCEBED] px-3.5 py-2.5 text-sm font-medium text-[#A82436]">
          Couldn&apos;t create your profile. {errorMessage(signup.error)}
        </p>
      ) : null}

      <div className="sticky bottom-0 mt-auto -mx-4 border-t border-[#EAE6E3] bg-[#FAF9F6]/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur sm:-mx-6 sm:px-6">
        <Button
          type="submit"
          variant="primary"
          size="xl"
          className="w-full rounded-xl bg-[#C93245] font-bold hover:bg-[#A82436]"
          loading={signup.isPending}
        >
          {last ? (mode === "quick" ? "Join as a donor" : "Create my donor profile") : "Continue"}
        </Button>
      </div>
    </form>
  );
}

function ConsentStep({
  draft,
  mode,
  errors,
  onChange,
  onContactChange,
}: {
  draft: Draft;
  mode: OnboardingMode;
  errors: Partial<Record<FieldKey, string>>;
  onChange: (c: ConsentValues) => void;
  onContactChange: (c: ContactDraft) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-[#737373]">
        {mode === "quick"
          ? "These are on so the demo alert can reach you. Each one is explained below; switch off anything you're not comfortable with."
          : "Three separate choices. Turn on only what you're comfortable with; you can change them any time in Settings."}
      </p>
      <div className="d-card px-4 py-1">
        <ConsentList values={draft.consents} onChange={(key, next) => onChange({ ...draft.consents, [key]: next })} />
      </div>
      <ContactOptIn value={draft.contact} onChange={onContactChange} errors={errors} />
      <div className="flex gap-3 rounded-2xl bg-[#ECFDF3] p-4 text-xs leading-relaxed text-[#15803D]">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>{PRIVACY_PROMISE}</p>
      </div>
    </div>
  );
}
