import { z } from "zod";
import {
  FIND_QUERY_MAX,
  isLocationCode,
  LOCATION_KINDS,
  LOCATION_MESSAGES,
  LOCATION_NAME_MAX,
  LOCATION_NOTES_MAX,
  MOVE_MAX,
  MOVE_NOTE_MAX,
  normalizeLocationCode,
} from "@/lib/location-rules";

/** An optional text box: trimmed, and empty means none. */
const optionalText = (max: number, message: string) =>
  z
    .string({ error: message })
    .trim()
    .max(max, message)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

/** The same box on Edit: left out means unchanged, empty means none. */
const editText = (max: number, message: string) =>
  z
    .string({ error: message })
    .trim()
    .max(max, message)
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v || null));

const code = z
  .string({ error: LOCATION_MESSAGES.code })
  .transform(normalizeLocationCode)
  .refine(isLocationCode, LOCATION_MESSAGES.code);

const kind = z.enum(LOCATION_KINDS, { error: LOCATION_MESSAGES.kind });

/** Inventory → Storage locations → Add location (Phase 32, D-128). */
export const addLocationSchema = z.object({
  code,
  name: optionalText(LOCATION_NAME_MAX, LOCATION_MESSAGES.nameTooLong),
  kind,
  notes: optionalText(LOCATION_NOTES_MAX, LOCATION_MESSAGES.notesTooLong),
});

export type AddLocationValues = z.output<typeof addLocationSchema>;

/** Edit a location, or deactivate / reactivate it. Only the fields sent change. */
export const editLocationSchema = z.object({
  code: code.optional(),
  name: editText(LOCATION_NAME_MAX, LOCATION_MESSAGES.nameTooLong),
  kind: kind.optional(),
  notes: editText(LOCATION_NOTES_MAX, LOCATION_MESSAGES.notesTooLong),
  isActive: z.boolean({ error: "Choose whether the location is active." }).optional(),
});

export type EditLocationValues = z.output<typeof editLocationSchema>;

const locationId = z.uuid({ error: LOCATION_MESSAGES.chooseLocation });

/** The Floor Manager moves one or many rolls to a location. */
export const moveRollsSchema = z.object({
  rollIds: z
    .array(z.uuid({ error: LOCATION_MESSAGES.chooseRolls }), {
      error: LOCATION_MESSAGES.chooseRolls,
    })
    .min(1, LOCATION_MESSAGES.chooseRolls)
    .max(MOVE_MAX, LOCATION_MESSAGES.tooMany)
    .transform((ids) => [...new Set(ids)]),
  toLocationId: locationId,
  note: optionalText(MOVE_NOTE_MAX, LOCATION_MESSAGES.noteTooLong),
});

export type MoveRollsValues = z.output<typeof moveRollsSchema>;

/** Set a Returned to supplier roll aside for the supplier (A-77). */
export const setAsideSchema = z.object({ locationId });

/** Put back at Capture: where the roll went, optional (no locations yet, or skipped). */
export const putBackSchema = z.object({
  locationId: z.uuid({ error: LOCATION_MESSAGES.chooseLocation }).optional().nullable(),
});

/** Find roll: a roll code or tag number, or a location's QR text (LOC:…). */
export const findQuerySchema = z.object({
  q: z
    .string({ error: LOCATION_MESSAGES.findQuery })
    .trim()
    .min(1, LOCATION_MESSAGES.findQuery)
    .max(FIND_QUERY_MAX + 4, LOCATION_MESSAGES.findQuery),
});

export const locationIdSchema = z.uuid();

/** True for a well-formed location id. Anything else is a 404, never a database error. */
export function isLocationId(value: string): boolean {
  return locationIdSchema.safeParse(value).success;
}
