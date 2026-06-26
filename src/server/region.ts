import "server-only";
import { eq } from "drizzle-orm";
import type { RegionOption, RegionProvider } from "@/lib/types";
import { cached } from "./cache";
import { getConfig } from "./config";
import { getDb } from "./db";
import { servicesCache } from "./db/schema";
import { log } from "./log";
import { getTmdb } from "./tmdb/client";

export async function listRegions(): Promise<RegionOption[]> {
  const tmdb = await getTmdb();
  return tmdb.getRegions();
}

/**
 * The set of services that actually exist in a region — the union of movie and
 * TV watch providers, deduped by provider_id and ordered by display_priority.
 *
 * This is the ONLY set Browserr will ever show for the region (acceptance
 * criterion: never surface a service TMDB doesn't list for the region). Changing
 * region re-derives this list.
 */
export async function listRegionServices(region: string): Promise<RegionProvider[]> {
  return cached<RegionProvider[]>(
    `region:services:${region}`,
    { ttlMs: 1000 * 60 * 60 * 12, staleMs: 1000 * 60 * 60 * 24 * 3 },
    async () => {
      const tmdb = await getTmdb();
      const [movie, tv] = await Promise.all([
        tmdb.getWatchProviders("movie", region),
        tmdb.getWatchProviders("tv", region),
      ]);
      const map = new Map<number, RegionProvider>();
      for (const p of [...movie, ...tv]) {
        const existing = map.get(p.providerId);
        // Keep the lower (better) display priority when a provider appears in both.
        if (!existing || p.priority < existing.priority) map.set(p.providerId, p);
      }
      const union = [...map.values()].sort((a, b) => a.priority - b.priority);
      void persistServices(region, union);
      return union;
    },
  );
}

async function persistServices(region: string, providers: RegionProvider[]): Promise<void> {
  try {
    const db = await getDb();
    const now = Date.now();
    await db.delete(servicesCache).where(eq(servicesCache.region, region));
    if (providers.length) {
      await db.insert(servicesCache).values(
        providers.map((p) => ({
          region,
          providerId: p.providerId,
          name: p.name,
          logoPath: p.logoPath,
          priority: p.priority,
          fetchedAt: now,
        })),
      );
    }
  } catch (err) {
    log.warn("failed to persist services cache", { region, err: String(err) });
  }
}

export interface ActiveServices {
  /** All providers available in the active region. */
  available: RegionProvider[];
  /**
   * The provider IDs to filter discover queries by. Empty means "all in region"
   * (no provider filter). Configured IDs are intersected with what's actually
   * available so a stale ID from another region can never leak into queries.
   */
  selectedIds: number[];
  /** The selected providers as full objects (for per-service rails). */
  selected: RegionProvider[];
}

export async function resolveActiveServices(): Promise<ActiveServices> {
  const cfg = await getConfig();
  const available = await listRegionServices(cfg.region.region);
  const availableIds = new Set(available.map((p) => p.providerId));
  const configured = cfg.region.services.filter((id) => availableIds.has(id));
  const selected = available.filter((p) => configured.includes(p.providerId));
  return { available, selectedIds: configured, selected };
}
