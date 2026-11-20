import { AlertTriangle, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { errorMessage } from "../../lib/api";
import { cn } from "../../lib/cn";
import { Button } from "./Button";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** What the person can do next. */
  action?: ReactNode;
  className?: string;
  /** Tighter spacing for use inside small panels. */
  compact?: boolean;
}

/** Shown when there is nothing to list. Say what will appear here and how to make it appear. */
export function EmptyState({ icon, title, description, action, className, compact = false }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center text-center", compact ? "gap-2 px-3 py-6" : "gap-3 px-6 py-12", className)}>
      {icon ? <div className="text-ink-faint [&_svg]:size-6">{icon}</div> : null}
      <p className="font-semibold text-ink">{title}</p>
      {description ? <p className="max-w-sm text-sm text-ink-muted">{description}</p> : null}
      {action}
    </div>
  );
}

/** Error panel for a failed query: names what failed and offers a retry. */
export function ErrorState({
  what,
  error,
  onRetry,
  compact = false,
  className,
}: {
  /** What could not be loaded, e.g. "the city forecast". */
  what: string;
  error: unknown;
  onRetry?: () => void;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div role="alert" className={className}>
      <EmptyState
        compact={compact}
        icon={<AlertTriangle className="text-warn" />}
        title={`Couldn't load ${what}`}
        description={errorMessage(error)}
        action={
          onRetry ? (
            <Button size="sm" icon={<RotateCcw className="size-3.5" aria-hidden />} onClick={onRetry}>
              Try again
            </Button>
          ) : null
        }
      />
    </div>
  );
}
