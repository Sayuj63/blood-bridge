import type { AuditEntryDTO } from "../../../shared/api";
import { Badge } from "../../components/ui/Badge";
import { cn } from "../../lib/cn";
import { formatISTDateTime, shortHash } from "../../lib/format";

const ACTOR_TONE: Record<string, "info" | "bridge" | "accent" | "neutral" | "ok"> = {
  hospital: "info",
  bank: "accent",
  donor: "ok",
  command: "bridge",
};

/**
 * One ledger entry with its place in the chain: a node on the spine, its own
 * hash, and the previous hash it commits to. Entries at or after a break turn red.
 */
export function ChainRow({
  entry,
  olderHash,
  brokenAt,
  verified,
}: {
  entry: AuditEntryDTO;
  /** Hash of the entry listed below this one (the previous seq), to show the link visually. */
  olderHash: string | null;
  brokenAt: number | null;
  verified: boolean;
}) {
  const broken = brokenAt !== null && entry.seq >= brokenAt;
  const isBreak = brokenAt !== null && entry.seq === brokenAt;
  const linkOk = olderHash === null || olderHash === entry.prevHash;
  const role = entry.actor.split(":")[0];

  return (
    <li className="relative grid grid-cols-[2rem_1fr] gap-x-3 pb-3 sm:grid-cols-[2.5rem_1fr]">
      <div className="relative flex justify-center" aria-hidden>
        <span className={cn("absolute top-0 bottom-0 w-0.5", broken ? "bg-critical/50" : "bg-line-strong", isBreak && "bottom-auto h-3")} />
        <span
          className={cn(
            "relative mt-3 size-3.5 rounded-full border-2",
            broken ? "border-critical bg-critical" : verified ? "border-ok bg-ok" : "border-line-strong bg-surface",
          )}
        />
      </div>
      <article
        className={cn(
          "min-w-0 rounded-(--radius-control) border bg-surface px-3 py-2.5 sm:px-4",
          isBreak ? "border-critical ring-2 ring-critical/30" : broken ? "border-critical/40" : "border-line",
        )}
      >
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="font-numeric text-sm font-bold">#{entry.seq}</span>
          <time className="font-numeric text-xs text-ink-muted" dateTime={new Date(entry.at).toISOString()}>
            {formatISTDateTime(entry.at)}
          </time>
          <Badge tone={ACTOR_TONE[role] ?? "neutral"} size="sm">
            {entry.actor}
          </Badge>
          <span className="font-label text-xs text-ink-faint">{entry.action}</span>
          {isBreak ? (
            <Badge tone="critical" size="sm" className="ml-auto">
              Hash mismatch
            </Badge>
          ) : null}
        </div>
        <p className="mt-1 text-sm">{entry.summary}</p>
        <dl className="mt-2 grid gap-x-4 gap-y-0.5 font-mono text-2xs text-ink-faint sm:grid-cols-2">
          <div className="flex gap-1.5">
            <dt>hash</dt>
            <dd className={cn("text-ink-muted", broken && "text-critical")} title={entry.hash}>
              {shortHash(entry.hash, 16)}
            </dd>
          </div>
          <div className="flex gap-1.5">
            <dt>prev</dt>
            <dd className={cn(!linkOk && "text-critical")} title={entry.prevHash}>
              {shortHash(entry.prevHash, 16)}
            </dd>
          </div>
        </dl>
      </article>
    </li>
  );
}
