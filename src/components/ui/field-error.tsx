import { cn } from "@/lib/utils";

/**
 * The message under a field. Give the field `aria-describedby={id}` while there is a message, so
 * a screen reader reads it with the field. Renders nothing when there is no message.
 */
export function FieldError({
  id,
  message,
  className,
}: {
  id: string;
  message?: string | null;
  className?: string;
}) {
  if (!message) return null;
  return (
    <p id={id} className={cn("text-sm text-reject", className)}>
      {message}
    </p>
  );
}
