import { cn } from "../../lib/cn";

/** Placeholder block while data loads. Hidden from assistive tech; pair with an aria-busy container. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-shimmer rounded-md bg-surface-3", className)} />;
}

/** A few stacked skeleton rows. */
export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-9" />
      ))}
    </div>
  );
}
