"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const EXAMPLES = ["drsquatch.com", "allbirds.com", "deathwishcoffee.com"];
const STAGES = [
  "Validating URL…",
  "Reading the store catalog…",
  "Extracting on-page evidence…",
  "Analyzing conversion opportunities…",
  "Scoring and ranking…",
];

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Advance the staged loading message while the request is in flight.
  useEffect(() => {
    if (!loading) return;
    const t = setInterval(
      () => setStage((s) => Math.min(s + 1, STAGES.length - 1)),
      1600,
    );
    return () => clearInterval(t);
  }, [loading]);

  async function runAudit(target: string) {
    setError(null);
    setLoading(true);
    setStage(0);
    try {
      const res = await fetch("/api/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "Something went wrong.");
        setLoading(false);
        return;
      }
      router.push(`/audit/${data.id}`);
    } catch {
      setError("Network error — is the server reachable?");
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (url.trim()) runAudit(url.trim());
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-xl py-20 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-[color:var(--good)]" />
          Shopify CRO Opportunity Engine
        </div>

        <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Find what&apos;s costing a store conversions
        </h1>
        <p className="mx-auto mt-4 max-w-md text-balance text-muted-foreground">
          Paste any Shopify store URL and get a prioritized, evidence-backed CRO
          audit — grounded in the store&apos;s real catalog and pages.
        </p>

        <form onSubmit={onSubmit} className="mx-auto mt-8 flex max-w-md gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="gymshark.com"
            disabled={loading}
            autoFocus
            aria-label="Shopify store URL"
          />
          <Button type="submit" disabled={loading || !url.trim()}>
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                Audit <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </form>

        {!loading && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
            <span>Try:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => {
                  setUrl(ex);
                  runAudit(ex);
                }}
                className="rounded-md border border-border px-2 py-1 transition-colors hover:border-ring hover:text-foreground"
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {STAGES[stage]}
          </div>
        )}

        {error && (
          <div className="mx-auto mt-6 flex max-w-md items-start gap-2 rounded-lg border border-[color:var(--bad)]/30 bg-[color:var(--bad)]/10 px-4 py-3 text-left text-sm text-[color:var(--bad)]">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
