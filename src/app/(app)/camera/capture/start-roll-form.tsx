"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, Play } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatArea, ROLL_MESSAGES } from "@/lib/roll-rules";
import { QrScanner } from "@/components/features/rolls/qr-scanner";
import { parseScannedCode } from "@/lib/location-rules";
import type { OpenRollView } from "./roll-bar";

/** A roll in stock, not scanned yet, as GET /api/v1/rolls/ready sends it (Phase 30A). */
export type ReadyRollView = {
  id: string;
  code: string;
  tagCode: string | null;
  supplier: string | null;
  item: string | null;
  areaSqFt: number | null;
  /** Where it is kept (Phase 32), or null when not placed. */
  location?: { code: string; name: string | null } | null;
};

type ApiError = { error?: { message?: string } };

/** The rolls waiting to be scanned, or null when offline (the lists on screen stay). */
async function fetchReady(): Promise<ReadyRollView[] | null> {
  try {
    const res = await fetch("/api/v1/rolls/ready", { cache: "no-store" });
    if (!res.ok) return null;
    return ((await res.json()) as { data: ReadyRollView[] }).data;
  } catch {
    return null;
  }
}

type Leather = { name: string; supplier: string | null; rolls: ReadyRollView[] };

/** The leathers with rolls waiting, by name, each with its rolls (oldest first, as the API sends). */
function groupByLeather(ready: ReadyRollView[]): Leather[] {
  const map = new Map<string, Leather>();
  for (const r of ready) {
    const name = r.item ?? "Other rolls";
    const entry = map.get(name) ?? { name, supplier: r.supplier, rolls: [] };
    entry.rolls.push(r);
    map.set(name, entry);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** "Brown suede (topsiders) · Marikina Leather Trading · 3 rolls" */
export function leatherOption(l: Leather): string {
  const n = l.rolls.length;
  return [l.name, l.supplier, `${n} ${n === 1 ? "roll" : "rolls"}`].filter(Boolean).join(" · ");
}

/** "LR-MLT-012 · 24.5 sq ft · tag 88-14 · R1-B3" (where it is kept, Phase 32) */
export function rollOption(r: ReadyRollView): string {
  return [
    r.code,
    formatArea(r.areaSqFt),
    r.tagCode ? `tag ${r.tagCode}` : null,
    r.location?.code ?? null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Start a roll (Phase 30E, D-113): the constructor picks the leather, then the roll on the table
 * from that leather's rolls (its code is on its label, with the area the Floor Manager entered).
 * Nothing to type. The lists are read again when the form opens, so a roll someone else just
 * picked doesn't show.
 */
export function PickRollForm({
  initialReady,
  onStarted,
  onCancel,
}: {
  initialReady: ReadyRollView[];
  onStarted: (roll: OpenRollView) => void;
  /** Shown when another roll is already being scanned, to go back without picking one. */
  onCancel?: () => void;
}) {
  const [ready, setReady] = useState<ReadyRollView[]>(initialReady);
  const leathers = useMemo(() => groupByLeather(ready), [ready]);
  const [leatherName, setLeatherName] = useState(() => {
    const all = groupByLeather(initialReady);
    return all.length === 1 ? all[0].name : "";
  });
  const leather = leathers.find((l) => l.name === leatherName) ?? null;
  const [rollId, setRollId] = useState("");
  const roll = leather?.rolls.find((r) => r.id === rollId) ?? null;
  const [errors, setErrors] = useState<{ leather?: string; roll?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const leatherRef = useRef<HTMLSelectElement>(null);
  const rollRef = useRef<HTMLSelectElement>(null);

  async function reload() {
    const list = await fetchReady();
    if (list) setReady(list);
  }

  // Read the list again when the form opens: someone may have just picked a roll.
  useEffect(() => {
    let live = true;
    void fetchReady().then((list) => {
      if (live && list) setReady(list);
    });
    return () => {
      live = false;
    };
  }, []);

  /** Scan label (Phase 32): the roll's QR picks its leather and the roll itself. */
  async function pickByLabel(text: string) {
    setError(null);
    setErrors({});
    const scanned = parseScannedCode(text);
    if (!scanned || scanned.kind !== "roll") {
      setError("That label is a storage location, not a roll. Scan the label on the roll itself.");
      return;
    }
    const list = (await fetchReady()) ?? ready;
    setReady(list);
    const found = list.find((r) => r.code === scanned.code);
    if (!found) {
      setError(
        `${scanned.code} isn’t waiting to be scanned. It may be scanned already or being scanned on another phone. Check the code, or choose the roll below.`,
      );
      return;
    }
    setLeatherName(found.item ?? "Other rolls");
    setRollId(found.id);
  }

  async function start() {
    setError(null);
    if (!leather) {
      setErrors({ leather: ROLL_MESSAGES.chooseLeather });
      return leatherRef.current?.focus();
    }
    if (!roll) {
      setErrors({ roll: ROLL_MESSAGES.chooseRollOfLeather });
      return rollRef.current?.focus();
    }
    setErrors({});
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/rolls/${roll.id}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const body = (await res.json().catch(() => ({}))) as ApiError & { data?: OpenRollView };
      if (res.ok && body.data) return onStarted(body.data);
      setError(body.error?.message ?? `${roll.code} couldn’t be picked. Try again.`);
      setRollId("");
      void reload();
    } catch {
      setError("The server didn’t answer. Check the Wi-Fi, then try again.");
    } finally {
      setBusy(false);
    }
  }

  if (ready.length === 0)
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="info" data-testid="no-ready-rolls">
          No rolls are waiting to be scanned. Ask the Floor Manager to add them in Inventory.
        </Alert>
        {onCancel && (
          <Button type="button" size="lg" variant="ghost" className="self-start" onClick={onCancel}>
            Back to capturing
          </Button>
        )}
      </div>
    );

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void start();
      }}
    >
      <QrScanner
        label="Scan the roll’s label"
        className="max-sm:w-full sm:self-start"
        onCode={(text) => void pickByLabel(text)}
      />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="start-leather" className="text-base">
          Leather
        </Label>
        <Select
          id="start-leather"
          ref={leatherRef}
          value={leatherName}
          className="h-11"
          aria-invalid={!!errors.leather}
          aria-describedby={errors.leather ? "start-leather-error" : undefined}
          onChange={(e) => {
            setLeatherName(e.target.value);
            setRollId("");
            setErrors({});
          }}
        >
          <option value="">Choose the leather of this roll</option>
          {leathers.map((l) => (
            <option key={l.name} value={l.name}>
              {leatherOption(l)}
            </option>
          ))}
        </Select>
        <FieldError id="start-leather-error" message={errors.leather} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="start-roll" className="text-base">
          Roll on the table
        </Label>
        <Select
          id="start-roll"
          ref={rollRef}
          value={rollId}
          className="h-11"
          disabled={!leather}
          aria-invalid={!!errors.roll}
          aria-describedby={errors.roll ? "start-roll-error" : "start-roll-hint"}
          onChange={(e) => {
            setRollId(e.target.value);
            setErrors({});
          }}
        >
          <option value="">
            {leather ? "Choose the roll on the table" : "Choose the leather first"}
          </option>
          {leather?.rolls.map((r) => (
            <option key={r.id} value={r.id}>
              {rollOption(r)}
            </option>
          ))}
        </Select>
        {errors.roll ? (
          <FieldError id="start-roll-error" message={errors.roll} />
        ) : (
          <p id="start-roll-hint" className="text-sm text-muted-foreground">
            Match the code on the roll’s label.
          </p>
        )}
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" className="max-sm:w-full" disabled={busy}>
          {busy ? <LoaderCircle aria-hidden className="animate-spin" /> : <Play aria-hidden />}
          Start scanning
        </Button>
        {onCancel && (
          <Button type="button" size="lg" variant="ghost" onClick={onCancel}>
            Back to capturing
          </Button>
        )}
      </div>
    </form>
  );
}
