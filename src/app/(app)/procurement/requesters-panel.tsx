"use client";

import { useState, useTransition } from "react";
import { CircleCheck, Minus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { setRequesterAction } from "./actions";

type Person = { id: string; name: string; email: string; canRequestMaterials: boolean };

/**
 * Who may send purchase requests (D-030). Reversible, so no confirmation: an undo toast instead.
 * The change applies on the person's next click; they stay signed in.
 */
export function RequestersPanel({ people }: { people: Person[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function set(person: Person, value: boolean, quiet = false) {
    setError(null);
    startTransition(async () => {
      const result = await setRequesterAction(person.id, value);
      if (!result.ok) return setError(result.error);
      if (quiet) return;
      toast.success(
        value
          ? `${person.name} can now send purchase requests.`
          : `${person.name} can no longer send purchase requests.`,
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
          Who can request materials
        </h2>
        <p className="text-muted-foreground">
          Only the Shoe Constructors you allow here can send purchase requests. A change applies on
          their next click.
        </p>
      </div>
      {error && <p className="text-sm text-reject">{error}</p>}
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Shoe Constructor</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Requests</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">Change</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {people.map((p) => (
            <TableRow key={p.id} aria-label={p.name}>
              <TableCell className="font-medium">{p.name}</TableCell>
              <TableCell className="text-muted-foreground">{p.email}</TableCell>
              <TableCell>
                {p.canRequestMaterials ? (
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
                  variant={p.canRequestMaterials ? "ghost" : "secondary"}
                  disabled={pending}
                  onClick={() => set(p, !p.canRequestMaterials)}
                >
                  {p.canRequestMaterials ? "Stop requests" : "Allow requests"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
