/**
 * Printed labels (Phase 32, D-128): one per roll and one per storage location, each with a QR
 * code drawn on the server as SVG (the `qrcode` package, no network). A roll's QR holds its code
 * alone (LR-MLT-004) and a location's LOC:<code> (A-80), read by the app's Find roll and Capture,
 * so the labels don't depend on the site's address, which the quick tunnel changes each run.
 */
import QRCode from "qrcode";
import { formatCalendarDate } from "@/lib/format";
import { LOCATION_KIND_LABELS, locationQrText } from "@/lib/location-rules";
import { formatArea } from "@/lib/roll-rules";
import { findLocationsByIds } from "@/server/models/location.model";
import { findRollsByIds, listInStockRollIds } from "@/server/models/roll.model";

/** Labels on one print page at most (an A4 sheet holds 21; a few sheets at once). */
export const LABELS_MAX = 105;

/** A QR code as an SVG string for `dangerouslySetInnerHTML`; error correction M survives a scuff. */
export function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
}

export type RollLabel = {
  id: string;
  code: string;
  qrText: string;
  qrSvg: string;
  item: string | null;
  supplier: string | null;
  area: string;
  receivedOn: string | null;
  tagCode: string | null;
};

export type LocationLabel = {
  id: string;
  code: string;
  qrText: string;
  qrSvg: string;
  name: string | null;
  kind: string;
};

const take = (ids: string[]) => [...new Set(ids)].slice(0, LABELS_MAX);

/** The rolls' labels, in the order of their codes. Unknown ids are left out. */
export async function rollLabels(ids: string[]): Promise<RollLabel[]> {
  const rows = (await findRollsByIds(take(ids))).sort((a, b) => a.code.localeCompare(b.code));
  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      code: r.code,
      qrText: r.code,
      qrSvg: await qrSvg(r.code),
      item: r.item?.name ?? null,
      supplier: r.supplier?.name ?? null,
      area: formatArea(r.areaSqFt === null ? null : Number(r.areaSqFt)),
      receivedOn: r.receivedAt ? formatCalendarDate(r.receivedAt) : null,
      tagCode: r.tagCode,
    })),
  );
}

/** The locations' labels, in the Floor Manager's order. Unknown ids are left out. */
export async function locationLabels(ids: string[]): Promise<LocationLabel[]> {
  const rows = await findLocationsByIds(take(ids));
  return Promise.all(
    rows.map(async (l) => ({
      id: l.id,
      code: l.code,
      qrText: locationQrText(l.code),
      qrSvg: await qrSvg(locationQrText(l.code)),
      name: l.name,
      kind: LOCATION_KIND_LABELS[l.kind],
    })),
  );
}

/** The labels of a leather item's rolls still in stock. */
export async function inStockRollLabels(itemId: string): Promise<RollLabel[]> {
  return rollLabels(await listInStockRollIds(itemId));
}
