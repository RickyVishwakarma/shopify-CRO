import type { CacheStore } from "./store";

interface Entry<T> {
  value: T;
  /** Epoch ms when this entry expires; Infinity for no expiry. */
  expires: number;
}

/**
 * In-memory cache with per-entry TTL and lazy expiry.
 *
 * Suitable for a single-instance deployment and local development. Entries are
 * evicted on read once expired; a small periodic sweep keeps memory bounded
 * under churn. For multi-instance/serverless persistence this would be swapped
 * for a shared store — but the interface stays the same.
 */
export class MemoryCacheStore implements CacheStore {
  private map = new Map<string, Entry<unknown>>();
  private readonly defaultTtlMs: number;

  constructor(defaultTtlMs = 60 * 60 * 1000 /* 1h */) {
    this.defaultTtlMs = defaultTtlMs;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (entry.expires <= Date.now()) {
      this.map.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    const ttl = ttlMs ?? this.defaultTtlMs;
    const expires = ttl === Infinity ? Infinity : Date.now() + ttl;
    this.map.set(key, { value, expires });
    this.sweepIfNeeded();
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }

  /** Occasionally drop expired entries so the map can't grow unbounded. */
  private sweepIfNeeded() {
    if (this.map.size % 50 !== 0) return;
    const now = Date.now();
    for (const [k, e] of this.map) {
      if (e.expires <= now) this.map.delete(k);
    }
  }
}
