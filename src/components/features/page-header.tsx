import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * The one page header (Phase 30F): an optional back link, the title, one plain line of
 * description, an optional meta line (period, "as of …"), and the page's actions at the right.
 * No rule under it: the space before the content separates them.
 */
export function PageHeader({
  title,
  description,
  actions,
  back,
  meta,
  titleAddon,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  meta?: ReactNode;
  /** Sits beside the title, e.g. a status badge. */
  titleAddon?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3">
      {back && (
        <Link
          href={back.href}
          className="-mx-2 inline-flex h-7 items-center gap-1.5 self-start rounded-md px-2 text-sm text-muted-foreground transition-colors duration-(--dur-fast) hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-x-8 gap-y-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            {titleAddon}
          </div>
          {description && (
            <p className="mt-1.5 max-w-3xl text-lg text-muted-foreground">{description}</p>
          )}
          {meta && <p className="mt-1 text-sm text-muted-foreground">{meta}</p>}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end lg:pt-1">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
