import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

/** A raised panel. Use `as="section"` with a CardHeader title for landmark regions. */
export function Card({
  as: Tag = "div",
  className,
  ...rest
}: HTMLAttributes<HTMLElement> & { as?: "div" | "section" | "article" | "aside" }) {
  return (
    <Tag
      className={cn("rounded-(--radius-panel) border border-line bg-surface text-ink shadow-panel", className)}
      {...rest}
    />
  );
}

export interface CardHeaderProps {
  title: ReactNode;
  /** One line explaining what the panel shows. */
  description?: ReactNode;
  /** Buttons or controls aligned to the right. */
  actions?: ReactNode;
  /** Heading level for document outline. */
  level?: 2 | 3;
  className?: string;
  id?: string;
}

export function CardHeader({ title, description, actions, level = 2, className, id }: CardHeaderProps) {
  const H = level === 2 ? "h2" : "h3";
  return (
    <div className={cn("flex items-start justify-between gap-3 px-4 pt-4 pb-3", className)}>
      <div className="min-w-0">
        <H id={id} className="text-[0.9375rem] font-semibold leading-tight tracking-tight">
          {title}
        </H>
        {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 pb-4", className)} {...rest} />;
}
