/**
 * Resilient HTTP fetch used by every scrape step.
 *
 * One place to enforce: a real User-Agent, a hard timeout (so a slow store
 * can't hang the whole audit), a small bounded retry on transient failures,
 * and a response-size cap (so a giant page can't blow up memory). Every caller
 * gets a typed result instead of a thrown exception, which keeps the scraper's
 * partial-failure handling simple.
 */

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 2;
const MAX_BYTES = 4_000_000; // ~4 MB; plenty for HTML/JSON, guards against abuse
const USER_AGENT =
  "CRO-Opportunity-Engine/1.0 (+audit bot; respects robots; contact via site owner)";

export interface FetchResult {
  ok: boolean;
  status: number;
  /** Response body as text, or "" on failure. */
  body: string;
  /** Populated when ok is false. */
  error?: string;
}

interface FetchOptions {
  timeoutMs?: number;
  retries?: number;
  accept?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fetch a URL with timeout + retry. Never throws — failures come back as
 * `{ ok: false, error }`. 4xx responses are returned as-is (not retried);
 * timeouts and 5xx/network errors are retried with a short backoff.
 */
export async function fetchUrl(
  url: string,
  opts: FetchOptions = {},
): Promise<FetchResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = opts.retries ?? DEFAULT_RETRIES;

  let lastError = "unknown error";

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent": USER_AGENT,
          Accept: opts.accept ?? "text/html,application/json,*/*",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      // Client errors are deterministic — don't waste retries on them.
      if (res.status >= 400 && res.status < 500) {
        clearTimeout(timer);
        return { ok: false, status: res.status, body: "", error: `HTTP ${res.status}` };
      }

      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        clearTimeout(timer);
        if (attempt < retries) await sleep(250 * (attempt + 1));
        continue;
      }

      const body = await readCapped(res);
      clearTimeout(timer);
      return { ok: true, status: res.status, body };
    } catch (err) {
      clearTimeout(timer);
      lastError =
        err instanceof Error
          ? err.name === "AbortError"
            ? `timeout after ${timeoutMs}ms`
            : err.message
          : "fetch failed";
      if (attempt < retries) await sleep(250 * (attempt + 1));
    }
  }

  return { ok: false, status: 0, body: "", error: lastError };
}

/** Read a response body but stop once we exceed MAX_BYTES. */
async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return res.text();

  const decoder = new TextDecoder();
  let out = "";
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    out += decoder.decode(value, { stream: true });
    if (total >= MAX_BYTES) {
      await reader.cancel();
      break;
    }
  }
  out += decoder.decode();
  return out;
}
