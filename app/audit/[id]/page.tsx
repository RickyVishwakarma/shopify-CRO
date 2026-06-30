import Link from "next/link";
import { getAudit } from "@/lib/orchestrator";
import { AuditDashboard } from "@/components/audit/AuditDashboard";

export const runtime = "nodejs";
// The audit lives in the in-process cache, so render on demand (not at build).
export const dynamic = "force-dynamic";

export default async function AuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const audit = await getAudit(id);

  if (!audit) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <div className="max-w-md py-20 text-center">
          <h1 className="text-xl font-semibold text-foreground">
            Audit not found
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This audit may have expired from the cache, or the link is wrong.
            Audits are held in memory and don&apos;t persist across restarts.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-lg border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
          >
            Run a new audit
          </Link>
        </div>
      </main>
    );
  }

  return <AuditDashboard audit={audit} />;
}
