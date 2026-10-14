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
import { setRequesterAction } from "./actions";

type Person = { id: string; name: string; email: string; canRequestLeatherRolls: boolean };

/**
 * Who may request leather rolls (D-031); every constructor can request the other materials. Reversible, so no confirmation: an undo toast instead.
 * The change applies on the person's next click; they stay signed in.
 */
/** Name and email, for the find box. */
function personText(p: Person): string {
  return `${p.name} ${p.email}`;
}

export function RequestersPanel({ people }: { people: Person[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const list = usePagedRows(people, personText);

  function set(person: Person, value: boolean, quiet = false) {
    setError(null);
    startTransition(async () => {
      const result = await setRequesterAction(person.id, value);
      if (!result.ok) return setError(result.error);
      if (quiet) return;
      toast.success(
        value
          ? `${person.name} can now request leather rolls.`
          : `${person.name} can no longer request leather rolls.`,
        {
          duration: 6000,
          action: { label: "Undo", onClick: () => set(person, !value, true) },
        },
      );
    });
  }

  if (people.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-5 py-10 text-center text-muted-foreground">
        There are no active Shoe Constructor accounts. The System Admin adds them under Users.
      </p>
    );
  }

  return (
    <section aria-labelledby="requesters-heading" className="flex flex-col gap-3">
      <div>
        <h2 id="requesters-heading" className="text-xl font-semibold">
          Who can request leather rolls
        </h2>
        <p className="text-muted-foreground">
          Every Shoe Constructor can request nails, thread, adhesive and other supplies. Only those
          you allow here can also request leather rolls. A change applies on their next click.
        </p>
      </div>
      {error && <p className="text-sm text-reject">{error}</p>}
      <div className="flex w-72 flex-col gap-1.5">
        <Label htmlFor="find-requester">Find a Shoe Constructor</Label>
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="find-requester"
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
                <TableHead>Leather rolls</TableHead>
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
                    {p.canRequestLeatherRolls ? (
                      <Badge tone="success">
                        <CircleCheck aria-hidden />
                        Can request
                      </Badge>
                    ) : (
                      <Badge>
                        <Minus aria-hidden />
                        Can’t request
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant={p.canRequestLeatherRolls ? "ghost" : "secondary"}
                      disabled={pending}
                      onClick={() => set(p, !p.canRequestLeatherRolls)}
                    >
                      {p.canRequestLeatherRolls ? "Stop leather rolls" : "Allow leather rolls"}
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
    </section>
  );
}
