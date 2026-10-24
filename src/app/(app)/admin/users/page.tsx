/*
 * Intent brief (ui-craft §1)
 * Who:   the System Admin, occasionally: a new hire, someone locked out, someone leaving.
 * What:  find the person and do the one thing needed: add, edit, reset, unlock, deactivate.
 * Worst: locking everyone out (deactivating the last admin) or a password shared on paper staying
 *        in use. The last-admin rule is enforced and explained; temporary passwords force a change.
 */
import type { Metadata } from "next";
import { MATCHING, TablePager } from "@/components/features/table-pager";
import Link from "next/link";
import { connection } from "next/server";
import { Aperture, CircleCheck, CircleSlash, LockKeyhole } from "lucide-react";
import { PageHeader } from "@/components/features/page-header";
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
import { ROLE_LABELS } from "@/lib/domain";
import { formatManilaDateTime } from "@/lib/format";
import { requirePermission } from "@/server/policies/guard";
import { listUsers, userSummary } from "@/server/services/user-admin.service";
import { userListQuerySchema } from "@/server/validators/user.validator";
import { NewUserDialog, UserRowActions } from "./user-dialogs";
import { UserFilters } from "./user-filters";

export const metadata: Metadata = { title: "Users" };

const STATUS = {
  ACTIVE: { tone: "success", Icon: CircleCheck, label: "Active" },
  LOCKED: { tone: "warning", Icon: LockKeyhole, label: "Locked" },
  DEACTIVATED: { tone: "neutral", Icon: CircleSlash, label: "Deactivated" },
} as const;

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const admin = await requirePermission("user:manage");
  await connection();
  const query = userListQuerySchema.parse(await searchParams);
  const [{ rows, total, page, pageCount }, summary] = await Promise.all([
    listUsers(query),
    userSummary(),
  ]);
  const activeAdmins = summary.byRole.find((r) => r.role === "SYSTEM_ADMIN")?.count ?? 0;
  const filtered = Boolean(query.role || query.status || query.q);

  const pageHref = (p: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v && k !== "page") next.set(k, String(v));
    if (p > 1) next.set("page", String(p));
    const qs = next.toString();
    return qs ? `/admin/users?${qs}` : "/admin/users";
  };

  return (
    <>
      <PageHeader
        title="Users"
        description="Accounts for the Floor Manager, Quality Inspectors, admins and constructors."
        actions={<NewUserDialog />}
      />
      <UserFilters />

      {total === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <h2 className="text-xl font-semibold">No accounts match these filters</h2>
          <Button asChild variant="secondary" className="mt-2">
            <Link href="/admin/users">Clear filters</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last sign-in</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((u) => {
                const s = STATUS[u.status];
                const isSelf = u.id === admin.id;
                return (
                  <TableRow key={u.id} aria-label={u.email}>
                    <TableCell className="font-medium">
                      {u.name}
                      {isSelf && <span className="ml-2 text-sm text-muted-foreground">(you)</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {ROLE_LABELS[u.role]}
                        {u.canCapture && (
                          <Badge tone="neutral">
                            <Aperture aria-hidden />
                            Camera
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge tone={s.tone}>
                          <s.Icon aria-hidden />
                          {s.label}
                        </Badge>
                        {u.mustChangePassword && u.isActive && (
                          <Badge tone="info">Temporary password</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.lastLoginAt ? formatManilaDateTime(u.lastLoginAt) : "Never"}
                    </TableCell>
                    <TableCell>
                      <UserRowActions
                        user={u}
                        isSelf={isSelf}
                        lastAdmin={u.role === "SYSTEM_ADMIN" && u.isActive && activeAdmins <= 1}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <TablePager
            page={page}
            pageCount={pageCount}
            total={total}
            noun={["account", "accounts"]}
            suffix={filtered ? MATCHING : ""}
            href={pageHref}
          />
        </div>
      )}
    </>
  );
}
