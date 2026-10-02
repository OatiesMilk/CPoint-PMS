export type ImageType = {
  mime: "image/jpeg" | "image/png" | "image/webp";
  ext: "jpg" | "png" | "webp";
};

/** Identifies an image by its magic bytes, never by the file name or the client's Content-Type. */
export function sniffImageType(bytes: Uint8Array): ImageType | null {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return { mime: "image/jpeg", ext: "jpg" };
  if (
    b.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)
  ) {
    return { mime: "image/png", ext: "png" };
  }
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  if (b.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP")
    return { mime: "image/webp", ext: "webp" };
  return null;
}

export const MIME_BY_EXT: Record<string, ImageType["mime"]> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
