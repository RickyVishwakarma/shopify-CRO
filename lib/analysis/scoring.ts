import type { LlmOpportunity, Opportunity, StoreEvidence } from "@/types/audit";

/**
 * Priority scoring + grounding.
 *
 * The LLM proposes `impact`, `confidence`, and `effort` per opportunity, but it
 * does NOT get to set the priority — we compute that here, server-side, so the
 * ranking is deterministic and auditable. We also verify each opportunity's
 * cited evidence actually appears in the scraped data (grounding), which is our
 * programmatic guard against hallucinated citations.
 */

/**
 * priority = (impact × confidence) ÷ effort
 *
 * - impact     1–5  (business upside if fixed)
 * - confidence 0–1  (how sure we are it's a real problem)
 * - effort     1–5  (implementation cost; floored at 1 to avoid div-by-zero)
 *
 * Rounded to 2 decimals. Higher is better.
 */
export function priorityScore(
  impact: number,
  confidence: number,
  effort: number,
): number {
  const safeEffort = Math.max(1, effort);
  const raw = (impact * confidence) / safeEffort;
  return Math.round(raw * 100) / 100;
}

/**
 * Build the searchable corpus of everything we actually scraped. An evidence
 * excerpt is considered "grounded" if its text appears somewhere in here. The
 * comparison is case-insensitive and whitespace-normalized so trivial
 * formatting differences don't cause false negatives.
 */
function buildEvidenceCorpus(evidence: StoreEvidence): string {
  const parts: string[] = [
    evidence.storeName,
    evidence.homepage.title,
    evidence.homepage.heroHeadline ?? "",
    evidence.homepage.heroSubtitle ?? "",
    evidence.homepage.announcement ?? "",
    ...evidence.homepage.primaryCtas,
    ...evidence.homepage.trustBadges,
    ...evidence.homepage.navItems,
    ...evidence.products.flatMap((p) => [p.title, p.descriptionExcerpt, p.price ?? ""]),
    ...evidence.collections.map((c) => c.title),
    evidence.productPageSignals.ctaText ?? "",
  ];
  return normalize(parts.join(" · "));
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * An opportunity is grounded if every `element`/`text` evidence excerpt can be
 * found in the scrape corpus. `missing`-type evidence is exempt — the whole
 * point of "missing" is that the value is absent from the store.
 */
export function isGrounded(opp: LlmOpportunity, corpus: string): boolean {
  return opp.evidence.every((e) => {
    if (e.type === "missing") return true;
    const needle = normalize(e.excerpt);
    if (!needle) return true; // nothing to verify
    return corpus.includes(needle);
  });
}

/** Stable, readable id from the title (plus index to guarantee uniqueness). */
function slugId(title: string, index: number): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `opp-${index + 1}-${slug || "item"}`;
}

/**
 * Turn the LLM's raw opportunities into finished, ranked opportunities:
 * recompute the priority score, attach a grounding flag and id, and sort by
 * priority (highest first), breaking ties by impact.
 */
export function rankOpportunities(
  raw: LlmOpportunity[],
  evidence: StoreEvidence,
): Opportunity[] {
  const corpus = buildEvidenceCorpus(evidence);

  const scored: Opportunity[] = raw.map((opp, i) => ({
    ...opp,
    id: slugId(opp.title, i),
    priorityScore: priorityScore(opp.impact, opp.confidence, opp.effort),
    grounded: isGrounded(opp, corpus),
  }));

  return scored.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    return b.impact - a.impact;
  });
}
