import { Languages } from "lucide-react";
import { useState } from "react";
import type { DonorAlertDTO } from "../../../../shared/api";
import { LANGUAGE_LABEL } from "../../../../shared/domain";

/** The alert text in the donor's language when a translation exists, with a toggle back to English. */
export function AlertMessage({ alert }: { alert: DonorAlertDTO }) {
  const [english, setEnglish] = useState(false);
  const localized = alert.messageLocalized;
  const showLocal = localized !== null && !english;
  return (
    <div className="rounded-(--radius-panel) bg-surface-2 p-4">
      <p lang={showLocal ? alert.language : "en"} className="text-base leading-relaxed text-ink">
        {showLocal ? localized : alert.message}
      </p>
      {localized !== null ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3">
          <button
            type="button"
            onClick={() => setEnglish((e) => !e)}
            aria-pressed={english}
            className="focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) text-sm font-semibold text-info"
          >
            <Languages className="size-4" aria-hidden />
            {english ? `Show in ${LANGUAGE_LABEL[alert.language]}` : "Show in English"}
          </button>
          <span className="text-xs text-ink-faint">Translated by an open model on Workers AI</span>
        </div>
      ) : null}
    </div>
  );
}
