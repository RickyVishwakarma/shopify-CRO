import type { NextRequest } from "next/server";
import { runAudit, NotShopifyError } from "@/lib/orchestrator";
import { UrlValidationError } from "@/lib/validation/url";

/**
 * POST /api/audits  { url: string, fresh?: boolean }
 * Runs (or returns a cached) CRO audit for a Shopify store URL.
 *
 * Errors are returned as typed `{ error: { code, message } }` payloads with the
 * right HTTP status so the client can react precisely (bad URL vs. not-Shopify
 * vs. server error).
 */

// Scrape + LLM can take a little while; needs the Node runtime (cheerio, crypto).
export const runtime = "nodejs";
export const maxDuration = 60;

function fail(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "bad_request", "Request body must be valid JSON.");
  }

  const url = (body as { url?: unknown })?.url;
  if (typeof url !== "string" || url.trim() === "") {
    return fail(400, "bad_request", "A 'url' string is required.");
  }
  const fresh = (body as { fresh?: unknown })?.fresh === true;

  try {
    const audit = await runAudit(url, { fresh });
    return Response.json(audit);
  } catch (err) {
    if (err instanceof UrlValidationError) {
      return fail(400, err.code, err.message);
    }
    if (err instanceof NotShopifyError) {
      return fail(422, "not_shopify", err.message);
    }
    console.error("[api/audits] unexpected failure:", err);
    return fail(500, "internal_error", "Something went wrong generating the audit.");
  }
}
