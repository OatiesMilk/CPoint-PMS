import { ROLE_LABELS } from "@/lib/domain";
import { Sidebar } from "@/components/features/app-shell/sidebar";
import { Toaster } from "@/components/ui/toaster";
import { requireUser } from "@/server/policies/guard";
import { navigationFor } from "@/server/policies/navigation";
import { signOutAction } from "./actions";

// Everything inside (app) requires a signed-in, active user. Desktop layout only (D-008).
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();

  return (
    <div className="flex min-h-screen">
      <Sidebar
        sections={navigationFor(user.role)}
        user={{ name: user.name, email: user.email, roleLabel: ROLE_LABELS[user.role] }}
        signOutAction={signOutAction}
      />
      <main className="min-w-0 flex-1 px-10 py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-8">{children}</div>
      </main>
      <Toaster />
    </div>
  );
}
