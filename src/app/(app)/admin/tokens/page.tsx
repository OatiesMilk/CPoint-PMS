/*
 * Intent brief (ui-craft §1)
 * Who:   the System Admin, rarely: when a camera is set up, replaced or lost.
 * What:  issue a token for a camera machine, see which tokens are in use, revoke one.
 * Worst: a leaked token keeps working. Revoke is one dialog away and takes effect immediately.
 */
import type { Metadata } from "next";
import { connection } from "next/server";
import { PageHeader } from "@/components/features/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatManilaDateTime } from "@/lib/format";
import { requirePermission } from "@/server/policies/guard";
import { listDeviceTokens } from "@/server/services/api-token.service";
import { NewTokenDialog, RevokeTokenButton } from "./token-dialogs";

export const metadata: Metadata = { title: "API tokens" };

export default async function TokensPage() {
  await requirePermission("token:manage");
  await connection();
  const tokens = await listDeviceTokens();

  return (
    <>
      <PageHeader
        title="API tokens"
        description="Each camera machine sends scans with its own token. Tokens can only send scans."
        actions={<NewTokenDialog />}
      />
      {tokens.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <h2 className="text-xl font-semibold">No tokens yet</h2>
          <p className="max-w-md text-muted-foreground">
            Create one for the Preparation camera (or the simulator) to start sending scans.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Device</TableHead>
              <TableHead>Token starts with</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokens.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell className="font-mono">{t.tokenPrefix}…</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatManilaDateTime(t.createdAt)} by {t.createdBy.name}
                </TableCell>
                <TableCell>
                  {t.lastUsedAt ? (
                    formatManilaDateTime(t.lastUsedAt)
                  ) : (
                    <span className="text-muted-foreground">Never</span>
                  )}
                </TableCell>
                <TableCell>
                  {t.revokedAt ? (
                    <Badge tone="neutral">Revoked</Badge>
                  ) : (
                    <Badge tone="success">Active</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {!t.revokedAt && <RevokeTokenButton id={t.id} name={t.name} />}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
