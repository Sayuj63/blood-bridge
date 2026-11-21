import { MessageCircle } from "lucide-react";
import { useId } from "react";
import type { ContactChannel } from "../../../../shared/domain";
import { SegmentedControl } from "../../../components/ui/SegmentedControl";
import { TextField } from "./fields";

export interface ContactDraft {
  channel: ContactChannel;
  phone: string;
  consent: boolean;
}

export const NO_CONTACT: ContactDraft = { channel: "none", phone: "", consent: false };

const OPTIONS = [
  { value: "none", label: "App only" },
  { value: "whatsapp", label: "WhatsApp" },
  // SMS is switched off for now (the code path stays; see docs/MESSAGING.md).
] as const satisfies readonly { value: ContactChannel; label: string }[];

const CHANNEL_NAME: Record<Exclude<ContactChannel, "none">, string> = { whatsapp: "WhatsApp", sms: "SMS" };

/**
 * Optional off-app alerts. Nothing is sent unless a channel is chosen AND the
 * consent box is ticked; the server enforces the same rule.
 */
export function ContactOptIn({
  value,
  onChange,
  errors,
}: {
  value: ContactDraft;
  onChange: (next: ContactDraft) => void;
  errors: { contactPhone?: string; contactConsent?: string };
}) {
  const consentId = useId();
  const errorId = useId();
  const on = value.channel !== "none";
  return (
    <div className="space-y-3 rounded-(--radius-panel) border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <MessageCircle className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
        <div>
          <p className="font-semibold text-ink">Also alert me on WhatsApp</p>
          <p className="text-sm text-ink-muted">Optional. Answer alerts by replying YES or NO, no app needed.</p>
        </div>
      </div>
      <SegmentedControl
        label="Alert channel"
        value={value.channel}
        onChange={(channel) => onChange({ ...value, channel, consent: channel === value.channel ? value.consent : false })}
        options={OPTIONS}
        className="flex w-full [&_button]:h-11 [&_button]:flex-1 [&_button]:text-base"
      />
      {on ? (
        <>
          <div data-field="contactPhone">
            <TextField
              label={`${CHANNEL_NAME[value.channel as "whatsapp" | "sms"]} number`}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+91 98200 12345"
              value={value.phone}
              onChange={(e) => onChange({ ...value, phone: e.target.value })}
              error={errors.contactPhone}
            />
          </div>
          <div data-field="contactConsent" className="space-y-1">
            <label htmlFor={consentId} className="flex cursor-pointer items-start gap-3 text-sm text-ink">
              <input
                id={consentId}
                type="checkbox"
                checked={value.consent}
                onChange={(e) => onChange({ ...value, consent: e.target.checked })}
                aria-invalid={Boolean(errors.contactConsent)}
                aria-describedby={errors.contactConsent ? errorId : undefined}
                className="focus-ring mt-0.5 size-5 shrink-0 accent-accent"
              />
              <span>
                I agree to receive blood-donation alerts from Blood Bridge on {CHANNEL_NAME[value.channel as "whatsapp" | "sms"]} at this
                number: at most 2 a week, only when my group is needed nearby. I can reply STOP at any time.
              </span>
            </label>
            {errors.contactConsent ? (
              <p id={errorId} className="text-sm font-medium text-critical">
                {errors.contactConsent}
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
