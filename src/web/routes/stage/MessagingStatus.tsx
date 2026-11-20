import { useQuery } from "@tanstack/react-query";
import type { MessagingChannelStatusDTO, MessagingStatusDTO } from "../../../shared/api";
import { cn } from "../../lib/cn";

const NAME = { whatsapp: "WhatsApp", sms: "SMS" } as const;

function label(c: MessagingChannelStatusDTO): string {
  const test = c.adapter === "console" ? " (test console)" : c.adapter === "cloud-api" ? " (official Cloud API)" : "";
  if (c.online) return `${NAME[c.channel]} online${test}`;
  if (c.state === "needs_qr") return `${NAME[c.channel]}: scan QR`;
  if (c.state === "starting") return `${NAME[c.channel]} starting`;
  return `${NAME[c.channel]} offline`;
}

/** "WhatsApp online" pill, driven by gateway heartbeats (always online with the Cloud API). Hidden until a sender exists. */
export function MessagingStatus() {
  const { data } = useQuery({
    queryKey: ["messaging", "status"],
    queryFn: async ({ signal }): Promise<MessagingStatusDTO> => {
      const res = await fetch("/api/messaging/status", { signal, headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`messaging status ${res.status}`);
      return res.json();
    },
    // Heartbeats arrive every ~15 s; realtime "messaging" events also invalidate this.
    refetchInterval: 15_000,
  });
  if (!data?.gatewayLastSeenAt) return null;
  const shown = data.channels.filter((c) => c.channel === "whatsapp" || c.adapter !== null);
  return (
    <div className="flex items-center gap-1.5" role="status" aria-label="Messaging channels">
      {shown.map((c) => (
        <span
          key={c.channel}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-label text-xs",
            c.online ? "border-ok/40 bg-ok-soft text-ink" : "border-line text-ink-muted",
          )}
        >
          <span aria-hidden className={cn("size-2 rounded-full", c.online ? "bg-ok" : c.state === "offline" ? "bg-ink-faint" : "bg-warn")} />
          {label(c)}
        </span>
      ))}
      {data.queue.pending > 0 ? <span className="font-label text-xs text-ink-muted">{data.queue.pending} queued</span> : null}
    </div>
  );
}
