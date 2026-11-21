import { useId } from "react";
import { ConsentSwitch } from "../ConsentSwitch";
import { hourLabel } from "../copy";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const DEFAULT_START = 22;
const DEFAULT_END = 7;

const selectClass =
  "d-num focus-ring h-12 w-full rounded-xl border border-[#EAE6E3] bg-[#FAF9F6] px-3 text-base font-semibold text-[#171717] transition-colors focus:border-[#C93245] focus:bg-white";

/** Quiet hours in IST: a switch, then start and end hours. Off is stored as null/null. */
export function QuietHours({
  start,
  end,
  onChange,
}: {
  start: number | null;
  end: number | null;
  onChange: (start: number | null, end: number | null) => void;
}) {
  const startId = useId();
  const endId = useId();
  const on = start !== null && end !== null;
  return (
    <div className="space-y-3">
      <ConsentSwitch
        title="Quiet hours"
        description={
          on
            ? `No alerts between ${hourLabel(start)} and ${hourLabel(end)} (IST).`
            : "Pick hours when we must never alert you, like overnight."
        }
        checked={on}
        onChange={(next) => (next ? onChange(DEFAULT_START, DEFAULT_END) : onChange(null, null))}
      />
      {on ? (
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-[#F2D7DB] bg-[#FFF5F5]/65 p-3">
          <div className="space-y-1">
            <label htmlFor={startId} className="text-xs font-semibold text-[#737373]">
              From (IST)
            </label>
            <select id={startId} className={selectClass} value={start} onChange={(e) => onChange(Number(e.target.value), end)}>
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor={endId} className="text-xs font-semibold text-[#737373]">
              Until (IST)
            </label>
            <select id={endId} className={selectClass} value={end} onChange={(e) => onChange(start, Number(e.target.value))}>
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
    </div>
  );
}
