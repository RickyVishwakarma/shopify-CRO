"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Plus, Search, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SummaryHeader } from "./SummaryHeader";
import { PriorityChart } from "./PriorityChart";
import { OpportunityCard } from "./OpportunityCard";
import type { Audit, OpportunityCategory } from "@/types/audit";

const ALL = "All";

export function AuditDashboard({ audit }: { audit: Audit }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(ALL);

  const categories = useMemo(() => {
    const set = new Set<OpportunityCategory>();
    audit.opportunities.forEach((o) => set.add(o.category));
    return [ALL, ...[...set].sort()];
  }, [audit.opportunities]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return audit.opportunities.filter((o) => {
      if (category !== ALL && o.category !== category) return false;
      if (!q) return true;
      return (
        o.title.toLowerCase().includes(q) ||
        o.problem.toLowerCase().includes(q) ||
        o.evidence.some((e) => e.excerpt.toLowerCase().includes(q))
      );
    });
  }, [audit.opportunities, query, category]);

  function exportJson() {
    const blob = new Blob([JSON.stringify(audit, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cro-audit-${audit.storeName.replace(/\W+/g, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">
      <SummaryHeader
        audit={audit}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={exportJson}>
              <Download className="size-3.5" /> JSON
            </Button>
            <Link href="/">
              <Button variant="secondary" size="sm">
                <Plus className="size-3.5" /> New audit
              </Button>
            </Link>
          </>
        }
      />

      {audit.fallback && (
        <div className="mt-5 flex items-start gap-2 rounded-lg border border-[color:var(--warn)]/30 bg-[color:var(--warn)]/10 px-4 py-3 text-sm text-[color:var(--warn)]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            This audit was produced by the deterministic fallback engine (no API
            key configured). Add an <code className="font-mono">ANTHROPIC_API_KEY</code> for
            a deeper, model-driven analysis.
          </span>
        </div>
      )}

      {/* Executive summary */}
      <Card className="mt-6">
        <CardContent>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Executive summary
          </h2>
          <p className="text-sm leading-relaxed text-foreground">
            {audit.executiveSummary}
          </p>
        </CardContent>
      </Card>

      {/* Chart + strengths */}
      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardContent>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Opportunities by priority
            </h2>
            <PriorityChart opportunities={audit.opportunities} />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardContent>
            <h2 className="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <CheckCircle2 className="size-3.5 text-[color:var(--good)]" /> What&apos;s
              working
            </h2>
            <ul className="space-y-2">
              {audit.strengths.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="text-[color:var(--good)]">+</span>
                  {s}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="mt-8 mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-medium text-foreground">
          Opportunities{" "}
          <span className="text-muted-foreground">({filtered.length})</span>
        </h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="h-8 w-44 pl-8 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Category filter chips */}
      <div className="mb-5 flex flex-wrap gap-1.5">
        {categories.map((c) => (
          <button key={c} onClick={() => setCategory(c)}>
            <Badge variant={category === c ? "accent" : "muted"}>{c}</Badge>
          </button>
        ))}
      </div>

      {/* Opportunity list */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <p className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            No opportunities match your filters.
          </p>
        ) : (
          filtered.map((o, i) => (
            <OpportunityCard key={o.id} opportunity={o} rank={i + 1} />
          ))
        )}
      </div>
    </div>
  );
}
