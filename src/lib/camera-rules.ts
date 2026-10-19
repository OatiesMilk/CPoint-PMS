/**
 * The readable model name in a scan's modelVersion: the station sends the name plus the first
 * 8 hex digits of the weights' SHA-256 ("yolo-v1-1d729fb0", D-048). Other versions come back as
 * they are; nothing here knows a model's name.
 */
export function modelName(modelVersion: string | null | undefined): string | null {
  const v = modelVersion?.trim();
  if (!v) return null;
  return v.replace(/-[0-9a-f]{8}$/i, "") || v;
}
