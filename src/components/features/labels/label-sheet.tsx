import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * An A4 sheet of 3 × 7 stickers (Phase 32, A-54), the same size on screen and on paper. Each
 * label is a QR code (SVG drawn on the server) and its lines; the code is the biggest text.
 */
export function LabelSheet({
  labels,
  kind,
}: {
  labels: { id: string; code: string; qrSvg: string; qrText: string; lines: ReactNode[] }[];
  kind: "rolls" | "locations";
}) {
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <div
        className={cn("label-sheet", kind === "locations" && "locations")}
        role="list"
        aria-label={kind === "rolls" ? "Roll labels" : "Location labels"}
      >
        {labels.map((label) => (
          <div key={label.id} className="label" role="listitem" data-testid="label">
            <div
              className="label-qr"
              role="img"
              aria-label={`QR code for ${label.qrText}`}
              data-qr={label.qrText}
              // The SVG comes from the qrcode package on the server, from our own codes only.
              dangerouslySetInnerHTML={{ __html: label.qrSvg }}
            />
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="label-code">{label.code}</p>
              {label.lines.map((line, i) => (
                <p key={i} className="label-line">
                  {line}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
