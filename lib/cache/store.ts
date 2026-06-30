/**
 * Cache abstraction.
 *
 * The audit pipeline is expensive (scrape + LLM), so identical requests should
 * be served from cache. We keep the interface tiny and storage-agnostic: the
 * default is an in-memory store (zero-config, perfect for this scope), but the
 * same interface could be backed by Redis/Supabase later without touching the
 * orchestrator — which is why the orchestrator depends on this interface, not a
 * concrete store.
 */
export interface CacheStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlMs?: number): Promise<void>;
  delete(key: string): Promise<void>;
}
