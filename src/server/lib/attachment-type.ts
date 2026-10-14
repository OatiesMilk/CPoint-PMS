import { sniffImageType } from "./image-type";

export type AttachmentType = {
  mime: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
  ext: "jpg" | "png" | "webp" | "pdf";
};

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-

/**
 * Identifies a proof-of-delivery file by its first bytes, never by its name or the browser's
 * Content-Type (D-020, D-042): a photo (JPEG, PNG, WebP) or a PDF. Anything else is null.
 */
export function sniffAttachmentType(bytes: Uint8Array): AttachmentType | null {
  const image = sniffImageType(bytes);
  if (image) return image;
  if (bytes.length >= PDF_MAGIC.length && PDF_MAGIC.every((v, i) => bytes[i] === v))
    return { mime: "application/pdf", ext: "pdf" };
  return null;
}

/**
 * A file name that is safe to show and to put in a Content-Disposition header: no path, no control
 * characters or quotes, at most 100 characters, and always the extension the bytes call for.
 */
export function safeAttachmentName(original: string, ext: AttachmentType["ext"]): string {
  const base = (original.split(/[\\/]/).pop() ?? "")
    .replace(/\.[A-Za-z0-9]{1,5}$/, "")
    .replace(/[^\p{L}\p{N} ._()-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  return `${base || "proof-of-delivery"}.${ext}`;
}
