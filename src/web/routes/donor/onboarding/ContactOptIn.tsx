import { MessageCircle } from "lucide-react";
import { useId } from "react";
import type { ContactChannel } from "../../../../shared/domain";
import { cn } from "../../../lib/cn";
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
  const groupId = useId();
  const on = value.channel !== "none";
  return (
    <div className="d-card space-y-3.5 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#FCEBED] text-[#C93245]">
          <MessageCircle className="size-4" aria-hidden />
        </span>
        <div>
          <p id={groupId} className="text-sm font-bold text-[#171717]">
            Also alert me on WhatsApp
          </p>
          <p className="text-xs text-[#737373]">Optional. Reply YES or NO directly from WhatsApp, no app needed.</p>
        </div>
      </div>

      <div role="radiogroup" aria-labelledby={groupId} className="grid grid-cols-2 gap-2">
        {OPTIONS.map((opt) => {
          const active = value.channel === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() =>
                onChange({ ...value, channel: opt.value, consent: opt.value === value.channel ? value.consent : false })
              }
              className={cn(
                "focus-ring flex h-12 touch-manipulation items-center justify-center rounded-xl border text-sm font-bold transition-all active:scale-[0.98]",
                active
                  ? "border-[#C93245] bg-[#C93245] text-white shadow-xs"
                  : "border-[#EAE6E3] bg-[#FAF9F6] text-[#171717] hover:border-[#F2D7DB] hover:bg-[#FFF5F5]",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

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
            <label htmlFor={consentId} className="flex cursor-pointer items-start gap-3 rounded-xl bg-[#FFF5F5] p-3 text-xs leading-relaxed text-[#171717]">
              <input
                id={consentId}
                type="checkbox"
                checked={value.consent}
                onChange={(e) => onChange({ ...value, consent: e.target.checked })}
                aria-invalid={Boolean(errors.contactConsent)}
                aria-describedby={errors.contactConsent ? errorId : undefined}
                className="focus-ring mt-0.5 size-4 shrink-0 accent-[#C93245]"
              />
              <span>
                I agree to receive blood-donation alerts from Blood Bridge on {CHANNEL_NAME[value.channel as "whatsapp" | "sms"]} at this
                number: at most 2 a week, only when my group is needed nearby. I can reply STOP at any time.
              </span>
            </label>
            {errors.contactConsent ? (
              <p id={errorId} className="text-xs font-semibold text-[#C93245]">
                {errors.contactConsent}
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
