import { randomUUID } from "node:crypto";
import { validateStoreUrl } from "@/lib/validation/url";
import { scrapeStore } from "@/lib/scraper";
import { analyzeStore } from "@/lib/llm";
import { rankOpportunities } from "@/lib/analysis/scoring";
import { getCache } from "@/lib/cache";
import type { Audit, StoreEvidence } from "@/types/audit";

/**
 * The orchestrator: the single entry point that turns a URL into a finished,
 * cached Audit. It composes the independently-tested pieces (validate → scrape
 * → analyze → score) and owns caching and id assignment. Routes call this; it
 * has no knowledge of HTTP, which keeps it easy to test and reuse.
 */

export class NotShopifyError extends Error {
  constructor() {
    super("This doesn't look like a Shopify store — no catalog could be read.");
    this.name = "NotShopifyError";
  }
}

const urlKey = (normalized: string) => `url:${normalized}`;
const auditKey = (id: string) => `audit:${id}`;

export interface RunAuditOptions {
  /** Skip the cache and force a fresh audit. */
  fresh?: boolean;
  maxProducts?: number;
}

/**
 * Run (or return a cached) audit for a store URL.
 * @throws UrlValidationError on bad input, NotShopifyError when the store has no readable catalog.
 */
export async function runAudit(
  input: string,
  opts: RunAuditOptions = {},
): Promise<Audit> {
  const { normalized, hostname, href } = validateStoreUrl(input);
  const cache = getCache();

  // Cache lookup by normalized URL → audit id → audit.
  if (!opts.fresh) {
    const cachedId = await cache.get<string>(urlKey(normalized));
    if (cachedId) {
      const cached = await cache.get<Audit>(auditKey(cachedId));
      if (cached) return cached;
    }
  }

  const evidence = await scrapeStore(normalized, hostname, {
    maxProducts: opts.maxProducts,
  });

  // If we couldn't read any catalog at all, this almost certainly isn't a
  // Shopify store (or it's blocking us) — fail with a clear, typed error
  // instead of returning a hollow audit.
  if (!isUsableEvidence(evidence)) {
    throw new NotShopifyError();
  }

  const { audit: raw, model, fallback } = await analyzeStore(evidence);
  const opportunities = rankOpportunities(raw.opportunities, evidence);

  const audit: Audit = {
    id: `aud_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
    url: href,
    storeName: evidence.storeName,
    scrapedAt: new Date().toISOString(),
    model,
    fallback,
    executiveSummary: raw.executiveSummary,
    summary: raw.summary,
    strengths: raw.strengths,
    issues: raw.issues,
    opportunities,
  };

  await cache.set(auditKey(audit.id), audit);
  await cache.set(urlKey(normalized), audit.id);

  return audit;
}

/** Fetch a previously-run audit by id. */
export async function getAudit(id: string): Promise<Audit | null> {
  return getCache().get<Audit>(auditKey(id));
}

/** We can produce a meaningful audit if we read the catalog or a real homepage. */
function isUsableEvidence(ev: StoreEvidence): boolean {
  return (
    ev.sourceFlags.productsJson ||
    ev.sourceFlags.collectionsJson ||
    (ev.sourceFlags.homepageHtml && ev.products.length > 0)
  );
}
