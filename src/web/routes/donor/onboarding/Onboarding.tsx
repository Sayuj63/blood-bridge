import { ArrowLeft, FlaskConical, ShieldCheck } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import type { DonorDTO } from "../../../../shared/api";
import type { BloodGroup, Language } from "../../../../shared/domain";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
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
  onDone: (donor: DonorDTO) => void;
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
    <form onSubmit={onSubmit} noValidate className="flex flex-1 flex-col gap-5">
      <div className="flex items-center gap-2">
        {stepIndex > 0 || onCancel ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label={stepIndex > 0 ? "Back" : "Cancel sign-up"}
            onClick={() => (stepIndex > 0 ? goTo(stepIndex - 1) : onCancel?.())}
          >
            <ArrowLeft className="size-5" aria-hidden />
          </Button>
        ) : null}
        <p className="font-label text-sm text-ink-muted" aria-live="polite">
          Step {stepIndex + 1} of {steps.length}
        </p>
        <ol className="ml-auto flex gap-1.5" aria-hidden>
          {steps.map((s, i) => (
            <li key={s} className={cn("h-1.5 w-6 rounded-full", i <= stepIndex ? "bg-accent" : "bg-surface-3")} />
          ))}
        </ol>
      </div>

      <div>
        <h1 ref={headingRef} tabIndex={-1} className="font-display text-2xl leading-tight text-ink outline-none">
          {title}
        </h1>
        {mode === "quick" ? (
          <Badge tone="warn" outline className="mt-2 h-auto py-1 whitespace-normal">
            <FlaskConical className="size-3.5 shrink-0" aria-hidden />
            Demo donor profile: simulated, deleted on reset
          </Badge>
        ) : null}
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
        <SkeletonRows rows={4} />
      ) : meta.isError ? (
        <ErrorState what="the list of areas" error={meta.error} onRetry={() => void meta.refetch()} compact />
      ) : (
        <div className="space-y-5">
          {step === "details" || step === "name" ? (
            <div data-field="name">
              <TextField
                label={mode === "quick" ? "Your first name" : "Your name"}
                autoComplete={mode === "quick" ? "given-name" : "name"}
                autoFocus={mode === "quick"}
                enterKeyHint="next"
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
        <p role="alert" className="rounded-(--radius-control) bg-critical-soft px-3 py-2 text-sm text-critical">
          Couldn't create your profile. {errorMessage(signup.error)}
        </p>
      ) : null}

      <div className="sticky bottom-0 mt-auto -mx-4 border-t border-line bg-canvas/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
        <Button type="submit" variant="primary" size="xl" className="w-full" loading={signup.isPending}>
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
      <p className="text-ink-muted">
        {mode === "quick"
          ? "These are on so the demo alert can reach you. Each one is explained below; switch off anything you're not comfortable with."
          : "Three separate choices. Turn on only what you're comfortable with; you can change them any time in Settings."}
      </p>
      <Card className="px-4 py-1">
        <ConsentList values={draft.consents} onChange={(key, next) => onChange({ ...draft.consents, [key]: next })} />
      </Card>
      <ContactOptIn value={draft.contact} onChange={onContactChange} errors={errors} />
      <div className="flex gap-3 rounded-(--radius-panel) bg-ok-soft p-4 text-sm text-ink">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden />
        <p>{PRIVACY_PROMISE}</p>
      </div>
    </div>
  );
}
