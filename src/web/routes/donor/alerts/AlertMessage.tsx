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
    <div className="d-card-blush p-4">
      <p lang={showLocal ? alert.language : "en"} className="text-sm leading-relaxed text-[#171717]">
        {showLocal ? localized : alert.message}
      </p>
      {localized !== null ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#F2D7DB] pt-2.5">
          <button
            type="button"
            onClick={() => setEnglish((e) => !e)}
            aria-pressed={english}
            className="focus-ring inline-flex min-h-11 touch-manipulation items-center gap-1.5 rounded-xl bg-white px-3.5 py-1.5 text-xs font-bold text-[#A82436] ring-1 ring-[#F2D7DB] transition-colors hover:bg-[#FCEBED]"
          >
            <Languages className="size-3.5" aria-hidden />
            {english ? `Show in ${LANGUAGE_LABEL[alert.language]}` : "Show in English"}
          </button>
          <span className="text-[11px] text-[#737373]">Translated on Workers AI</span>
        </div>
      ) : null}
    </div>
  );
}
