import type { CacheStore } from "./store";
import { MemoryCacheStore } from "./memory";

export type { CacheStore } from "./store";
export { MemoryCacheStore } from "./memory";

/**
 * Process-wide cache singleton.
 *
 * Stashed on globalThis so it survives Next.js hot-reloads in development (each
 * HMR cycle re-evaluates modules and would otherwise create a fresh, empty
 * cache). In production this is one instance per warm server process.
 */
const globalForCache = globalThis as unknown as { __croCache?: CacheStore };

export function getCache(): CacheStore {
  if (!globalForCache.__croCache) {
    globalForCache.__croCache = new MemoryCacheStore();
  }
  return globalForCache.__croCache;
}
