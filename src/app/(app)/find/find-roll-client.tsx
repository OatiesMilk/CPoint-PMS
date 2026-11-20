"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, MapPin, Search } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocationHistory, type HistoryEntry } from "@/components/features/rolls/location-history";
import {
  MoveRollsDialog,
  type LocationOption,
} from "@/components/features/rolls/move-rolls-dialog";
import { PickedUpButton } from "@/components/features/rolls/picked-up-button";
import { QrScanner } from "@/components/features/rolls/qr-scanner";
import { LOCATION_KIND_LABELS, LOCATION_MESSAGES, locationText } from "@/lib/location-rules";
import { formatArea } from "@/lib/roll-rules";
import { moveRollsAction, pickedUpAction } from "../inventory/locations/actions";

/** A roll as GET /api/v1/rolls/find sends it. */
type FoundRoll = {
  id: string;
  code: string;
  /** Its code before Phase 33's rename, on an old label (D-129). */
  formerCode: string | null;
  tagCode: string | null;
  statusText: string;
  item: string | null;
  supplier: string | null;
  areaSqFt: number | null;
  location: { id: string; code: string; name: string | null } | null;
  where: string;
  canMove: boolean;
  awaitsPickup: boolean;
};

type FoundLocation = {
  id: string;
  code: string;
  name: string | null;
  kind: keyof typeof LOCATION_KIND_LABELS;
  isActive: boolean;
  contents: FoundRoll[];
};

type Result = { rolls: FoundRoll[]; location: FoundLocation | null; message: string | null };

type ApiError = { error?: { message?: string } };

async function lookup(q: string): Promise<Result> {
  const res = await fetch(`/api/v1/rolls/find?q=${encodeURIComponent(q)}`, { cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as { data?: Result } & ApiError;
  if (!res.ok || !body.data)
    throw new Error(
      body.error?.message ?? "The search didn’t finish. Check the connection and try again.",
    );
  return body.data;
}

async function history(id: string): Promise<HistoryEntry[]> {
  const res = await fetch(`/api/v1/rolls/${id}/moves`, { cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as { data?: HistoryEntry[] } & ApiError;
  if (!res.ok || !body.data)
    throw new Error(body.error?.message ?? "The history didn’t load. Try again.");
  return body.data;
}

/**
 * Find roll (Phase 32, D-128): one search box and Scan label. A roll shows where it is in large
 * text and its location history; a location label lists the rolls kept there.
 */
export function FindRollClient({
  initialQuery,
  canMove,
  canMarkPickedUp,
  locations,
}: {
  initialQuery: string;
  canMove: boolean;
  canMarkPickedUp: boolean;
  locations: LocationOption[];
}) {
  const [query, setQuery] = useState(initialQuery);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<FoundRoll | null>(null);
  const [moves, setMoves] = useState<HistoryEntry[] | null>(null);
  const [searching, setSearching] = useState(false);
  const lastQuery = useRef("");

  const open = useCallback(async (roll: FoundRoll) => {
    setChosen(roll);
    setMoves(null);
    try {
      setMoves(await history(roll.id));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const search = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (!q) {
        setFieldError(LOCATION_MESSAGES.findQuery);
        return;
      }
      setFieldError(null);
      setError(null);
      setSearching(true);
      lastQuery.current = q;
      try {
        const found = await lookup(q);
        setResult(found);
        setChosen(null);
        setMoves(null);
        // One roll found: show it straight away.
        if (found.rolls.length === 1 && !found.location) await open(found.rolls[0]);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSearching(false);
      }
    },
    [open],
  );

  // A link with ?q= (a location's roll count, Inventory) looks it up once the page is open.
  useEffect(() => {
    if (!initialQuery) return;
    const timer = window.setTimeout(() => void search(initialQuery), 0);
    return () => window.clearTimeout(timer);
  }, [initialQuery, search]);

  /** After a move or Picked up: look the same code up again, so everything on screen is fresh. */
  const refresh = () => void search(lastQuery.current);

  const moveAction = async (input: unknown) => {
    const res = await moveRollsAction(input);
    if (res.ok) window.setTimeout(refresh, 0);
    return res;
  };

  return (
    <div className="flex max-w-xl flex-col gap-4 pb-6">
      <form
        noValidate
        role="search"
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void search(query);
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="find-q">Roll code or tag number</Label>
          <Input
            id="find-q"
            className="h-11 font-mono text-lg"
            autoComplete="off"
            autoCapitalize="characters"
            enterKeyHint="search"
            placeholder="LR-MLT-004"
            value={query}
            aria-invalid={!!fieldError}
            aria-describedby={fieldError ? "find-q-error" : undefined}
            onChange={(e) => setQuery(e.target.value)}
          />
          <FieldError id="find-q-error" message={fieldError ?? undefined} />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button type="submit" size="lg" disabled={searching}>
            {searching ? (
              <LoaderCircle aria-hidden className="animate-spin" />
            ) : (
              <Search aria-hidden />
            )}
            Find
          </Button>
          <QrScanner
            onCode={(text) => {
              setQuery(text);
              void search(text);
            }}
          />
        </div>
      </form>

      {error && <Alert tone="danger">{error}</Alert>}
      {result?.message && !error && <Alert tone="info">{result.message}</Alert>}

      {result?.location && (
        <Card data-testid="found-location">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              <MapPin aria-hidden className="size-5" />
              <span className="font-mono text-xl">{result.location.code}</span>
              {!result.location.isActive && <Badge tone="neutral">Deactivated</Badge>}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {[result.location.name, LOCATION_KIND_LABELS[result.location.kind]]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </CardHeader>
          <CardContent>
            {result.location.contents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No rolls are kept here now.</p>
            ) : (
              <ul
                className="flex flex-col divide-y"
                aria-label={`Rolls in ${result.location.code}`}
              >
                {result.location.contents.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className="flex min-h-11 w-full flex-wrap items-center justify-between gap-x-3 py-2 text-left hover:bg-accent"
                      onClick={() => void open(r)}
                    >
                      <span className="font-mono font-medium">{r.code}</span>
                      <span className="text-sm text-muted-foreground">
                        {[r.item, formatArea(r.areaSqFt)].filter(Boolean).join(" · ")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {result && result.rolls.length > 1 && !chosen && (
        <Card>
          <CardHeader>
            <CardTitle>{result.rolls.length} rolls match</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y">
              {result.rolls.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="flex min-h-11 w-full flex-wrap items-center justify-between gap-x-3 py-2 text-left hover:bg-accent"
                    onClick={() => void open(r)}
                  >
                    <span className="font-mono font-medium">{r.code}</span>
                    <span className="text-sm text-muted-foreground">
                      {r.formerCode ? `Formerly ${r.formerCode} · ` : ""}
                      {r.tagCode ? `Tag ${r.tagCode} · ` : ""}
                      {r.where}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {chosen && (
        <Card data-testid="found-roll">
          <CardHeader className="flex flex-col gap-1">
            <CardTitle className="font-mono text-xl">{chosen.code}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {[chosen.item, chosen.supplier, formatArea(chosen.areaSqFt)]
                .filter(Boolean)
                .join(" · ")}
              {chosen.tagCode ? ` · Tag ${chosen.tagCode}` : ""}
              {chosen.formerCode ? ` · Formerly ${chosen.formerCode}` : ""}
            </p>
            <div>
              <Badge tone="neutral">{chosen.statusText}</Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Where it is</p>
              <p className="text-xl font-semibold" data-testid="roll-where">
                {chosen.location ? locationText(chosen.location) : chosen.where}
              </p>
            </div>
            {(canMove && chosen.canMove) || (canMarkPickedUp && chosen.awaitsPickup) ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                {canMove && chosen.canMove && (
                  <MoveRollsDialog
                    rolls={[
                      {
                        id: chosen.id,
                        code: chosen.code,
                        where: chosen.where,
                        locationId: chosen.location?.id ?? null,
                      },
                    ]}
                    locations={locations}
                    action={moveAction}
                    size="lg"
                    triggerLabel={chosen.location ? "Move" : "Place it"}
                  />
                )}
                {canMarkPickedUp && chosen.awaitsPickup && (
                  <PickedUpButton
                    code={chosen.code}
                    action={async () => {
                      const res = await pickedUpAction(chosen.id);
                      if (res.ok) window.setTimeout(refresh, 0);
                      return res;
                    }}
                  />
                )}
              </div>
            ) : null}
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-medium">Location history</h2>
              {moves === null ? (
                <p role="status" className="text-sm text-muted-foreground">
                  Loading the history…
                </p>
              ) : (
                <LocationHistory entries={moves} />
              )}
            </div>
            {canMarkPickedUp && (
              <Link
                href={`/reports/rolls/${chosen.id}`}
                className="text-sm underline underline-offset-4"
              >
                Open the roll’s page
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
