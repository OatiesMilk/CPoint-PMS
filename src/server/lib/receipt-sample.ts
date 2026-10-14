import sharp from "sharp";

/**
 * Placeholder proof-of-delivery files for the demo week and the tests (D-042): a small picture of
 * a delivery receipt, and a one-page PDF with the same lines. Generated, never real documents.
 */

export type SampleReceipt = {
  /** e.g. "PR-2026-0003" */
  code: string;
  supplier: string;
  /** e.g. "Oct 9, 2026" */
  date: string;
  /** e.g. "2 rolls of Black cowhide" */
  lines: string[];
};

const xml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function receiptText(receipt: SampleReceipt): string[] {
  return [
    "DELIVERY RECEIPT (sample)",
    receipt.supplier,
    `For ${receipt.code}   Delivered ${receipt.date}`,
    "",
    ...receipt.lines.map((line) => `- ${line}`),
    "",
    "Received in good order: ____________________",
  ];
}

/** A JPEG that looks like a photographed receipt. */
export function renderReceiptImage(receipt: SampleReceipt, width = 480): Promise<Buffer> {
  const rows = receiptText(receipt);
  const height = 96 + rows.length * 30;
  const text = rows
    .map(
      (row, i) =>
        `<text x="32" y="${64 + i * 30}" font-family="monospace" font-size="${i === 0 ? 20 : 16}" font-weight="${i === 0 ? 700 : 400}" fill="#2b2118">${xml(row)}</text>`,
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" fill="#c8b9a2"/>
    <rect x="14" y="14" width="${width - 28}" height="${height - 28}" fill="#fbf7ee" stroke="#b9ab94"/>
    ${text}
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer();
}

/** PDF strings are ASCII here; brackets and backslashes are escaped. */
const pdfText = (text: string) => text.replace(/[^\x20-\x7e]/g, "?").replace(/([\\()])/g, "\\$1");

/** A one-page PDF, written by hand so the seed needs no PDF library. */
export function renderReceiptPdf(receipt: SampleReceipt): Buffer {
  const content = [
    "BT",
    "/F1 12 Tf",
    "16 TL",
    "40 540 Td",
    ...receiptText(receipt).flatMap((row) => [`(${pdfText(row)}) Tj`, "T*"]),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 595] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, i) => {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefAt = Buffer.byteLength(body, "latin1");
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}
