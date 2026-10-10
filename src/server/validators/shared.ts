import { z } from "zod";

// Pieces every validator shares, so a message is written once and reads the same on every form.
// The rule (D-038): a message names its field and says how to fix it.

export const blankToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

/** An optional free-text field. `label` is the field's name in lower case, e.g. "note". */
export const optionalText = (max: number, label: string) =>
  z.preprocess(
    blankToUndefined,
    z
      .string({ error: `Enter the ${label} as text.` })
      .trim()
      .max(max, `Keep the ${label} under ${max} characters.`)
      .optional(),
  );

/**
 * For values the page sends by itself (which status it showed, which button was pressed). People
 * never type them, so a bad one means the page is stale or the request was hand-made.
 */
export const OUT_OF_DATE = "This page is out of date. Refresh it and try again.";
