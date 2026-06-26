import "server-only";
import type { MediaSummary, MediaType, Rail } from "@/lib/types";
import { cached } from "../cache";
import { getConfig } from "../config";
import { resolveActiveServices } from "../region";
import { getSeerr } from "../seerr/client";
import { getTmdb } from "../tmdb/client";
import {
  addScaled,
  cosine,
  featuresFromDetail,
  featuresFromSummary,
  qualityPrior,
  unit,
  type Vector,
} from "./features";
import { loadProfile, titleFeatures } from "./profile";
import { getConsumedTitleIds, getHiddenTitleIds } from "./signals";

interface Scored {
  item: MediaSummary;
  score: number;
}

function dedupe(items: MediaSummary[]): MediaSummary[] {
  const seen = new Set<string>();
  const out: MediaSummary[] = [];
  for (const it of items) {
    const key = `${it.mediaType}:${it.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

/** Set of tmdbIds Seerr reports available (for an availability boost). */
async function availableIdSet(): Promise<Set<number>> {
  return cached<Set<number>>(
    "recs:availableIds",
    { ttlMs: 1000 * 60 * 5, staleMs: 1000 * 60 * 60 },
    async () => {
      const seerr = await getSeerr();
      const list = await seerr.getAvailable(80);
      return new Set(list.map((m) => m.tmdbId));
    },
  );
}

/**
 * Cold start: seed taste from the library composition (Seerr-available titles),
 * falling back to popular-in-region as a neutral prior when Seerr is absent.
 */
async function coldStartVector(): Promise<Vector> {
  return cached<Vector>("recs:coldstart", { ttlMs: 1000 * 60 * 30 }, async () => {
    const cfg = await getConfig();
    const { selectedIds } = await resolveActiveServices();
    const seerr = await getSeerr();
    const vector: Vector = {};

    let sample: { id: number; mediaType: MediaType }[] = [];
    if (seerr.isConfigured()) {
      const avail = await seerr.getAvailable(40);
      sample = avail.slice(0, 25).map((a) => ({ id: a.tmdbId, mediaType: a.mediaType }));
    }

    if (sample.length >= 8) {
      for (const t of sample) {
        try {
          addScaled(vector, await titleFeatures(t.id, t.mediaType), 1);
        } catch {
          /* skip titles TMDB can't resolve */
        }
      }
      return unit(vector);
    }

    // No library signal — use popularity in the active region/services.
    const tmdb = await getTmdb();
    const providers = selectedIds.length ? selectedIds : undefined;
    const pop = await tmdb.discover("movie", {
      region: cfg.region.region,
      providers,
      monetization: cfg.region.monetizationTypes,
      minVotes: 100,
    });
    for (const s of pop.slice(0, 25)) addScaled(vector, featuresFromSummary(s), 1);
    return unit(vector);
  });
}

async function effectiveProfile(userId: string): Promise<{ vector: Vector; cold: boolean }> {
  const profile = await loadProfile(userId);
  if (Object.keys(profile.vector).length >= 4) return { vector: profile.vector, cold: false };
  // Weak/empty profile: blend cold-start prior with whatever real signal exists.
  const blended = { ...(await coldStartVector()) };
  addScaled(blended, profile.vector, 2);
  return { vector: blended, cold: true };
}

async function candidatePool(): Promise<MediaSummary[]> {
  const cfg = await getConfig();
  const { selectedIds } = await resolveActiveServices();
  const tmdb = await getTmdb();
  const region = cfg.region.region;
  const providers = selectedIds.length ? selectedIds : undefined;
  const monetization = cfg.region.monetizationTypes;

  const lists = await Promise.all([
    tmdb.discover("movie", { region, providers, monetization, page: 1, minVotes: 50 }),
    tmdb.discover("tv", { region, providers, monetization, page: 1, minVotes: 50 }),
    tmdb.discover("movie", { region, providers, monetization, page: 2, minVotes: 50 }),
    tmdb.discover("movie", {
      region,
      providers,
      monetization,
      sortBy: "vote_average.desc",
      minVotes: 300,
    }),
  ]);
  return dedupe(lists.flat());
}

function scoreItem(vector: Vector, s: MediaSummary, availableIds: Set<number>): number {
  const sim = cosine(vector, featuresFromSummary(s));
  const prior = qualityPrior(s);
  const availBoost = availableIds.has(s.id) ? 0.15 : 0; // prefer titles in library
  return 0.7 * sim + 0.25 * prior + availBoost;
}

/**
 * Greedy diversity selection: penalize repeated primary genres so a rail isn't
 * monotonous (a light MMR variant).
 */
function diversify(scored: Scored[], limit: number): MediaSummary[] {
  const pool = [...scored].sort((a, b) => b.score - a.score).slice(0, limit * 4);
  const genreUse = new Map<number, number>();
  const picked: MediaSummary[] = [];

  while (picked.length < limit && pool.length) {
    let bestIdx = 0;
    let bestAdj = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const g = pool[i].item.genreIds[0];
      const penalty = g !== undefined ? (genreUse.get(g) ?? 0) * 0.06 : 0;
      const adj = pool[i].score - penalty;
      if (adj > bestAdj) {
        bestAdj = adj;
        bestIdx = i;
      }
    }
    const [chosen] = pool.splice(bestIdx, 1);
    picked.push(chosen.item);
    for (const g of chosen.item.genreIds) genreUse.set(g, (genreUse.get(g) ?? 0) + 1);
  }
  return picked;
}

export async function recommendForUser(
  userId: string,
  limit = 24,
): Promise<{ items: MediaSummary[]; cold: boolean }> {
  const [{ vector, cold }, pool, hidden, consumed, availableIds] = await Promise.all([
    effectiveProfile(userId),
    candidatePool(),
    getHiddenTitleIds(userId),
    getConsumedTitleIds(userId),
    availableIdSet(),
  ]);

  const scored = pool
    .filter((s) => !hidden.has(s.id) && !consumed.has(s.id))
    .map((item) => ({ item, score: scoreItem(vector, item, availableIds) }));

  return { items: diversify(scored, limit), cold };
}

/**
 * "Because you watched X": TMDB recommendations + similar for the seed,
 * re-ranked by local feature similarity to the seed, filtered of hidden titles.
 */
export async function becauseYouWatched(
  userId: string,
  seed: { tmdbId: number; mediaType: MediaType },
): Promise<Rail | null> {
  const tmdb = await getTmdb();
  const detail = await tmdb.getDetail(seed.mediaType, seed.tmdbId);
  const seedFeat = featuresFromDetail(detail);
  const hidden = await getHiddenTitleIds(userId);

  const candidates = dedupe([...detail.recommendations, ...detail.similar]).filter(
    (c) => c.id !== seed.tmdbId && !hidden.has(c.id),
  );
  if (candidates.length < 4) return null;

  const scored = candidates.map((item) => ({
    item,
    score: 0.8 * cosine(seedFeat, featuresFromSummary(item)) + 0.2 * qualityPrior(item),
  }));
  const items = diversify(scored, 20);
  if (items.length < 4) return null;

  return {
    id: `because-${seed.mediaType}-${seed.tmdbId}`,
    title: `Because you watched ${detail.title}`,
    kind: "because",
    items,
    context: {
      becauseOf: { id: seed.tmdbId, mediaType: seed.mediaType, title: detail.title },
    },
  };
}

/** Human-readable "Why am I seeing this?" — top overlapping features. */
export async function explainRecommendation(
  userId: string,
  tmdbId: number,
  mediaType: MediaType,
): Promise<{ reasons: string[] }> {
  const tmdb = await getTmdb();
  const [profile, detail] = await Promise.all([
    loadProfile(userId),
    tmdb.getDetail(mediaType, tmdbId),
  ]);
  const feats = featuresFromDetail(detail);

  // Build token → label map from the detail payload.
  const label = new Map<string, string>();
  for (const g of detail.genres) label.set(`genre:${g.id}`, g.name);
  for (const k of detail.keywords) label.set(`kw:${k.id}`, k.name);
  for (const p of [...detail.cast, ...detail.crew]) label.set(`person:${p.id}`, p.name);
  if (detail.year) label.set(`decade:${Math.floor(detail.year / 10) * 10}`, `${Math.floor(detail.year / 10) * 10}s`);
  label.set(`lang:${detail.originalLanguage}`, `${detail.originalLanguage.toUpperCase()} titles`);

  const contributions = Object.keys(feats)
    .map((token) => ({ token, value: (profile.vector[token] ?? 0) * feats[token] }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 4)
    .map((c) => label.get(c.token) ?? c.token);

  const reasons = contributions.length
    ? contributions
    : ["Popular with your selected services"];
  return { reasons };
}
