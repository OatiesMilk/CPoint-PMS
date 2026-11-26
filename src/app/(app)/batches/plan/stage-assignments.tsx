"use client";

import { useEffect, useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { STAGES, STAGE_LABEL, type Stage } from "@/lib/repair-rules";
import { saveStageAssignmentsAction } from "../actions";

type View = {
  day: string;
  editable: boolean;
  lockedReason: string | null;
  constructors: { id: string; name: string; absent: boolean; captureAccess: boolean }[];
  assignments: { userId: string; stage: Stage }[];
  prefill: { from: string; label: string; assignments: { userId: string; stage: Stage }[] } | null;
};

/**
 * "Who works where" (Phase 34, D-130, A-74, A-86): the Floor Manager ticks the active
 * constructors under each stage for the day. A constructor is at one stage a day, so ticking
 * someone at one stage moves them from another. An empty day starts from the last working day's
 * stages as a suggestion; nothing is stored until Save stages. Editable for today and later
 * planned days, even after the plan locks; past days are read-only.
 */
export function StageAssignments({ day }: { day: string }) {
  const [view, setView] = useState<View | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [at, setAt] = useState<Record<string, Stage>>({});
  const [suggested, setSuggested] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v1/production/stages/${day}`, { cache: "no-store" });
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok)
          return setLoadError(body?.error?.message ?? "Who works where couldn’t be loaded.");
        const v = body.data as View;
        const start = v.assignments.length ? v.assignments : (v.prefill?.assignments ?? []);
        setAt(Object.fromEntries(start.map((a) => [a.userId, a.stage])));
        setSuggested(v.assignments.length === 0 && v.prefill ? v.prefill.label : null);
        setView(v);
      } catch {
        if (!cancelled)
          setLoadError("Who works where couldn’t be loaded. Close and open the day again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [day]);

  if (loadError)
    return (
      <Alert tone="danger" data-testid="stages-error">
        {loadError}
      </Alert>
    );
  if (!view)
    return (
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Loading who works where…
      </p>
    );

  const names = new Map(view.constructors.map((c) => [c.id, c]));
  // Constructors with Capture access are at Preparation every day, locked (A-95).
  const capture = view.constructors.filter((c) => c.captureAccess);
  const others = view.constructors.filter((c) => !c.captureAccess);
  const people = (stage: Stage) =>
    [
      ...(stage === "PREPARATION" ? capture.map((c) => c.name) : []),
      ...Object.entries(at)
        .filter(([, s]) => s === stage)
        .map(([id]) => names.get(id)?.name),
    ]
      .filter(Boolean)
      .join(", ");

  function toggle(id: string, stage: Stage, on: boolean) {
    setFormError(null);
    setAt((prev) => {
      const next = { ...prev };
      if (on) next[id] = stage;
      else delete next[id];
      return next;
    });
  }

  function save() {
    setFormError(null);
    startTransition(async () => {
      const result = await saveStageAssignmentsAction(day, {
        assignments: STAGES.map((stage) => ({
          stage,
          userIds: Object.entries(at)
            .filter(([, s]) => s === stage)
            .map(([id]) => id),
        })),
      });
      if (result.ok) {
        setSuggested(null);
        toast.success("Who works where is saved.");
        return;
      }
      setFormError(result.error);
    });
  }

  return (
    <section
      aria-labelledby={`stages-${day}`}
      className="flex flex-col gap-3 border-t pt-4"
      data-testid="stage-assignments"
    >
      <div className="flex flex-col gap-1">
        <h3 id={`stages-${day}`} className="text-base font-semibold">
          Who works where
        </h3>
        <p className="text-sm text-muted-foreground">
          {view.editable
            ? "Tick the constructors at each stage. Each is at one stage a day. They count the work at their stage. A constructor with Capture access always works at Preparation."
            : (view.lockedReason ?? "")}
        </p>
      </div>
      {view.editable && suggested && (
        <Alert tone="info" data-testid="stages-prefill">
          Same as {suggested}. Save to confirm.
        </Alert>
      )}
      {view.constructors.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          There are no active Shoe Constructors. The System Admin adds them under Users.
        </p>
      ) : view.editable ? (
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          {STAGES.map((stage) => (
            <fieldset key={stage} className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">{STAGE_LABEL[stage]}</legend>
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-x-4 gap-y-1">
                {stage === "PREPARATION" &&
                  capture.map((c) => (
                    <li key={c.id}>
                      <label className="flex min-h-9 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="size-4 accent-[var(--primary)]"
                          checked
                          disabled
                          readOnly
                        />
                        <span>{c.name}</span>
                        {c.absent && <Badge tone="warning">Absent</Badge>}
                        <span className="text-muted-foreground">Has Capture access</span>
                      </label>
                    </li>
                  ))}
                {others.map((c) => {
                  const elsewhere = at[c.id] && at[c.id] !== stage ? at[c.id] : null;
                  return (
                    <li key={c.id}>
                      <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="size-4 accent-[var(--primary)]"
                          checked={at[c.id] === stage}
                          onChange={(e) => toggle(c.id, stage, e.target.checked)}
                        />
                        <span>{c.name}</span>
                        {c.absent && <Badge tone="warning">Absent</Badge>}
                        {elsewhere && (
                          <span className="text-muted-foreground">At {STAGE_LABEL[elsewhere]}</span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          ))}
          {formError && <Alert tone="danger">{formError}</Alert>}
          <Button type="submit" disabled={pending} className="self-start">
            {pending && <LoaderCircle aria-hidden className="animate-spin" />}
            Save stages
          </Button>
        </form>
      ) : (
        <dl className="flex flex-col gap-1 text-sm">
          {STAGES.map((stage) => (
            <div key={stage} className="flex flex-wrap gap-x-2">
              <dt className="font-medium">{STAGE_LABEL[stage]}:</dt>
              <dd className="text-muted-foreground">{people(stage) || "Nobody assigned"}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
