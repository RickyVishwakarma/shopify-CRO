import { z } from "zod";

/**
 * The data contract for the whole app.
 *
 * Everything is defined as a zod schema first, and the TypeScript types are
 * *inferred* from those schemas. That means there is a single source of truth:
 * the same schema that types our code also validates the LLM's output at
 * runtime. If the model returns something off-shape, validation fails loudly
 * instead of corrupting the UI.
 */

/* ------------------------------------------------------------------ */
/* Evidence — the differentiator                                       */
/* ------------------------------------------------------------------ */

/**
 * A pointer back to the exact thing in the scraped store that triggered a
 * recommendation. `missing` is a first-class type: "this store has no reviews
 * widget" is itself evidence, and saying so is better than silently inventing
 * data.
 */
export const EvidenceSchema = z.object({
  type: z.enum(["element", "text", "missing"]),
  /** Human-readable location, e.g. "PDP: Vital Seamless Leggings" or "Homepage hero". */
  location: z.string().min(1),
  /** The field or selector this came from, e.g. "product.reviews" or ".hero__cta". */
  selectorOrField: z.string().min(1),
  /** The actual scraped value/text. Empty string is allowed for `missing`. */
  excerpt: z.string(),
  /** The page the evidence was found on. */
  sourceUrl: z.string().url().or(z.literal("")),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

/* ------------------------------------------------------------------ */
/* Experiment brief — one-click A/B test                               */
/* ------------------------------------------------------------------ */

export const ExperimentSchema = z.object({
  hypothesis: z.string().min(1),
  metric: z.string().min(1),
  expectedImpact: z.string().min(1),
  effort: z.string().min(1),
  implementation: z.string().min(1),
});
export type Experiment = z.infer<typeof ExperimentSchema>;

/* ------------------------------------------------------------------ */
/* Opportunity                                                         */
/* ------------------------------------------------------------------ */

export const OpportunityCategory = z.enum([
  "PDP",
  "Cart",
  "Navigation",
  "Trust",
  "Merchandising",
  "Homepage",
  "Checkout",
  "Mobile",
]);
export type OpportunityCategory = z.infer<typeof OpportunityCategory>;

/**
 * What the LLM is asked to produce per opportunity. Note `priorityScore` is
 * intentionally *absent* here — the model proposes impact/confidence/effort,
 * and we compute the score ourselves in `lib/analysis/scoring.ts`. The model
 * never gets to fudge the ranking.
 */
export const LlmOpportunitySchema = z.object({
  title: z.string().min(1),
  problem: z.string().min(1),
  evidence: z.array(EvidenceSchema).min(1),
  businessImpact: z.string().min(1),
  impact: z.number().min(1).max(5),
  confidence: z.number().min(0).max(1),
  effort: z.number().min(1).max(5),
  reasoning: z.string().min(1),
  experiment: ExperimentSchema,
  successMetric: z.string().min(1),
  category: OpportunityCategory,
});
export type LlmOpportunity = z.infer<typeof LlmOpportunitySchema>;

/** An opportunity after our pipeline has added an id, score, and grounding flag. */
export const OpportunitySchema = LlmOpportunitySchema.extend({
  id: z.string(),
  priorityScore: z.number(),
  /** False when at least one piece of cited evidence couldn't be matched to the scrape. */
  grounded: z.boolean(),
});
export type Opportunity = z.infer<typeof OpportunitySchema>;

/* ------------------------------------------------------------------ */
/* Audit                                                               */
/* ------------------------------------------------------------------ */

/** The shape the LLM returns (no server-computed fields yet). */
export const LlmAuditSchema = z.object({
  executiveSummary: z.string().min(1),
  summary: z.string().min(1),
  strengths: z.array(z.string()),
  issues: z.array(z.string()),
  opportunities: z.array(LlmOpportunitySchema),
});
export type LlmAudit = z.infer<typeof LlmAuditSchema>;

/** The finished audit returned by the API and rendered by the UI. */
export const AuditSchema = z.object({
  id: z.string(),
  url: z.string(),
  storeName: z.string(),
  scrapedAt: z.string(),
  model: z.string(),
  /** True when produced by the deterministic fallback rather than the LLM. */
  fallback: z.boolean(),
  executiveSummary: z.string(),
  summary: z.string(),
  strengths: z.array(z.string()),
  issues: z.array(z.string()),
  opportunities: z.array(OpportunitySchema),
});
export type Audit = z.infer<typeof AuditSchema>;

/* ------------------------------------------------------------------ */
/* StoreEvidence — the scraper's normalized output (LLM input)         */
/* ------------------------------------------------------------------ */

export const ScrapedProductSchema = z.object({
  title: z.string(),
  handle: z.string(),
  price: z.string().nullable(),
  available: z.boolean().nullable(),
  imagesCount: z.number(),
  descriptionExcerpt: z.string(),
  url: z.string(),
});
export type ScrapedProduct = z.infer<typeof ScrapedProductSchema>;

export const ScrapedCollectionSchema = z.object({
  title: z.string(),
  handle: z.string(),
  productsCount: z.number().nullable(),
});
export type ScrapedCollection = z.infer<typeof ScrapedCollectionSchema>;

/**
 * The normalized, token-bounded view of a store that gets sent to the LLM.
 * `sourceFlags` records which scrape steps succeeded so the model (and the UI)
 * know what's missing versus genuinely absent.
 */
export const StoreEvidenceSchema = z.object({
  url: z.string(),
  storeName: z.string(),
  homepage: z.object({
    title: z.string(),
    heroHeadline: z.string().nullable(),
    heroSubtitle: z.string().nullable(),
    primaryCtas: z.array(z.string()),
    trustBadges: z.array(z.string()),
    navItems: z.array(z.string()),
    announcement: z.string().nullable(),
  }),
  products: z.array(ScrapedProductSchema),
  collections: z.array(ScrapedCollectionSchema),
  productPageSignals: z.object({
    hasReviews: z.boolean().nullable(),
    hasShippingInfo: z.boolean().nullable(),
    hasReturnsInfo: z.boolean().nullable(),
    hasFaq: z.boolean().nullable(),
    ctaText: z.string().nullable(),
    sampledProductUrl: z.string().nullable(),
  }),
  sourceFlags: z.object({
    productsJson: z.boolean(),
    collectionsJson: z.boolean(),
    homepageHtml: z.boolean(),
    productPageHtml: z.boolean(),
  }),
});
export type StoreEvidence = z.infer<typeof StoreEvidenceSchema>;
