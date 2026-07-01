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
  const sp = evidence.productPageSignals;
  const parts: string[] = [
    evidence.storeName,
    evidence.homepage.title,
    evidence.homepage.heroHeadline ?? "",
    evidence.homepage.heroSubtitle ?? "",
    evidence.homepage.announcement ?? "",
    ...evidence.homepage.primaryCtas,
    ...evidence.homepage.trustBadges,
    ...evidence.homepage.navItems,
    // Products: text content AND structured fields (availability, image counts,
    // price). Including the structured values means a legitimate citation of a
    // scraped field — e.g. `product.available` = "false" — is recognized as
    // grounded, not just prose. Invented copy still won't match, so the
    // hallucination guard holds.
    ...evidence.products.flatMap((p) => [
      p.title,
      p.descriptionExcerpt,
      p.price ?? "",
      String(p.available),
      String(p.imagesCount),
    ]),
    // Collections: title AND product count (so "productsCount = 0" grounds).
    ...evidence.collections.flatMap((c) => [c.title, String(c.productsCount)]),
    // Product-page signals as structured facts.
    String(sp.ctaText), // "null" when absent
    String(sp.hasReviews),
    String(sp.hasShippingInfo),
    String(sp.hasReturnsInfo),
    String(sp.hasFaq),
  ];
  return normalize(parts.join(" · "));
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Common words ignored when comparing an excerpt against the scrape. */
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "for", "in", "on", "is", "are",
  "with", "this", "that", "by", "at", "from", "as", "it", "its", "was", "we",
]);

/** Meaningful lowercase word tokens (drops punctuation, stopwords, 1-2 char noise). */
function tokenize(s: string): string[] {
  return normalize(s)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

/** Grounding threshold: share of an excerpt's words that must appear in the scrape. */
const GROUNDING_THRESHOLD = 0.6;

/**
 * An opportunity is grounded if every `element`/`text` evidence excerpt is
 * supported by the scrape. We compare on WORD OVERLAP, not exact substring:
 * the model often reformats real data (joining a list as "free shipping, ssl",
 * adding quotes, re-casing), and an exact match would wrongly flag those. A
 * genuinely invented citation shares few words with the scrape and still fails.
 * `missing`-type evidence is exempt — its whole point is that the value is
 * absent from the store.
 */
export function isGrounded(opp: LlmOpportunity, corpus: string): boolean {
  const corpusTokens = new Set(tokenize(corpus));
  return opp.evidence.every((e) => {
    if (e.type === "missing") return true;
    const tokens = tokenize(e.excerpt);
    if (tokens.length === 0) return true; // nothing meaningful to verify
    const present = tokens.filter((t) => corpusTokens.has(t)).length;
    return present / tokens.length >= GROUNDING_THRESHOLD;
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
