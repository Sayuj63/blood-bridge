import { cn } from "../lib/cn";

/**
 * The mark: a blood drop crossed by a bridge arc joining two sites.
 * Built on a 32-unit grid with strokes thick enough to survive 16px.
 */
export function LogoMark({ size = 28, className, title }: { size?: number; className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <path fill="var(--bb-accent)" d="M16 1.5C16 1.5 5 13.2 5 20.2a11 11 0 0 0 22 0C27 13.2 16 1.5 16 1.5Z" />
      <path fill="none" stroke="var(--bb-surface)" strokeWidth="2.6" strokeLinecap="round" d="M9.6 22.5Q16 12.5 22.4 22.5" />
      <circle cx="9.6" cy="22.6" r="2.3" fill="var(--bb-surface)" />
      <circle cx="22.4" cy="22.6" r="2.3" fill="var(--bb-surface)" />
    </svg>
  );
}

/** Mark + wordmark. The wordmark is set in expanded Archivo so it reads from the back of a hall. */
export function Logo({ size = 28, className, compact = false }: { size?: number; className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-ink", className)}>
      <LogoMark size={size} />
      {compact ? (
        <span className="sr-only">Blood Bridge</span>
      ) : (
        <span className="font-display leading-none" style={{ fontSize: size * 0.62 }}>
          Blood Bridge
        </span>
      )}
    </span>
  );
}
