import Link from "next/link";
import { ArrowRight, CircleAlert, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Workforce } from "@/lib/attendance-rules";

/**
 * Today's attendance on the Floor Manager's home (D-077): the line's count, never a name. Not
 * taken yet is said plainly, never shown as 0 present.
 */
export function AttendanceCard({ workforce, summary }: { workforce: Workforce; summary: string }) {
  return (
    <Card data-testid="attendance-card">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Attendance</CardTitle>
            <CardDescription>Who came in today.</CardDescription>
          </div>
          {workforce.taken && (
            <Link
              href="/attendance"
              className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
            >
              Edit
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {workforce.taken ? (
          <p className="flex items-center gap-2 text-lg">
            <UsersRound aria-hidden className="size-5 text-muted-foreground" />
            {summary}
          </p>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="flex items-center gap-2">
              <CircleAlert aria-hidden className="size-4 text-caution" />
              Not taken yet today.
            </p>
            <Button asChild size="sm">
              <Link href="/attendance">Take attendance</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
