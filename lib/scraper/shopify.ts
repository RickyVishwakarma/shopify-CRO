import { fetchUrl } from "./fetcher";
import type { ScrapedProduct, ScrapedCollection } from "@/types/audit";

/**
 * Shopify exposes the catalog as public JSON at /products.json and
 * /collections.json. We read those directly instead of driving a headless
 * browser — it's faster, cleaner, and far more robust. This module turns that
 * raw JSON into the trimmed shapes the rest of the app uses.
 */

/* Minimal shapes for the bits of Shopify's JSON we actually consume. */
interface RawVariant {
  price?: string;
  available?: boolean;
}
interface RawProduct {
  title?: string;
  handle?: string;
  body_html?: string;
  variants?: RawVariant[];
  images?: unknown[];
}
interface RawCollection {
  title?: string;
  handle?: string;
  products_count?: number;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface ProductsResult {
  ok: boolean;
  products: ScrapedProduct[];
}

/**
 * Fetch up to `limit` products. Returns `ok: false` (with an empty list) if the
 * endpoint is missing or the store isn't a Shopify store — the caller treats
 * that as a partial failure, not a fatal one.
 */
export async function fetchProducts(
  baseUrl: string,
  limit = 50,
): Promise<ProductsResult> {
  const url = `${baseUrl}/products.json?limit=${Math.min(limit, 250)}`;
  const res = await fetchUrl(url, { accept: "application/json" });
  if (!res.ok) return { ok: false, products: [] };

  let parsed: { products?: RawProduct[] };
  try {
    parsed = JSON.parse(res.body);
  } catch {
    return { ok: false, products: [] };
  }
  if (!Array.isArray(parsed.products)) return { ok: false, products: [] };

  const products: ScrapedProduct[] = parsed.products.map((p) => {
    const firstVariant = p.variants?.[0];
    return {
      title: p.title ?? "",
      handle: p.handle ?? "",
      price: firstVariant?.price ?? null,
      available: firstVariant?.available ?? null,
      imagesCount: Array.isArray(p.images) ? p.images.length : 0,
      descriptionExcerpt: stripHtml(p.body_html ?? "").slice(0, 240),
      url: p.handle ? `${baseUrl}/products/${p.handle}` : baseUrl,
    };
  });

  return { ok: true, products };
}

export interface CollectionsResult {
  ok: boolean;
  collections: ScrapedCollection[];
}

export async function fetchCollections(
  baseUrl: string,
  limit = 50,
): Promise<CollectionsResult> {
  const url = `${baseUrl}/collections.json?limit=${Math.min(limit, 250)}`;
  const res = await fetchUrl(url, { accept: "application/json" });
  if (!res.ok) return { ok: false, collections: [] };

  let parsed: { collections?: RawCollection[] };
  try {
    parsed = JSON.parse(res.body);
  } catch {
    return { ok: false, collections: [] };
  }
  if (!Array.isArray(parsed.collections)) return { ok: false, collections: [] };

  const collections: ScrapedCollection[] = parsed.collections.map((c) => ({
    title: c.title ?? "",
    handle: c.handle ?? "",
    productsCount: typeof c.products_count === "number" ? c.products_count : null,
  }));

  return { ok: true, collections };
}
