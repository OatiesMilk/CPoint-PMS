import { describe, expect, it } from "vitest";
import { safeAttachmentName, sniffAttachmentType } from "@/server/lib/attachment-type";
import { renderReceiptImage, renderReceiptPdf } from "@/server/lib/receipt-sample";

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => new TextEncoder().encode(text);

describe("proof-of-delivery file types (D-042)", () => {
  it("recognises each allowed type from its first bytes", () => {
    expect(sniffAttachmentType(bytes(0xff, 0xd8, 0xff, 0xe0))).toEqual({
      mime: "image/jpeg",
      ext: "jpg",
    });
    expect(sniffAttachmentType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toEqual({
      mime: "image/png",
      ext: "png",
    });
    expect(sniffAttachmentType(ascii("RIFF\0\0\0\0WEBPVP8 "))).toEqual({
      mime: "image/webp",
      ext: "webp",
    });
    expect(sniffAttachmentType(ascii("%PDF-1.7\n"))).toEqual({
      mime: "application/pdf",
      ext: "pdf",
    });
  });

  it("refuses everything else, whatever the file is called", () => {
    // A Windows program renamed to receipt.pdf still starts with "MZ".
    expect(sniffAttachmentType(bytes(0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00))).toBeNull();
    expect(sniffAttachmentType(ascii("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffAttachmentType(ascii("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(sniffAttachmentType(ascii("PK\x03\x04 a zip or an office file"))).toBeNull();
    // Too short to tell, or "PDF" without the full marker.
    expect(sniffAttachmentType(ascii("%PDF"))).toBeNull();
    expect(sniffAttachmentType(ascii(" %PDF-1.4"))).toBeNull();
    expect(sniffAttachmentType(new Uint8Array())).toBeNull();
  });

  it("keeps a readable name and always the extension the bytes call for", () => {
    expect(safeAttachmentName("Delivery receipt (Oct 9).JPG", "jpg")).toBe(
      "Delivery receipt (Oct 9).jpg",
    );
    // The name can't lie about the type, carry a path, or break a header.
    expect(safeAttachmentName("invoice.exe", "pdf")).toBe("invoice.pdf");
    expect(safeAttachmentName("C:\\Users\\fm\\Desktop\\resibo.pdf", "pdf")).toBe("resibo.pdf");
    expect(safeAttachmentName("../../etc/passwd", "png")).toBe("passwd.png");
    expect(safeAttachmentName('a"b\r\nSet-Cookie: x.png', "png")).toBe("abSet-Cookie x.png");
    expect(safeAttachmentName("Resibo ng tindahan ñ.webp", "webp")).toBe(
      "Resibo ng tindahan ñ.webp",
    );
    expect(safeAttachmentName("", "jpg")).toBe("proof-of-delivery.jpg");
    expect(safeAttachmentName("???.png", "png")).toBe("proof-of-delivery.png");
    expect(safeAttachmentName(`${"x".repeat(300)}.jpg`, "jpg")).toHaveLength(104);
  });
});

describe("sample proof files for the demo week", () => {
  const receipt = {
    code: "MR-2026-0006",
    supplier: "Marikina Leather (sample)",
    date: "Oct 9, 2026",
    lines: ["2 rolls of Black cowhide (school shoes)", "5 boxes of Shoe tacks, 12 mm"],
  };

  it("draws a JPEG and writes a PDF that pass the same check as an upload", async () => {
    const image = await renderReceiptImage(receipt);
    expect(sniffAttachmentType(new Uint8Array(image))?.mime).toBe("image/jpeg");
    const pdf = renderReceiptPdf(receipt);
    expect(sniffAttachmentType(new Uint8Array(pdf))?.mime).toBe("application/pdf");
    // Small enough to seed quickly, and a complete file: header, cross-reference table, end marker.
    expect(image.length).toBeLessThan(200_000);
    const text = pdf.toString("latin1");
    expect(text).toContain("(For MR-2026-0006   Delivered Oct 9, 2026) Tj");
    expect(text).toContain("\\(school shoes\\)");
    expect(text).toMatch(/xref\n0 6\n/);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    const xrefAt = Number(/startxref\n(\d+)\n/.exec(text)?.[1]);
    expect(text.slice(xrefAt, xrefAt + 4)).toBe("xref");
  });
});
