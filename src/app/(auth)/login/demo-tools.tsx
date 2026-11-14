"use client";

import { useEffect, useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Account = { role: string; label: string };

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function post<T>(path: string, body: unknown): Promise<Result<T>> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (res.ok) return { ok: true, data: json?.data as T };
    return { ok: false, error: json?.error?.message ?? "That didn't work. Try again in a moment." };
  } catch {
    return { ok: false, error: "The server can't be reached. Check that the app is running." };
  }
}

/** Demo sign-in and Reset demo data, under the login form while DEMO_LOGIN_TOOLS is on (D-101). */
export function DemoTools({ accounts }: { accounts: Account[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pendingRole, setPendingRole] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function signInAs(role: string) {
    setError(null);
    setPendingRole(role);
    startTransition(async () => {
      const result = await post<{ redirectTo: string }>("/api/v1/demo/sign-in", { role });
      if (result.ok) {
        window.location.assign(result.data.redirectTo);
        return;
      }
      setError(result.error);
      setPendingRole(null);
    });
  }

  return (
    <section
      aria-labelledby="demo-tools-title"
      className="flex flex-col gap-4 rounded-lg border bg-muted/40 p-6"
      data-testid="demo-tools"
      data-demo-tools
    >
      <div>
        <h2 id="demo-tools-title" className="font-semibold">
          Demo sign-in
        </h2>
        <p className="text-sm text-muted-foreground">
          For the demo only. Signs in without a password.
        </p>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-col gap-2">
        {accounts.map((a) => (
          <Button
            key={a.role}
            variant="secondary"
            disabled={pendingRole !== null}
            onClick={() => signInAs(a.role)}
            className="justify-start"
          >
            {pendingRole === a.role && <LoaderCircle aria-hidden className="animate-spin" />}
            {a.label}
          </Button>
        ))}
      </div>
      <div className="border-t pt-4">
        <ResetDemoData disabled={pendingRole !== null} />
      </div>
    </section>
  );
}

function ResetDemoData({ disabled }: { disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [running]);

  function onOpenChange(next: boolean) {
    if (running) return; // stay open until the reset ends
    setOpen(next);
    if (!next) {
      setWord("");
      setFieldError(null);
      setError(null);
      setDone(false);
    }
  }

  async function reset(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (word !== "RESET") {
      setFieldError("Type RESET in capitals to reset the demo data.");
      return;
    }
    setFieldError(null);
    setSeconds(0);
    setRunning(true);
    const result = await post<unknown>("/api/v1/demo/reset", { confirm: word });
    setRunning(false);
    if (result.ok) setDone(true);
    else setError(result.error);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Button variant="destructive" disabled={disabled} onClick={() => setOpen(true)}>
        Reset demo data…
      </Button>
      <DialogContent>
        <DialogTitle>Reset demo data?</DialogTitle>
        {done ? (
          <>
            <Alert tone="success" data-testid="demo-reset-done">
              Fresh demo week loaded. Sign in with one of the demo buttons.
            </Alert>
            <DialogFooter>
              <DialogClose asChild>
                <Button>Close</Button>
              </DialogClose>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={reset} noValidate className="flex flex-col gap-4">
            <DialogDescription>
              The same as <code className="font-mono">npm run demo:reset -- --yes</code>. It
              can&rsquo;t be undone.
            </DialogDescription>
            <div className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <p className="font-medium">Deletes</p>
                <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                  <li>Rolls, scans and their images</li>
                  <li>Finished batches, quotas and attendance</li>
                  <li>Stock movements and the audit log</li>
                  <li>Accounts and device tokens made for tests</li>
                </ul>
              </div>
              <div>
                <p className="font-medium">Keeps</p>
                <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                  <li>The demo accounts and the first System Admin</li>
                  <li>Suppliers and defect types (set back to the demo&rsquo;s)</li>
                  <li>The simulator&rsquo;s device token</li>
                </ul>
              </div>
            </div>
            <p className="text-sm">
              Then it loads two fresh weeks of demo data. It takes 2 to 3 minutes.
            </p>
            {error && <Alert tone="danger">{error}</Alert>}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="demo-reset-word">Type RESET to confirm</Label>
              <Input
                id="demo-reset-word"
                value={word}
                autoComplete="off"
                disabled={running}
                aria-invalid={!!fieldError}
                aria-describedby={fieldError ? "demo-reset-word-error" : undefined}
                onChange={(e) => setWord(e.target.value)}
              />
              {fieldError && (
                <p id="demo-reset-word-error" className="text-sm text-reject">
                  {fieldError}
                </p>
              )}
            </div>
            {running && (
              <p role="status" className="flex items-center gap-2 text-sm">
                <LoaderCircle aria-hidden className="size-4 animate-spin" />
                Resetting… {seconds} s (2 to 3 minutes). Keep this page open.
              </p>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost" disabled={running}>
                  Keep the data
                </Button>
              </DialogClose>
              <Button type="submit" variant="destructive" disabled={running}>
                {running && <LoaderCircle aria-hidden className="animate-spin" />}
                Reset demo data
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
