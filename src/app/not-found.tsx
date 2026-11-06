import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-10 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-muted">
        <FileQuestion aria-hidden className="size-7 text-muted-foreground" />
      </span>
      <p className="text-sm font-medium text-muted-foreground">Error 404</p>
      <h1 className="text-2xl font-semibold tracking-tight">This page doesn’t exist</h1>
      <p className="max-w-md text-muted-foreground">
        The link may be old or mistyped. Nothing was changed.
      </p>
      <Button asChild className="mt-2">
        <Link href="/">Go to your overview</Link>
      </Button>
    </main>
  );
}
