import { fetchUrl } from "./fetcher";
import { fetchProducts, fetchCollections } from "./shopify";
import { parseHomepage, parseProductPage } from "./parseHtml";
import type { StoreEvidence } from "@/types/audit";

/**
 * Scrape orchestrator: runs the homepage fetch, the Shopify catalog JSON
 * fetches, and (once we know a product handle) a sampled product-page fetch —
 * concurrently where possible — and assembles a single normalized, token-
 * bounded StoreEvidence object.
 *
 * Every step is independently fault-tolerant: a failed product-page fetch still
 * yields an audit from the homepage + catalog. `sourceFlags` records exactly
 * what succeeded so the LLM and UI can distinguish "missing from the store"
 * from "we couldn't fetch it."
 */

/** Caps that keep the LLM payload bounded (cost + latency predictable). */
const MAX_PRODUCTS = Number(process.env.MAX_PRODUCTS) || 30;
const MAX_COLLECTIONS = 30;

function deriveStoreName(homepageTitle: string, hostname: string): string {
  // Homepage <title> is usually "Brand – tagline" or "Brand | tagline".
  const first = homepageTitle.split(/[|–—\-:]/)[0]?.trim();
  if (first && first.length >= 2 && first.length <= 60) return first;
  // Fall back to the domain's second-level label.
  const label = hostname.replace(/^www\./, "").split(".")[0];
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : hostname;
}

export interface ScrapeOptions {
  maxProducts?: number;
}

/**
 * @param baseUrl normalized origin (protocol + host), e.g. https://gymshark.com
 * @param hostname lowercased hostname, used for the store-name fallback
 */
export async function scrapeStore(
  baseUrl: string,
  hostname: string,
  opts: ScrapeOptions = {},
): Promise<StoreEvidence> {
  const maxProducts = opts.maxProducts ?? MAX_PRODUCTS;

  // Phase 1: fetch homepage + catalog concurrently.
  const [homepageRes, productsRes, collectionsRes] = await Promise.all([
    fetchUrl(baseUrl),
    fetchProducts(baseUrl, maxProducts),
    fetchCollections(baseUrl, MAX_COLLECTIONS),
  ]);

  const homepage = homepageRes.ok
    ? parseHomepage(homepageRes.body)
    : {
        title: "",
        heroHeadline: null,
        heroSubtitle: null,
        primaryCtas: [],
        trustBadges: [],
        navItems: [],
        announcement: null,
      };

  const products = productsRes.products.slice(0, maxProducts);
  const collections = collectionsRes.collections.slice(0, MAX_COLLECTIONS);

  // Phase 2: sample a product page (best source of conversion signals).
  let productPageSignals: StoreEvidence["productPageSignals"] = {
    hasReviews: null,
    hasShippingInfo: null,
    hasReturnsInfo: null,
    hasFaq: null,
    ctaText: null,
    sampledProductUrl: null,
  };
  let productPageOk = false;

  const sampleUrl = products[0]?.url ?? null;
  if (sampleUrl) {
    const pdpRes = await fetchUrl(sampleUrl);
    if (pdpRes.ok) {
      const parsed = parseProductPage(pdpRes.body);
      productPageSignals = { ...parsed, sampledProductUrl: sampleUrl };
      productPageOk = true;
    } else {
      productPageSignals.sampledProductUrl = sampleUrl;
    }
  }

  const storeName = deriveStoreName(homepage.title, hostname);

  return {
    url: baseUrl,
    storeName,
    homepage,
    products,
    collections,
    productPageSignals,
    sourceFlags: {
      productsJson: productsRes.ok,
      collectionsJson: collectionsRes.ok,
      homepageHtml: homepageRes.ok,
      productPageHtml: productPageOk,
    },
  };
}
