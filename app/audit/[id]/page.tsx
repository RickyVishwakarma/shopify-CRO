"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { AuditDashboard } from "@/components/audit/AuditDashboard";
import type { Audit } from "@/types/audit";

type State = "loading" | "ready" | "notfound";

/**
 * Resolve an audit by id: prefer the copy the landing page stashed in
 * sessionStorage (reliable on serverless, where the in-memory server cache
 * isn't shared across instances), then fall back to the API for shared/direct
 * links. Returns null when neither source has it.
 */
async function resolveAudit(id: string): Promise<Audit | null> {
  try {
    const stashed = sessionStorage.getItem(`audit:${id}`);
    if (stashed) return JSON.parse(stashed) as Audit;
  } catch {
    // sessionStorage unavailable — fall through to the API
  }
  try {
    const res = await fetch(`/api/audits/${id}`);
    if (res.ok) return (await res.json()) as Audit;
  } catch {
    // network error — treated as not found below
  }
  return null;
}

export default function AuditPage() {
  const { id } = useParams<{ id: string }>();
  const [audit, setAudit] = useState<Audit | null>(null);
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    if (!id) return;
    let alive = true;
    resolveAudit(id).then((result) => {
      if (!alive) return;
      if (result) {
        setAudit(result);
        setState("ready");
      } else {
        setState("notfound");
      }
    });
    return () => {
      alive = false;
    };
  }, [id]);

  if (state === "loading") {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <div className="flex items-center gap-2 py-20 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading audit…
        </div>
      </main>
    );
  }

  if (state === "notfound" || !audit) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <div className="max-w-md py-20 text-center">
          <h1 className="text-xl font-semibold text-foreground">Audit not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This audit may have expired from the cache, or the link is wrong.
            Audits are held in memory and don&apos;t persist indefinitely.
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
