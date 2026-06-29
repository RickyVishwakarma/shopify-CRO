import type { StoreEvidence } from "@/types/audit";

/**
 * Builds the user message: the scraped evidence as compact JSON plus a short
 * instruction. We hand the model exactly what was scraped (and a human-readable
 * note about what couldn't be fetched) so it can only reason from real data.
 */
export function buildUserPrompt(evidence: StoreEvidence): string {
  const couldNotFetch: string[] = [];
  if (!evidence.sourceFlags.homepageHtml) couldNotFetch.push("homepage HTML");
  if (!evidence.sourceFlags.productPageHtml) couldNotFetch.push("product page HTML");
  if (!evidence.sourceFlags.productsJson) couldNotFetch.push("product catalog");
  if (!evidence.sourceFlags.collectionsJson) couldNotFetch.push("collections");

  const caveat =
    couldNotFetch.length > 0
      ? `\n\nNote: the following could not be fetched and must NOT be treated as store problems — only as not assessed: ${couldNotFetch.join(", ")}. This often means a fully JS-rendered storefront.`
      : "";

  return `Audit this Shopify store. Base every recommendation strictly on the evidence below.

STORE: ${evidence.storeName} (${evidence.url})

EVIDENCE (JSON):
${JSON.stringify(evidence, null, 2)}${caveat}

Produce the prioritized CRO audit now.`;
}
