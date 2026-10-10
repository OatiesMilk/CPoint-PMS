import { Alert } from "@/components/ui/alert";

export type SummaryError = { fieldId: string; message: string };

/** Below this many errors the messages under the fields are enough (D-038). */
export const SUMMARY_MIN_ERRORS = 3;

/**
 * A list of what needs fixing, at the top of a long form. It only appears with three or more
 * errors; each line jumps to its field. The same message also sits under the field itself.
 */
export function FormErrorSummary({ errors }: { errors: SummaryError[] }) {
  if (errors.length < SUMMARY_MIN_ERRORS) return null;
  return (
    <Alert tone="danger" data-testid="form-error-summary">
      <p className="font-medium">{errors.length} fields need fixing before this can be sent:</p>
      <ul className="list-disc pl-5">
        {errors.map((e) => (
          <li key={e.fieldId}>
            <a href={`#${e.fieldId}`} className="underline underline-offset-4">
              {e.message}
            </a>
          </li>
        ))}
      </ul>
    </Alert>
  );
}
