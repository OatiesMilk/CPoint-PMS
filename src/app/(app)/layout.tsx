import { ROLE_LABELS } from "@/lib/domain";
import { Sidebar } from "@/components/features/app-shell/sidebar";
import { DemoBand } from "@/components/features/demo-band";
import { demoToolsEnabled } from "@/server/services/demo-tools.service";
import { BatchNoticeBanner } from "@/components/features/batches/batch-notices";
import { QueryProvider } from "@/components/providers/query-provider";
import { Toaster } from "@/components/ui/toaster";
import { requireUser } from "@/server/policies/guard";
import { navigationFor } from "@/server/policies/navigation";
import { signOutAction } from "./actions";

// Everything inside (app) requires a signed-in, active user. Desktop first; the layout adapts to narrower windows (D-034)
// and pages use the full width beside the sidebar (D-046). Forms and running text keep their own widths.
// Below 640 px the sidebar becomes a top bar, for Capture on a phone (Phase 26, D-096).
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  // Batch notices (Phase 27, A-9): the QI, and the FM on a day they cover (the browser asks).
  const notices = user.role === "QUALITY_INSPECTOR" || user.role === "FLOOR_MANAGER";

  return (
    <QueryProvider>
      <DemoBand on={demoToolsEnabled()} />
      <div className="flex min-h-screen flex-col sm:flex-row">
        {/* Printing (a claim sheet, Phase 20) leaves the navigation out. */}
        <div className="contents print:hidden">
          <Sidebar
            sections={navigationFor(user)}
            user={{ name: user.name, email: user.email, roleLabel: ROLE_LABELS[user.role] }}
            signOutAction={signOutAction}
            bell={notices}
          />
        </div>
        <main className="min-w-0 flex-1 px-4 py-6 lg:px-10 lg:py-8 print:p-0">
          <div className="flex flex-col gap-8">
            {notices && (
              <div className="empty:hidden print:hidden">
                <BatchNoticeBanner />
              </div>
            )}
            {children}
          </div>
        </main>
        <Toaster />
      </div>
    </QueryProvider>
  );
}
