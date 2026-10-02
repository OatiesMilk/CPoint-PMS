/*
 * Intent brief (ui-craft §1)
 * Who:   the team and the capstone panel, at a desk, checking that the rebuilt foundation runs.
 * What:  answer "is the system up, and is the database connected?" at a glance.
 * Worst: showing "running" while the database is down, so the status is a real check, never static.
 *
 * Temporary page: Phase 1 replaces it with sign-in and the role dashboards.
 */
import Image from "next/image";
import { connection } from "next/server";
import { Camera, CheckCircle2, CircleAlert, Database, Server } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { VerdictBadge, type Verdict } from "@/components/features/verdict-badge";
import { getHealth } from "@/server/services/health.service";
import logo from "../../public/images/cpoint-logo.jpg";

const stages = [
  { name: "Preparation", note: "Camera checkpoint before cutting" },
  { name: "Upper Making", note: null },
  { name: "Sole-ing", note: null },
  { name: "Finishing", note: null },
];

const outcomes: { verdict: Verdict; meaning: string }[] = [
  { verdict: "PASS", meaning: "Section continues to the cutting station." },
  { verdict: "REWORK", meaning: "Sent to the repair station; counts in the batch once repaired." },
  { verdict: "REJECT", meaning: "Pulled from the line and kept as salvage for later batches." },
  { verdict: "NEEDS_REVIEW", meaning: "Inspector or floor manager decides." },
];

// Display in factory time regardless of where the server runs (stored/transported as UTC).
function formatManila(iso: string) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default async function Home() {
  await connection(); // always check live health at request time, never at build time
  const health = await getHealth();
  const dbUp = health.checks.database === "up";

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-10">
      <header className="flex items-center justify-between py-6">
        <div className="flex items-center gap-3">
          <Image src={logo} alt="CPoint Shoe Store" className="size-10 rounded-md" priority />
          <div className="leading-tight">
            <p className="text-lg font-semibold">CPoint</p>
            <p className="text-sm text-muted-foreground">Product Monitoring System</p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 flex-col gap-12 py-10">
        <section aria-labelledby="status-heading" className="flex flex-col gap-6">
          <div className="flex items-start gap-3">
            {dbUp ? (
              <CheckCircle2 aria-hidden className="mt-1 size-7 text-pass" />
            ) : (
              <CircleAlert aria-hidden className="mt-1 size-7 text-reject" />
            )}
            <div>
              <h1 id="status-heading" className="text-3xl font-semibold tracking-tight">
                {dbUp ? "System foundation is running" : "The database is not reachable"}
              </h1>
              <p className="mt-1 text-lg text-muted-foreground">
                {dbUp
                  ? "The app and database are connected. Sign-in and role dashboards arrive in Phase 1."
                  : "The app is up but can't reach PostgreSQL. Nothing has been lost, because no data is stored yet."}
              </p>
            </div>
          </div>

          <dl className="grid max-w-xl grid-cols-2 overflow-hidden rounded-lg border bg-card shadow-1">
            <div className="flex items-center gap-3 border-r p-4">
              <Server aria-hidden className="size-5 text-muted-foreground" />
              <div>
                <dt className="text-sm text-muted-foreground">Application</dt>
                <dd className="font-medium text-pass">Up</dd>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4">
              <Database aria-hidden className="size-5 text-muted-foreground" />
              <div>
                <dt className="text-sm text-muted-foreground">Database</dt>
                <dd className={dbUp ? "font-medium text-pass" : "font-medium text-reject"}>
                  {dbUp ? "Connected" : "Down"}
                </dd>
              </div>
            </div>
          </dl>

          {!dbUp && (
            <p className="max-w-xl rounded-md bg-reject-soft p-4 text-reject">
              Start it with <code className="font-mono">docker compose up -d db</code>, then reload
              this page. If it keeps failing, check <code className="font-mono">DATABASE_URL</code>{" "}
              in <code className="font-mono">.env</code>.
            </p>
          )}
        </section>

        <section aria-labelledby="line-heading" className="flex flex-col gap-4">
          <h2 id="line-heading" className="text-xl font-semibold">
            Production line
          </h2>
          <ol className="grid grid-cols-4 gap-3">
            {stages.map((stage, index) => (
              <li key={stage.name} className="rounded-lg border bg-card p-4 shadow-1">
                <p className="text-sm text-muted-foreground">Stage {index + 1}</p>
                <p className="text-lg font-semibold">{stage.name}</p>
                {stage.note && (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-sm bg-brand-yellow px-2 py-0.5 text-sm font-medium text-brand-ink">
                    <Camera aria-hidden className="size-3.5" />
                    {stage.note}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="outcomes-heading" className="flex flex-col gap-4">
          <h2 id="outcomes-heading" className="text-xl font-semibold">
            Inspection outcomes
          </h2>
          <ul className="grid max-w-3xl grid-cols-[auto_1fr] items-center gap-x-6 gap-y-3">
            {outcomes.map(({ verdict, meaning }) => (
              <li key={verdict} className="contents">
                <VerdictBadge verdict={verdict} className="justify-self-start" />
                <span className="text-muted-foreground">{meaning}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="flex justify-between border-t py-6 text-sm text-muted-foreground">
        <span>Version {health.version}</span>
        <time dateTime={health.time}>Checked {formatManila(health.time)}</time>
      </footer>
    </div>
  );
}
