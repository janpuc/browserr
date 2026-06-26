import "server-only";
import { LRUCache } from "lru-cache";

/**
 * In-memory cache for TMDB/Seerr responses and computed rails.
 *
 * - `cached()` dedupes concurrent misses (no thundering herd) and can serve a
 *   stale value when the refresh throws (graceful degradation per §12).
 * - A `REDIS_URL` can be layered in later behind this same interface; the LRU
 *   is the dependency-light default.
 */
// LRUCache requires a non-nullable value type; we only ever store objects
// (TMDB/Seerr JSON, Sets, vectors) so `object` is accurate.
const fresh = new LRUCache<string, object>({ max: 5000, ttl: 1000 * 60 * 60 });
// Longer-lived copy used only to answer when a refresh fails.
const stale = new LRUCache<string, object>({ max: 5000, ttl: 1000 * 60 * 60 * 24 });
const inflight = new Map<string, Promise<unknown>>();

export interface CacheOpts {
  /** Time the value is considered fresh. */
  ttlMs: number;
  /** If set, keep a stale copy this long to serve on refresh failure. */
  staleMs?: number;
}

export function cacheGet<T>(key: string): T | undefined {
  return fresh.get(key) as T | undefined;
}

export function cacheSet<T>(key: string, value: T, opts: CacheOpts): void {
  if (value === undefined) return;
  fresh.set(key, value as object, { ttl: opts.ttlMs });
  if (opts.staleMs) stale.set(key, value as object, { ttl: opts.staleMs });
}

export async function cached<T>(
  key: string,
  opts: CacheOpts,
  fn: () => Promise<T>,
): Promise<T> {
  const hit = fresh.get(key);
  if (hit !== undefined) return hit as T;

  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const p = (async () => {
    try {
      const value = await fn();
      cacheSet(key, value, opts);
      return value;
    } catch (err) {
      const last = stale.get(key);
      if (last !== undefined) return last as T;
      throw err;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  return p;
}

/** Invalidate everything whose key starts with `prefix` (e.g. on region change). */
export function cacheClearPrefix(prefix: string): number {
  let n = 0;
  for (const key of fresh.keys()) {
    if (key.startsWith(prefix)) {
      fresh.delete(key);
      n++;
    }
  }
  return n;
}

export function cacheClearAll(): void {
  fresh.clear();
  stale.clear();
}
