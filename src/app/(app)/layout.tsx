import { ROLE_LABELS } from "@/lib/domain";
import { Sidebar } from "@/components/features/app-shell/sidebar";
import { QueryProvider } from "@/components/providers/query-provider";
import { Toaster } from "@/components/ui/toaster";
import { requireUser } from "@/server/policies/guard";
import { navigationFor } from "@/server/policies/navigation";
import { signOutAction } from "./actions";

// Everything inside (app) requires a signed-in, active user. Desktop first; the layout adapts to narrower windows (D-034)
// and pages use the full width beside the sidebar (D-046). Forms and running text keep their own widths.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();

  return (
    <div className="flex min-h-screen">
      <Sidebar
        sections={navigationFor(user.role)}
        user={{ name: user.name, email: user.email, roleLabel: ROLE_LABELS[user.role] }}
        signOutAction={signOutAction}
      />
      <main className="min-w-0 flex-1 px-4 py-6 lg:px-10 lg:py-8">
        <QueryProvider>
          <div className="flex flex-col gap-8">{children}</div>
        </QueryProvider>
      </main>
      <Toaster />
    </div>
  );
}
