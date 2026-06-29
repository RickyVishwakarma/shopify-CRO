/**
 * URL validation + normalization + SSRF guard.
 *
 * This is a security boundary: the URL comes from user input and we are about
 * to make server-side HTTP requests to it. An attacker could try to point us at
 * internal infrastructure (cloud metadata endpoints, localhost, private
 * ranges). We reject anything that isn't a public http(s) host *before* any
 * fetch happens.
 */

export class UrlValidationError extends Error {
  constructor(
    message: string,
    public code:
      | "empty"
      | "malformed"
      | "bad_protocol"
      | "private_host"
      | "bad_host",
  ) {
    super(message);
    this.name = "UrlValidationError";
  }
}

/** Hostnames that must never be fetched server-side. */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
]);

/**
 * Returns true if a hostname is an IP literal in a private / reserved range, or
 * otherwise must not be reached from the server. Covers IPv4 private ranges,
 * loopback, link-local (incl. the cloud metadata address 169.254.169.254),
 * and common IPv6 reserved forms.
 */
export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, ""); // strip IPv6 brackets

  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host.endsWith(".localhost") || host.endsWith(".internal")) return true;

  // IPv6 loopback / unspecified / unique-local / link-local
  if (host === "::1" || host === "::") return true;
  if (host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) {
    return true;
  }

  // IPv4 literal?
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const octets = ipv4.slice(1, 5).map(Number);
    if (octets.some((o) => o > 255)) return true; // malformed → reject
    const [a, b] = octets;
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // loopback
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 169 && b === 254) return true; // link-local incl. metadata
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  }

  return false;
}

export interface ValidatedUrl {
  /** The full, cleaned URL we will fetch. */
  href: string;
  /** Lowercased hostname. */
  hostname: string;
  /** A stable cache key: protocol + host, no path/query/trailing slash. */
  normalized: string;
}

/**
 * Validate and normalize a user-supplied store URL.
 * Throws `UrlValidationError` with a typed `code` on any rejection.
 */
export function validateStoreUrl(input: string): ValidatedUrl {
  const trimmed = input?.trim();
  if (!trimmed) {
    throw new UrlValidationError("URL is required.", "empty");
  }

  // Allow users to omit the protocol ("gymshark.com"), but if they DID supply a
  // scheme, keep it so a non-http scheme (ftp://, file://) is caught below as
  // bad_protocol rather than being silently rewritten to https.
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
  const withProtocol = hasScheme ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new UrlValidationError("That doesn't look like a valid URL.", "malformed");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UrlValidationError("Only http and https URLs are supported.", "bad_protocol");
  }

  const hostname = parsed.hostname.toLowerCase();

  // Security first: reject SSRF targets (localhost, private ranges, IPv6
  // loopback) BEFORE any other shape check, so a dotless internal host like
  // "localhost" or "[::1]" is caught as private_host rather than bad_host.
  if (isPrivateHost(hostname)) {
    throw new UrlValidationError("That host is not allowed.", "private_host");
  }

  // Must have a dot and a TLD-like suffix (rejects bare words, partial hosts).
  if (!hostname.includes(".") || hostname.endsWith(".")) {
    throw new UrlValidationError("Enter a full domain, e.g. example.com.", "bad_host");
  }

  const normalized = `${parsed.protocol}//${hostname}`;

  return { href: parsed.href, hostname, normalized };
}
