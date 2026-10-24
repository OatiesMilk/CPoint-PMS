"use client";

import { focusFirstInvalid } from "@/lib/focus-first-invalid";
import { useState, useTransition } from "react";
import { LoaderCircle, MoreHorizontal, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { ShownOnceSecret } from "@/components/features/admin/shown-once-secret";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ROLE_LABELS, type Role } from "@/lib/domain";
import { userFormSchema } from "@/server/validators/user.validator";
import { setCameraOperatorAction } from "../../camera/actions";
import {
  createUserAction,
  resetPasswordAction,
  setUserActiveAction,
  unlockUserAction,
  updateUserAction,
} from "./actions";

const ROLES = Object.keys(ROLE_LABELS) as Role[];
type Values = { name: string; email: string; role: Role | "" };
type Secret = { name: string; temporaryPassword: string };

function TemporaryPassword({ secret, reset }: { secret: Secret; reset?: boolean }) {
  return (
    <>
      <DialogTitle>
        {reset ? `New temporary password for ${secret.name}` : `${secret.name} can sign in now`}
      </DialogTitle>
      <DialogDescription>
        Give it to {secret.name.split(" ")[0]} in person. They’ll choose their own password when
        they sign in{reset ? "; any session they had open has ended" : ""}.
      </DialogDescription>
      <ShownOnceSecret
        value={secret.temporaryPassword}
        label="Temporary password"
        warning="Only a hash is stored. If it’s lost, reset the password again."
      />
      <DialogFooter>
        <DialogClose asChild>
          <Button>Done</Button>
        </DialogClose>
      </DialogFooter>
    </>
  );
}

function UserFields({
  values,
  setValues,
  errors,
  roleLocked,
}: {
  values: Values;
  setValues: (v: Values) => void;
  errors: Record<string, string>;
  roleLocked?: string;
}) {
  const field = (key: "name" | "email", label: string, type = "text", placeholder?: string) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`user-${key}`}>{label}</Label>
      <Input
        id={`user-${key}`}
        type={type}
        autoComplete="off"
        placeholder={placeholder}
        value={values[key]}
        aria-invalid={!!errors[key]}
        aria-describedby={errors[key] ? `user-${key}-error` : undefined}
        onChange={(e) => setValues({ ...values, [key]: e.target.value })}
      />
      {errors[key] && (
        <p id={`user-${key}-error`} className="text-sm text-reject">
          {errors[key]}
        </p>
      )}
    </div>
  );
  return (
    <>
      {field("name", "Name", "text", "e.g. Ivy Santos")}
      {field("email", "Email", "email", "name@cpoint.local")}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="user-role">Role</Label>
        <Select
          id="user-role"
          value={values.role}
          disabled={!!roleLocked}
          aria-invalid={!!errors.role}
          aria-describedby={
            errors.role ? "user-role-error" : roleLocked ? "user-role-hint" : undefined
          }
          onChange={(e) => setValues({ ...values, role: e.target.value as Role })}
        >
          <option value="" disabled>
            Choose…
          </option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
        {errors.role ? (
          <p id="user-role-error" className="text-sm text-reject">
            {errors.role}
          </p>
        ) : (
          roleLocked && (
            <p id="user-role-hint" className="text-sm text-muted-foreground">
              {roleLocked}
            </p>
          )
        )}
      </div>
    </>
  );
}

function validate(values: Values): Record<string, string> | null {
  const parsed = userFormSchema.safeParse(values);
  if (parsed.success) return null;
  const out: Record<string, string> = {};
  for (const issue of parsed.error.issues) out[String(issue.path[0])] ??= issue.message;
  return out;
}

export function NewUserDialog() {
  const empty: Values = { name: "", email: "", role: "" };
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Values>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [secret, setSecret] = useState<Secret | null>(null);
  const [pending, startTransition] = useTransition();

  function change(next: boolean) {
    setOpen(next);
    if (!next) {
      setValues(empty);
      setErrors({});
      setFormError(null);
      setSecret(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        Add user
      </Button>
      <DialogContent>
        {secret ? (
          <TemporaryPassword secret={secret} />
        ) : (
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const invalid = validate(values);
              setErrors(invalid ?? {});
              if (invalid) return focusFirstInvalid(form);
              setFormError(null);
              startTransition(async () => {
                const result = await createUserAction(values);
                if (result.ok) setSecret(result);
                else if (result.fieldErrors) {
                  setErrors(result.fieldErrors);
                  focusFirstInvalid(form);
                } else setFormError(result.error);
              });
            }}
          >
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>
              They get a temporary password and choose their own the first time they sign in.
            </DialogDescription>
            {formError && <Alert tone="danger">{formError}</Alert>}
            <UserFields values={values} setValues={setValues} errors={errors} />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={pending}>
                {pending && <LoaderCircle aria-hidden className="animate-spin" />}
                Create account
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

type Row = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  status: "ACTIVE" | "DEACTIVATED" | "LOCKED";
  canCapture: boolean;
};

/**
 * Per-row actions. `selfReason`/`lastAdminReason` come from the same rules the server enforces
 * (src/lib/admin-rules.ts), so a refused action is disabled with its reason instead of failing.
 */
export function UserRowActions({
  user,
  isSelf,
  lastAdmin,
}: {
  user: Row;
  isSelf: boolean;
  lastAdmin: boolean;
}) {
  const [dialog, setDialog] = useState<"edit" | "reset" | "deactivate" | null>(null);
  const [values, setValues] = useState<Values>({
    name: user.name,
    email: user.email,
    role: user.role,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<Secret | null>(null);
  const [pending, startTransition] = useTransition();
  const first = user.name.split(" ")[0];

  const roleLocked = isSelf
    ? "You can't change your own role."
    : lastAdmin
      ? "This is the last active System Admin. Make another account a System Admin first."
      : undefined;
  const cantDeactivate = isSelf
    ? "You can't deactivate your own account."
    : lastAdmin
      ? "The last active System Admin can't be deactivated."
      : undefined;

  function open(kind: typeof dialog) {
    setValues({ name: user.name, email: user.email, role: user.role });
    setErrors({});
    setError(null);
    setSecret(null);
    setDialog(kind);
  }

  function reactivate() {
    startTransition(async () => {
      const result = await setUserActiveAction(user.id, true);
      if (result.ok) toast.success(`${user.name} can sign in again.`);
      else toast.error(result.error);
    });
  }

  /** Camera access (D-075; Phase 26: the System Admin only grants it). */
  function setOperator(value: boolean, quiet = false) {
    startTransition(async () => {
      const result = await setCameraOperatorAction(user.id, value);
      if (!result.ok) return void toast.error(result.error);
      if (quiet) return;
      toast.success(
        value
          ? `${user.name} can now capture rolls on their phone.`
          : `${user.name} can no longer capture rolls.`,
        { duration: 6000, action: { label: "Undo", onClick: () => setOperator(!value, true) } },
      );
    });
  }

  function unlock() {
    startTransition(async () => {
      const result = await unlockUserAction(user.id);
      if (result.ok) toast.success(`${user.name} is unlocked and can try again.`);
      else toast.error(result.error);
    });
  }

  return (
    <>
      <div className="flex justify-end gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => open("edit")}
          aria-label={`Edit ${user.name}`}
        >
          <Pencil aria-hidden />
          Edit
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" aria-label={`More actions for ${user.name}`}>
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={isSelf || !user.isActive} onSelect={() => open("reset")}>
              Reset password…
            </DropdownMenuItem>
            {user.status === "LOCKED" && (
              <DropdownMenuItem onSelect={unlock}>Unlock</DropdownMenuItem>
            )}
            {user.role === "SHOE_CONSTRUCTOR" && user.isActive && (
              <DropdownMenuItem onSelect={() => setOperator(!user.canCapture)}>
                {user.canCapture ? "Remove camera access" : "Give camera access"}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {user.isActive ? (
              <DropdownMenuItem
                disabled={!!cantDeactivate}
                className="text-reject"
                onSelect={() => open("deactivate")}
              >
                <span className="flex flex-col">
                  Deactivate…
                  {cantDeactivate && (
                    <span className="text-xs text-muted-foreground">{cantDeactivate}</span>
                  )}
                </span>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={reactivate}>Reactivate</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          {dialog === "edit" && (
            <form
              noValidate
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const invalid = validate(values);
                setErrors(invalid ?? {});
                if (invalid) return focusFirstInvalid(form);
                startTransition(async () => {
                  const result = await updateUserAction(user.id, values);
                  if (result.ok) {
                    toast.success(`${values.name} saved.`);
                    setDialog(null);
                  } else if (result.fieldErrors) {
                    setErrors(result.fieldErrors);
                    focusFirstInvalid(form);
                  } else setError(result.error);
                });
              }}
            >
              <DialogTitle>Edit {user.name}</DialogTitle>
              <DialogDescription>
                A role change applies the next time they open a page.
              </DialogDescription>
              {error && <Alert tone="danger">{error}</Alert>}
              <UserFields
                values={values}
                setValues={setValues}
                errors={errors}
                roleLocked={roleLocked}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="ghost">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={pending}>
                  {pending && <LoaderCircle aria-hidden className="animate-spin" />}
                  Save changes
                </Button>
              </DialogFooter>
            </form>
          )}

          {dialog === "reset" &&
            (secret ? (
              <TemporaryPassword secret={secret} reset />
            ) : (
              <>
                <DialogTitle>Reset {user.name}’s password?</DialogTitle>
                <DialogDescription>
                  {first} is signed out everywhere and gets a temporary password from you. Their
                  current password stops working.
                </DialogDescription>
                {error && <Alert tone="danger">{error}</Alert>}
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="ghost">Cancel</Button>
                  </DialogClose>
                  <Button
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await resetPasswordAction(user.id);
                        if (result.ok) setSecret(result);
                        else setError(result.error);
                      })
                    }
                  >
                    {pending && <LoaderCircle aria-hidden className="animate-spin" />}
                    Reset password
                  </Button>
                </DialogFooter>
              </>
            ))}

          {dialog === "deactivate" && (
            <>
              <DialogTitle>Deactivate {user.name}?</DialogTitle>
              <DialogDescription>
                {first} is signed out on their next click and can’t sign in. Their records and
                history stay. You can reactivate the account later.
              </DialogDescription>
              {error && <Alert tone="danger">{error}</Alert>}
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">Keep active</Button>
                </DialogClose>
                <Button
                  variant="destructive"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await setUserActiveAction(user.id, false);
                      if (result.ok) {
                        toast.success(`${user.name} deactivated.`);
                        setDialog(null);
                      } else setError(result.error);
                    })
                  }
                >
                  {pending && <LoaderCircle aria-hidden className="animate-spin" />}
                  Deactivate account
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
