import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

/** Dense ops-console panel: hairline frame, compact header, scrolling body. */
export function Panel({
  title,
  icon,
  meta,
  actions,
  children,
  className,
  bodyClassName,
  id,
}: {
  title: string;
  /** Line icon shown before the title. */
  icon?: ReactNode;
  /** Small right-aligned context, e.g. "72h horizon". */
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section aria-labelledby={headingId} className={cn("flex min-h-0 flex-col border-line bg-surface", className)}>
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3">
        {icon ? <span className="text-accent [&_svg]:size-4">{icon}</span> : null}
        <h2 id={headingId} className="font-label text-sm text-ink">
          {title}
        </h2>
        {meta ? <span className="font-numeric text-xs text-ink-faint">{meta}</span> : null}
        {actions ? <div className="ml-auto flex items-center gap-1.5">{actions}</div> : null}
      </header>
      <div className={cn("min-h-0 flex-1 overflow-y-auto", bodyClassName)}>{children}</div>
    </section>
  );
}
