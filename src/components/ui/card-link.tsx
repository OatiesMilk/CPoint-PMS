import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A card's way out ("Open", "Edit", "Inventory"), at the top right or under the content (30F).
 * Quieter than the card title: muted text that darkens on hover, with the arrow nudging right.
 */
export function CardLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group -mx-2 inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-sm font-medium whitespace-nowrap print:hidden",
        "text-muted-foreground transition-colors duration-(--dur-fast) hover:bg-accent hover:text-foreground",
        className,
      )}
    >
      {children}
      <ArrowRight
        aria-hidden
        className="size-4 transition-transform duration-(--dur-fast) ease-out motion-safe:group-hover:translate-x-0.5"
      />
    </Link>
  );
}
