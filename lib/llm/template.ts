import type {
  LlmAudit,
  LlmOpportunity,
  StoreEvidence,
  Evidence,
} from "@/types/audit";
import type { LLMProvider } from "./provider";

/**
 * Deterministic, rule-based fallback.
 *
 * This is NOT trying to be as good as the model — it's a safety net so the app
 * runs and demos with no API key, and a fixture-free test seam. It inspects the
 * same StoreEvidence and emits grounded opportunities from a handful of well-
 * established CRO heuristics. Every opportunity it produces cites real scraped
 * data (or a genuine "missing" signal), so it passes the same grounding and
 * schema checks the model's output does.
 */
export class TemplateProvider implements LLMProvider {
  readonly model = "template-fallback";

  // eslint-disable-next-line @typescript-eslint/require-await
  async analyze(evidence: StoreEvidence): Promise<LlmAudit> {
    return buildTemplateAudit(evidence);
  }
}

function missing(location: string, field: string, sourceUrl: string): Evidence {
  return { type: "missing", location, selectorOrField: field, excerpt: "", sourceUrl };
}

function found(
  location: string,
  field: string,
  excerpt: string,
  sourceUrl: string,
): Evidence {
  return { type: "element", location, selectorOrField: field, excerpt, sourceUrl };
}

export function buildTemplateAudit(ev: StoreEvidence): LlmAudit {
  const opps: LlmOpportunity[] = [];
  const sp = ev.productPageSignals;
  const pdpUrl = sp.sampledProductUrl ?? ev.url;

  // 1. No reviews on the product page.
  if (ev.sourceFlags.productPageHtml && sp.hasReviews === false) {
    opps.push({
      title: "Add social proof to product pages",
      problem:
        "The sampled product page has no detectable reviews or ratings, removing a key trust signal at the point of purchase.",
      evidence: [missing(`PDP: ${ev.storeName}`, "product.reviews", pdpUrl)],
      businessImpact: "Reviews near the buy box typically lift add-to-cart and conversion.",
      impact: 4,
      confidence: 0.7,
      effort: 2,
      reasoning:
        "Shoppers rely on peer validation before purchase; its absence increases hesitation, especially for first-time visitors.",
      experiment: {
        hypothesis: "Showing star ratings and review count near the Add-to-Cart button increases PDP→cart rate.",
        metric: "PDP → add-to-cart rate",
        expectedImpact: "+3-8%",
        effort: "Low — install a reviews app and place the widget above the fold.",
        implementation: "Add a reviews block (e.g. a reviews app) to the product template.",
      },
      successMetric: "PDP → add-to-cart conversion rate",
      category: "PDP",
    });
  }

  // 2. No shipping info on the product page.
  if (ev.sourceFlags.productPageHtml && sp.hasShippingInfo === false) {
    opps.push({
      title: "Surface shipping and delivery details on the product page",
      problem:
        "No shipping or delivery information was detected on the product page; unclear shipping is a leading cause of checkout abandonment.",
      evidence: [missing(`PDP: ${ev.storeName}`, "shipping copy", pdpUrl)],
      businessImpact: "Setting delivery expectations early reduces cart abandonment.",
      impact: 3,
      confidence: 0.65,
      effort: 2,
      reasoning:
        "Buyers want to know cost and timing before committing; surfacing it on the PDP removes a late-stage surprise.",
      experiment: {
        hypothesis: "Adding a shipping/delivery line near the price reduces checkout abandonment.",
        metric: "Cart → checkout completion rate",
        expectedImpact: "+2-5%",
        effort: "Low — add a static shipping note to the product template.",
        implementation: "Insert a delivery-estimate snippet beneath the price/CTA.",
      },
      successMetric: "Checkout completion rate",
      category: "PDP",
    });
  }

  // 3. No returns/refund info on the product page.
  if (ev.sourceFlags.productPageHtml && sp.hasReturnsInfo === false) {
    opps.push({
      title: "Make the returns policy visible on product pages",
      problem:
        "No returns or refund information was detected on the product page, leaving a perceived-risk gap before purchase.",
      evidence: [missing(`PDP: ${ev.storeName}`, "returns copy", pdpUrl)],
      businessImpact: "A clear, generous returns policy reduces purchase risk and lifts conversion.",
      impact: 3,
      confidence: 0.6,
      effort: 1,
      reasoning:
        "Risk reversal is one of the most reliable CRO levers; making it visible at decision time matters.",
      experiment: {
        hypothesis: "Showing a returns guarantee near the CTA increases conversion.",
        metric: "PDP → purchase rate",
        expectedImpact: "+1-4%",
        effort: "Trivial — add a returns badge to the product template.",
        implementation: "Add a short returns-policy line or icon under the buy button.",
      },
      successMetric: "PDP → purchase conversion rate",
      category: "Trust",
    });
  }

  // 4. No trust badges on the homepage.
  if (ev.sourceFlags.homepageHtml && ev.homepage.trustBadges.length === 0) {
    opps.push({
      title: "Add trust signals to the homepage",
      problem:
        "No trust signals (free shipping, guarantees, secure-checkout, social proof) were detected on the homepage.",
      evidence: [missing("Homepage", "trust badges", ev.url)],
      businessImpact: "First-time visitors decide quickly whether a store is credible.",
      impact: 3,
      confidence: 0.6,
      effort: 2,
      reasoning:
        "Trust cues reduce bounce for cold traffic; their absence above the fold costs early-funnel conversion.",
      experiment: {
        hypothesis: "A trust bar (shipping, guarantee, secure checkout) on the homepage reduces bounce.",
        metric: "Homepage bounce rate / engaged sessions",
        expectedImpact: "+1-3% engaged sessions",
        effort: "Low — add a trust-bar section to the theme.",
        implementation: "Add an icon row of trust statements below the hero.",
      },
      successMetric: "Engaged-session rate from homepage",
      category: "Trust",
    });
  }

  // 5. Weak/absent hero value proposition.
  if (ev.sourceFlags.homepageHtml && !ev.homepage.heroHeadline) {
    opps.push({
      title: "Add a clear value proposition above the fold",
      problem:
        "No prominent hero headline was detected, so visitors may not immediately understand what the store sells or why to buy.",
      evidence: [missing("Homepage hero", "h1 / hero headline", ev.url)],
      businessImpact: "A sharp above-the-fold value prop improves first-impression conversion.",
      impact: 4,
      confidence: 0.5,
      effort: 2,
      reasoning:
        "The first few seconds determine whether a visitor stays; an unclear hero leaks traffic.",
      experiment: {
        hypothesis: "A benefit-led hero headline increases click-through from the homepage to a collection or PDP.",
        metric: "Homepage → collection/PDP CTR",
        expectedImpact: "+2-6%",
        effort: "Low — copy + hero section edit.",
        implementation: "Write a benefit-driven H1 and supporting subhead in the hero.",
      },
      successMetric: "Homepage click-through rate",
      category: "Homepage",
    });
  }

  // 6. Products with thin imagery.
  const thin = ev.products.filter((p) => p.imagesCount <= 1);
  if (thin.length > 0) {
    const sample = thin.slice(0, 3);
    opps.push({
      title: "Strengthen product imagery on thin listings",
      problem: `${thin.length} sampled product(s) have one image or none, limiting buyer confidence.`,
      evidence: sample.map((p) =>
        found(`Product: ${p.title}`, "product.images", p.title, p.url),
      ),
      businessImpact: "Richer imagery (multiple angles, in-use shots) lifts product-page conversion.",
      impact: 3,
      confidence: 0.55,
      effort: 3,
      reasoning:
        "Imagery substitutes for the in-store handling experience; sparse galleries depress conversion.",
      experiment: {
        hypothesis: "Adding multiple images (angles + lifestyle) to thin PDPs increases add-to-cart rate.",
        metric: "PDP → add-to-cart rate on affected products",
        expectedImpact: "+2-5%",
        effort: "Medium — sourcing/producing additional imagery.",
        implementation: "Add 3-5 images per product including a lifestyle shot.",
      },
      successMetric: "Add-to-cart rate on affected products",
      category: "Merchandising",
    });
  }

  // 7. Out-of-stock dead-ends.
  const oos = ev.products.filter((p) => p.available === false);
  if (oos.length > 0) {
    const sample = oos.slice(0, 3);
    opps.push({
      title: "Reduce dead-ends from out-of-stock products",
      problem: `${oos.length} sampled product(s) are out of stock; without back-in-stock capture these are lost-intent dead-ends.`,
      evidence: sample.map((p) =>
        found(`Product: ${p.title}`, "variant.available=false", p.title, p.url),
      ),
      businessImpact: "Back-in-stock signups recover demand and build an email list.",
      impact: 2,
      confidence: 0.6,
      effort: 2,
      reasoning:
        "Out-of-stock pages still receive traffic; capturing intent converts a dead-end into future revenue.",
      experiment: {
        hypothesis: "Adding a back-in-stock email capture to OOS PDPs recovers a share of lost demand.",
        metric: "Back-in-stock signups → recovered orders",
        expectedImpact: "Recover 1-3% of OOS demand",
        effort: "Low — install a restock-alert app.",
        implementation: "Replace the disabled buy button with an email-capture form on OOS variants.",
      },
      successMetric: "Recovered orders from restock alerts",
      category: "Merchandising",
    });
  }

  // 8. Collection sprawl in navigation.
  if (ev.collections.length >= 25) {
    opps.push({
      title: "Tame collection sprawl to simplify navigation",
      problem: `The store exposes ${ev.collections.length}+ collections; too many shallow categories make products harder to find.`,
      evidence: [
        found(
          "Collections",
          "collections.count",
          ev.collections[0]?.title ?? "collections",
          ev.url,
        ),
      ],
      businessImpact: "Clearer navigation reduces friction and improves product discovery.",
      impact: 2,
      confidence: 0.5,
      effort: 3,
      reasoning:
        "Choice overload and redundant collections dilute the path to purchase; a curated hierarchy converts better.",
      experiment: {
        hypothesis: "Consolidating navigation into a few clear top-level categories increases product-page reach per session.",
        metric: "Products viewed per session / search usage",
        expectedImpact: "+1-4% PDP reach",
        effort: "Medium — IA and menu rework.",
        implementation: "Group collections under a small set of top-level menu items.",
      },
      successMetric: "Product pages reached per session",
      category: "Navigation",
    });
  }

  // Guarantee at least one grounded opportunity.
  if (opps.length === 0) {
    opps.push({
      title: "Establish a baseline conversion review",
      problem:
        "Automated heuristics found no obvious gaps in the available evidence; a manual CRO review is recommended to go deeper.",
      evidence: [
        found(
          "Store",
          "catalog",
          ev.products[0]?.title ?? ev.storeName,
          ev.products[0]?.url ?? ev.url,
        ),
      ],
      businessImpact: "A structured manual review surfaces opportunities automation can't detect.",
      impact: 2,
      confidence: 0.4,
      effort: 3,
      reasoning: "The fallback heuristics are intentionally conservative; deeper analysis needs the full model.",
      experiment: {
        hypothesis: "A funnel analytics review reveals the highest-leverage drop-off point.",
        metric: "Funnel step conversion rates",
        expectedImpact: "Identify the top 1-2 leverage points",
        effort: "Medium — analytics setup and review.",
        implementation: "Instrument the funnel and review step-by-step drop-off.",
      },
      successMetric: "Identified primary funnel drop-off",
      category: "PDP",
    });
  }

  // Strengths (grounded positives).
  const strengths: string[] = [];
  if (ev.products.length > 0)
    strengths.push(`Catalog of ${ev.products.length}+ products across ${ev.collections.length} collections.`);
  if (ev.homepage.trustBadges.length > 0)
    strengths.push(`Homepage shows trust signals: ${ev.homepage.trustBadges.join(", ")}.`);
  if (sp.hasReviews) strengths.push("Product pages include reviews/ratings.");
  if (ev.homepage.heroHeadline)
    strengths.push(`Clear hero message: "${ev.homepage.heroHeadline}".`);
  if (strengths.length === 0) strengths.push("Store catalog is publicly accessible and well-structured.");

  const issues = opps.slice(0, 5).map((o) => o.title);

  const notFetched = !ev.sourceFlags.homepageHtml || !ev.sourceFlags.productPageHtml;
  const summary = `Heuristic audit of ${ev.storeName}: ${opps.length} opportunities identified${
    notFetched
      ? ", though some page content could not be fetched (likely a JS-rendered storefront) and was not assessed"
      : ""
  }. This is a fallback analysis generated without the language model.`;

  const executiveSummary = `${ev.storeName} has ${opps.length} conversion opportunities worth reviewing. The highest-leverage items center on ${
    issues.slice(0, 2).join(" and ") || "core product-page trust signals"
  }. These are quick-to-medium effort changes that reduce buyer hesitation at the point of decision. (Generated by the deterministic fallback — connect an API key for a deeper, model-driven audit.)`;

  return { executiveSummary, summary, strengths, issues, opportunities: opps };
}
