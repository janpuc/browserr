import "server-only";
import { desc, eq } from "drizzle-orm";
import type { MediaType } from "@/lib/types";
import { cached } from "../cache";
import { getDb } from "../db";
import { signals as signalsTable, tasteProfiles } from "../db/schema";
import { log } from "../log";
import { getTmdb } from "../tmdb/client";
import { addScaled, featuresFromDetail, type Vector } from "./features";

const HALF_LIFE_DAYS = 45;
const MAX_SIGNALS = 600;

export interface TasteProfile {
  vector: Vector;
  stats: Record<string, number>;
}

export async function loadProfile(userId: string): Promise<TasteProfile> {
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(tasteProfiles)
      .where(eq(tasteProfiles.userId, userId))
      .limit(1);
    const row = rows[0];
    return { vector: row?.vector ?? {}, stats: row?.stats ?? {} };
  } catch (err) {
    log.warn("loadProfile failed", { userId, err: String(err) });
    return { vector: {}, stats: {} };
  }
}

export async function saveProfile(userId: string, profile: TasteProfile): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  await db
    .insert(tasteProfiles)
    .values({ userId, vector: profile.vector, stats: profile.stats, updatedAt: now })
    .onConflictDoUpdate({
      target: tasteProfiles.userId,
      set: { vector: profile.vector, stats: profile.stats, updatedAt: now },
    });
}

/**
 * Feature vector for a title. Pulls the (cached) TMDB detail so keywords/people
 * enrich the vector. Memoized via the shared cache to avoid repeat fetches.
 */
export async function titleFeatures(tmdbId: number, mediaType: MediaType): Promise<Vector> {
  return cached<Vector>(
    `feat:${mediaType}:${tmdbId}`,
    { ttlMs: 1000 * 60 * 60 * 24, staleMs: 1000 * 60 * 60 * 24 * 7 },
    async () => {
      const tmdb = await getTmdb();
      const detail = await tmdb.getDetail(mediaType, tmdbId);
      return featuresFromDetail(detail);
    },
  );
}

function decay(ageMs: number): number {
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

/**
 * Full recompute: weighted, time-decayed aggregate of signalled titles'
 * feature vectors (positives add, negatives subtract). Pre-warmed by the cron.
 */
export async function recomputeProfile(userId: string): Promise<TasteProfile> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(signalsTable)
    .where(eq(signalsTable.userId, userId))
    .orderBy(desc(signalsTable.ts))
    .limit(MAX_SIGNALS);

  const now = Date.now();
  const featureCache = new Map<string, Vector>();
  const vector: Vector = {};
  let positives = 0;

  for (const s of rows) {
    const cacheKey = `${s.mediaType}:${s.tmdbId}`;
    let feats = featureCache.get(cacheKey);
    if (!feats) {
      try {
        feats = await titleFeatures(s.tmdbId, s.mediaType as MediaType);
      } catch {
        feats = {};
      }
      featureCache.set(cacheKey, feats);
    }
    const scale = s.weight * decay(now - s.ts);
    addScaled(vector, feats, scale);
    if (s.weight > 0) positives++;
  }

  const profile: TasteProfile = {
    vector,
    stats: { signals: rows.length, positives, updatedAt: now },
  };
  await saveProfile(userId, profile);
  log.info("profile recomputed", { userId, signals: rows.length, dims: Object.keys(vector).length });
  return profile;
}

/**
 * Cheap incremental update applied at signal-capture time so recommendations
 * shift immediately. A fresh signal has decay≈1.
 */
export async function applySignalIncremental(
  userId: string,
  tmdbId: number,
  mediaType: MediaType,
  weight: number,
): Promise<void> {
  try {
    const feats = await titleFeatures(tmdbId, mediaType);
    const profile = await loadProfile(userId);
    addScaled(profile.vector, feats, weight);
    profile.stats = {
      ...profile.stats,
      signals: (profile.stats.signals ?? 0) + 1,
      updatedAt: Date.now(),
    };
    await saveProfile(userId, profile);
  } catch (err) {
    log.warn("incremental profile update failed", { userId, tmdbId, err: String(err) });
  }
}
