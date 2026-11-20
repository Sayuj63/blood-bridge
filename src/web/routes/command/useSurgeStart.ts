import { useEffect, useState } from "react";
import type { ForecastDTO } from "../../../shared/api";
import type { OutcomeSummary } from "../../../shared/forecast";

const key = (surgeId: string) => `bb.surge-start.${surgeId}`;

function read(surgeId: string): OutcomeSummary | null {
  try {
    const raw = sessionStorage.getItem(key(surgeId));
    return raw ? (JSON.parse(raw) as OutcomeSummary) : null;
  } catch {
    return null;
  }
}

/**
 * The first "current" outcome seen after a surge began, kept for this browser
 * session, so the meter can show what has been averted since.
 */
export function useSurgeStart(forecast: ForecastDTO | undefined): OutcomeSummary | null {
  const surgeId = forecast?.surge?.id ?? null;
  const [start, setStart] = useState<OutcomeSummary | null>(null);

  useEffect(() => {
    if (!surgeId || !forecast) {
      setStart(null);
      return;
    }
    const saved = read(surgeId);
    if (saved) {
      setStart(saved);
      return;
    }
    setStart(forecast.current);
    try {
      sessionStorage.setItem(key(surgeId), JSON.stringify(forecast.current));
    } catch {
      // Storage unavailable: the meter still works for this page view.
    }
  }, [surgeId, forecast]);

  return start;
}
