import { cn } from "../../lib/cn";

/** Small source footnote link shown under every figure. */
export function SourceNote({ source, url, className }: { source: string; url: string; className?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={cn("text-xs text-ink-faint underline decoration-dotted underline-offset-2 hover:text-ink-muted", className)}
    >
      Source: {source}
    </a>
  );
}
