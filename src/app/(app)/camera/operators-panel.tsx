"use client";

import { useState, useTransition } from "react";
import { CircleCheck, Minus, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MATCHING, TablePager } from "@/components/features/table-pager";
import { usePagedRows } from "@/lib/use-paged-rows";
import { setCameraOperatorAction } from "./actions";

type Person = { id: string; name: string; email: string; canCapture: boolean };

/** Name and email, for the find box. */
function personText(p: Person): string {
  return `${p.name} ${p.email}`;
}

/**
 * Which Shoe Constructors may capture at the camera (D-075), usually whoever feeds the fixed
 * camera at Preparation. Reversible, so no confirmation: an undo toast instead. The change applies
 * on the person's next click; they stay signed in.
 */
export function OperatorsPanel({ people }: { people: Person[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const list = usePagedRows(people, personText);

  function set(person: Person, value: boolean, quiet = false) {
    setError(null);
    startTransition(async () => {
      const result = await setCameraOperatorAction(person.id, value);
      if (!result.ok) return setError(result.error);
      if (quiet) return;
      toast.success(
        value
          ? `${person.name} can now capture at the camera.`
          : `${person.name} can no longer capture at the camera.`,
        { duration: 6000, action: { label: "Undo", onClick: () => set(person, !value, true) } },
      );
    });
  }

  return (
    <section aria-labelledby="operators-heading" className="flex flex-col gap-3">
      <div>
        <h2 id="operators-heading" className="text-xl font-semibold">
          Camera operators
        </h2>
        <p className="text-muted-foreground">
          The Quality Inspector and the Floor Manager can always capture. Allow the Shoe
          Constructors who feed the camera at Preparation; they get Capture and its Floor view, and
          each scan is recorded under their own name. A change applies on their next click.
        </p>
      </div>
      {error && <p className="text-sm text-reject">{error}</p>}
      {people.length === 0 ? (
        <p className="rounded-lg border border-dashed px-5 py-10 text-center text-muted-foreground">
          There are no active Shoe Constructor accounts. The System Admin adds them under Users.
        </p>
      ) : (
        <>
          <div className="flex w-72 flex-col gap-1.5">
            <Label htmlFor="find-operator">Find a Shoe Constructor</Label>
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="find-operator"
                type="search"
                className="pl-9"
                placeholder="Name or email"
                value={list.query}
                onChange={(e) => list.setQuery(e.target.value)}
              />
            </div>
          </div>
          {list.total === 0 ? (
            <p className="rounded-lg border border-dashed px-5 py-10 text-center text-muted-foreground">
              No Shoe Constructor matches “{list.query.trim()}”. Check the spelling, or clear the
              search.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Shoe Constructor</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Camera</TableHead>
                    <TableHead className="text-right">
                      <span className="sr-only">Change</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.shown.map((p) => (
                    <TableRow key={p.id} aria-label={p.name}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground">{p.email}</TableCell>
                      <TableCell>
                        {p.canCapture ? (
                          <Badge tone="success">
                            <CircleCheck aria-hidden />
                            Can capture
                          </Badge>
                        ) : (
                          <Badge>
                            <Minus aria-hidden />
                            Can’t capture
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={p.canCapture ? "ghost" : "secondary"}
                          disabled={pending}
                          onClick={() => set(p, !p.canCapture)}
                        >
                          {p.canCapture ? "Stop capturing" : "Allow capturing"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePager
                page={list.page}
                pageCount={list.pageCount}
                total={list.total}
                noun={["Shoe Constructor", "Shoe Constructors"]}
                suffix={list.query.trim() ? MATCHING : ""}
                onPage={list.setPage}
              />
            </>
          )}
        </>
      )}
    </section>
  );
}
