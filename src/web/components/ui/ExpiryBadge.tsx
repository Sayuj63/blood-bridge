import { Hourglass } from "lucide-react";
import { POLICY } from "../../../shared/domain";
import { formatHours, formatISTDateTime } from "../../lib/format";
import { useNow } from "../../lib/useNow";
import { Badge } from "./Badge";

const HOUR = 3_600_000;

/** Shelf-life band for a unit, by hours remaining. */
export function expiryTone(hoursLeft: number): "critical" | "warn" | "info" | "ok" | "neutral" {
  if (hoursLeft <= 0) return "neutral";
  if (hoursLeft < 24) return "critical";
  if (hoursLeft < POLICY.expiringSoonHours) return "warn";
  if (hoursLeft < 24 * 7) return "info";
  return "ok";
}

export interface ExpiryBadgeProps {
  /** Epoch ms when the unit expires. */
  expiresAt: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/** Time left before a unit expires, coloured by remaining shelf life (<24h red, <48h amber). */
export function ExpiryBadge({ expiresAt, size = "md", className }: ExpiryBadgeProps) {
  const now = useNow(60_000);
  const hoursLeft = (expiresAt - now) / HOUR;
  const expired = hoursLeft <= 0;
  return (
    <Badge tone={expiryTone(hoursLeft)} size={size} className={className} title={`Expires ${formatISTDateTime(expiresAt)}`}>
      <Hourglass className="size-3" aria-hidden />
      <span className={expired ? "line-through" : undefined}>{expired ? "Expired" : `${formatHours(hoursLeft)} left`}</span>
    </Badge>
  );
}
