"use client";

import { useState, useTransition } from "react";
import { Check, Copy, LoaderCircle, Plus, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
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
import { createTokenAction, revokeTokenAction } from "./actions";

export function NewTokenDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ token: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function reset(next: boolean) {
    setOpen(next);
    if (!next) {
      setName("");
      setError(null);
      setCreated(null);
      setCopied(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        New token
      </Button>
      <DialogContent>
        {created ? (
          <>
            <DialogTitle>Token for “{created.name}”</DialogTitle>
            <DialogDescription>
              Copy it now and paste it into the camera machine’s settings.
            </DialogDescription>
            <Alert tone="info">
              <span className="flex items-center gap-1.5 font-semibold">
                <TriangleAlert aria-hidden className="size-4" /> You won’t see it again.
              </span>
              <span>
                Only a fingerprint is stored. If it’s lost, revoke it and create a new one.
              </span>
            </Alert>
            <div className="flex gap-2">
              <Input
                readOnly
                value={created.token}
                aria-label="New device token"
                className="font-mono text-sm"
                onFocus={(e) => e.target.select()}
              />
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(created.token);
                    setCopied(true);
                  } catch {
                    toast.error(
                      "Couldn’t copy automatically. Select the token and copy it by hand.",
                    );
                  }
                }}
              >
                {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button>Done</Button>
              </DialogClose>
            </DialogFooter>
          </>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              startTransition(async () => {
                const result = await createTokenAction({ name });
                if (result.ok) setCreated({ token: result.token, name: result.name });
                else setError(result.fieldErrors?.name ?? result.error);
              });
            }}
          >
            <DialogTitle>New device token</DialogTitle>
            <DialogDescription>
              Lets one camera machine send scans. It can’t sign in or see anything.
            </DialogDescription>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="token-name">Device name</Label>
              <Input
                id="token-name"
                value={name}
                autoFocus
                placeholder="e.g. Preparation phone camera"
                aria-invalid={!!error}
                aria-describedby={error ? "token-error" : undefined}
                onChange={(e) => setName(e.target.value)}
              />
              {error && (
                <p id="token-error" className="text-sm text-reject">
                  {error}
                </p>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={pending}>
                {pending && <LoaderCircle aria-hidden className="animate-spin" />}
                Create token
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function RevokeTokenButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="destructive" onClick={() => setOpen(true)}>
        Revoke…
      </Button>
      <DialogContent>
        <DialogTitle>Revoke “{name}”?</DialogTitle>
        <DialogDescription>
          The device using it stops being able to send scans immediately. This can’t be undone; you
          can create a new token.
        </DialogDescription>
        {error && <Alert tone="danger">{error}</Alert>}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Keep it</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await revokeTokenAction(id);
                if (result.ok) {
                  toast.success(`“${name}” revoked.`);
                  setOpen(false);
                } else setError(result.error);
              })
            }
          >
            {pending && <LoaderCircle aria-hidden className="animate-spin" />}
            Revoke token
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
