import "server-only";
import { eq } from "drizzle-orm";
import type { HeroSlide, HomeFeed, MediaSummary, MediaType, Rail } from "@/lib/types";
import { getConfig } from "../config";
import { getDb } from "../db";
import { railPrefs as railPrefsTable } from "../db/schema";
import { log } from "../log";
import { resolveActiveServices } from "../region";
import { becauseYouWatched, recommendForUser } from "../recommend/engine";
import { getHiddenTitleIds, getRecentStrongSignals } from "../recommend/signals";
import { getSeerr } from "../seerr/client";
import { getTmdb } from "../tmdb/client";
import { mapLimit } from "../util/concurrency";

const GENRE_PICKS = [
  "Action",
  "Comedy",
  "Drama",
  "Science Fiction",
  "Thriller",
  "Animation",
  "Horror",
  "Romance",
  "Adventure",
  "Mystery",
  "Fantasy",
  "Family",
];

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Deterministic PRNG so a given refresh "variant" is stable but each differs. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const rng = mulberry32(seed + 1);
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function rotate<T>(arr: T[], by: number): T[] {
  if (arr.length === 0) return arr;
  const n = ((by % arr.length) + arr.length) % arr.length;
  return [...arr.slice(n), ...arr.slice(0, n)];
}

/** Fetch card summaries for Seerr/library refs via (cached) TMDB detail. */
async function summariesForRefs(
  refs: { id: number; mediaType: MediaType }[],
  cap = 18,
): Promise<MediaSummary[]> {
  const tmdb = await getTmdb();
  const out = await mapLimit(refs.slice(0, cap), 6, async (r) => {
    try {
      return (await tmdb.getDetail(r.mediaType, r.id)) as MediaSummary;
    } catch {
      return null;
    }
  });
  return out.filter((s): s is MediaSummary => s !== null);
}

async function buildHero(seed: MediaSummary[], cap = 5): Promise<HeroSlide[]> {
  const tmdb = await getTmdb();
  const withBackdrop = seed.filter((s) => s.backdropPath).slice(0, cap);
  return mapLimit(withBackdrop, 4, async (s) => {
    try {
      const d = await tmdb.getDetail(s.mediaType, s.id);
      return {
        item: s,
        logoPath: d.logoPath,
        trailer: d.trailer,
        certification: d.certification,
        runtime: d.runtime,
        genres: d.genres.map((g) => g.name).slice(0, 3),
      } satisfies HeroSlide;
    } catch {
      return {
        item: s,
        logoPath: null,
        trailer: null,
        certification: null,
        runtime: null,
        genres: [],
      } satisfies HeroSlide;
    }
  });
}

interface RailPrefs {
  order: string[];
  disabled: string[];
}

async function loadRailPrefs(userId: string): Promise<RailPrefs> {
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(railPrefsTable)
      .where(eq(railPrefsTable.userId, userId))
      .limit(1);
    const r = rows[0];
    return { order: r?.order ?? [], disabled: r?.disabled ?? [] };
  } catch {
    return { order: [], disabled: [] };
  }
}

function applyRailPrefs(rails: Rail[], prefs: RailPrefs): Rail[] {
  const list = rails.filter((r) => !prefs.disabled.includes(r.id));
  if (!prefs.order.length) return list;
  const idx = (id: string) => {
    const i = prefs.order.indexOf(id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  // Array.sort is stable, so rails not named in `order` keep their default order.
  return [...list].sort((a, b) => idx(a.id) - idx(b.id));
}

/**
 * Compose the ordered home feed. Each rail builder is independent and degrades
 * to null on error, so one failing source never blanks the page.
 */
export async function buildHomeFeed(userId: string, variant = 0): Promise<HomeFeed> {
  const cfg = await getConfig();
  const region = cfg.region.region;
  const monetization = cfg.region.monetizationTypes;
  const { selectedIds, selected } = await resolveActiveServices();
  const providers = selectedIds.length ? selectedIds : undefined;
  const tmdb = await getTmdb();

  // Refresh variation: a non-zero variant pulls a different TMDB page, rotates
  // featured genres, flips the trending window and reshuffles — so each refresh
  // surfaces something different rather than the same feed.
  const v = Math.abs(Math.trunc(variant)) || 0;
  const page = (v % 5) + 1;
  const trendWindow: "day" | "week" = v % 2 === 0 ? "day" : "week";
  const vary = <T,>(arr: T[]): T[] => (v ? seededShuffle(arr, v) : arr);

  const std = (
    id: string,
    title: string,
    items: MediaSummary[],
    kind: Rail["kind"] = "standard",
    context?: Rail["context"],
  ): Rail | null => (items.length >= 4 ? { id, title, kind, items, context } : null);

  // ── kick off the non-personalized fetches in parallel ──────────────────────
  const trendingP = tmdb.trending("all", trendWindow).catch(() => [] as MediaSummary[]);
  const genreMapP = tmdb.genreMap("movie").catch(() => ({}) as Record<number, string>);
  const top10P = tmdb
    .discover("movie", { region, providers, monetization, minVotes: 50, page })
    .catch(() => [] as MediaSummary[]);
  const recentP = tmdb
    .discover("movie", {
      region,
      providers,
      monetization,
      sortBy: "primary_release_date.desc",
      releaseDateLte: today(),
      minVotes: 5,
      page,
    })
    .catch(() => [] as MediaSummary[]);

  // Personalized
  const recsP = cfg.recs.enableRecommendations
    ? recommendForUser(userId, 24).catch(() => ({ items: [] as MediaSummary[], cold: true }))
    : Promise.resolve({ items: [] as MediaSummary[], cold: true });
  const strongP = getRecentStrongSignals(userId, 2).catch(() => []);

  // Library (Seerr)
  const libraryP = cfg.features.enableLibraryRails
    ? (async () => {
        const seerr = await getSeerr();
        if (!seerr.isConfigured()) return [] as MediaSummary[];
        const avail = await seerr.getAvailable(24);
        return summariesForRefs(
          avail.map((a) => ({ id: a.tmdbId, mediaType: a.mediaType })),
          18,
        );
      })().catch(() => [] as MediaSummary[])
    : Promise.resolve([] as MediaSummary[]);

  const [trending, genreMap, top10pool, recent, recs, strong, library] = await Promise.all([
    trendingP,
    genreMapP,
    top10P,
    recentP,
    recsP,
    strongP,
    libraryP,
  ]);

  const hero = await buildHero(vary(trending.length ? trending : top10pool), 5);

  // ── "Because you watched" rails ────────────────────────────────────────────
  const becauseRails = (
    await mapLimit(strong, 2, (s) =>
      becauseYouWatched(userId, { tmdbId: s.tmdbId, mediaType: s.mediaType }).catch(() => null),
    )
  ).filter((r): r is Rail => r !== null);

  // ── "New on {Service}" rails (cap to first 4 selected services) ────────────
  const serviceRails = (
    await mapLimit(selected.slice(0, 4), 2, async (svc) => {
      try {
        const items = await tmdb.discover("movie", {
          region,
          providers: [svc.providerId],
          monetization,
          sortBy: "primary_release_date.desc",
          releaseDateGte: daysAgo(150),
          releaseDateLte: today(),
          minVotes: 3,
          page,
        });
        return std(`service-${svc.providerId}`, `New on ${svc.name}`, items, "service", {
          serviceId: svc.providerId,
        });
      } catch {
        return null;
      }
    })
  ).filter((r): r is Rail => r !== null);

  // ── Genre rails ────────────────────────────────────────────────────────────
  const nameToId = new Map(Object.entries(genreMap).map(([id, name]) => [name, Number(id)]));
  const genreTargets = rotate(GENRE_PICKS, v)
    .map((n) => ({ name: n, id: nameToId.get(n) }))
    .filter((g): g is { name: string; id: number } => g.id !== undefined);
  const genreRails = (
    await mapLimit(genreTargets.slice(0, 5), 2, async (g) => {
      try {
        const items = await tmdb.discover("movie", {
          region,
          providers,
          monetization,
          genres: [g.id],
          minVotes: 50,
          page,
        });
        return std(`genre-${g.id}`, g.name, items, "genre", { genreId: g.id });
      } catch {
        return null;
      }
    })
  ).filter((r): r is Rail => r !== null);

  // ── Assemble in default order ──────────────────────────────────────────────
  const ordered: (Rail | null)[] = [
    std("library", "Available Now in Your Library", library, "library"),
    std("trending", "Trending Now", vary(trending), "standard"),
    ...becauseRails,
    top10pool.length >= 10
      ? {
          id: "top10",
          title: `Top 10 in ${region} Today`,
          kind: "top10" as const,
          items: top10pool.slice(0, 10),
        }
      : null,
    recs.items.length
      ? {
          id: "recommended",
          title: "Recommended for You",
          kind: "standard" as const,
          items: recs.items,
          context: { reason: recs.cold ? "Seeded from your library and services" : undefined },
        }
      : null,
    ...serviceRails,
    ...genreRails,
    std("recently-added", "Recently Added", recent, "standard"),
  ];

  const rails = applyRailPrefs(
    ordered.filter((r): r is Rail => r !== null),
    await loadRailPrefs(userId),
  );

  log.info("home feed built", { userId, rails: rails.length, hero: hero.length });
  return { hero, rails };
}

// ── Infinite scroll: an ordered catalog of additional rails, paginated ────────

interface RailSpec {
  id: string;
  title: string;
  kind: Rail["kind"];
  context?: Rail["context"];
  build: () => Promise<MediaSummary[]>;
}

const DECADES = [2020, 2010, 2000, 1990, 1980];

/** The full ordered list of extended rails (built lazily, page by page). */
async function extraRailSpecs(): Promise<RailSpec[]> {
  const cfg = await getConfig();
  const region = cfg.region.region;
  const monetization = cfg.region.monetizationTypes;
  const { selectedIds } = await resolveActiveServices();
  const providers = selectedIds.length ? selectedIds : undefined;
  const tmdb = await getTmdb();

  const [movieGenres, tvGenres] = await Promise.all([
    tmdb.getGenres("movie").catch(() => []),
    tmdb.getGenres("tv").catch(() => []),
  ]);

  const specs: RailSpec[] = [
    {
      id: "top-rated",
      title: "Top Rated Movies",
      kind: "standard",
      build: () =>
        tmdb.discover("movie", { region, providers, monetization, sortBy: "vote_average.desc", minVotes: 500 }),
    },
    {
      id: "top-rated-tv",
      title: "Top Rated Shows",
      kind: "standard",
      build: () =>
        tmdb.discover("tv", { region, providers, monetization, sortBy: "vote_average.desc", minVotes: 300 }),
    },
  ];

  for (const d of DECADES) {
    specs.push({
      id: `decade-${d}`,
      title: `${d}s`,
      kind: "standard",
      build: () =>
        tmdb.discover("movie", {
          region,
          providers,
          monetization,
          releaseDateGte: `${d}-01-01`,
          releaseDateLte: `${d + 9}-12-31`,
          minVotes: 100,
        }),
    });
  }

  const picked = new Set(GENRE_PICKS);
  for (const g of movieGenres.filter((x) => !picked.has(x.name))) {
    specs.push({
      id: `genre-x-${g.id}`,
      title: g.name,
      kind: "genre",
      context: { genreId: g.id },
      build: () => tmdb.discover("movie", { region, providers, monetization, genres: [g.id], minVotes: 50 }),
    });
  }
  for (const g of tvGenres) {
    specs.push({
      id: `tv-genre-${g.id}`,
      title: `${g.name} · TV`,
      kind: "genre",
      context: { genreId: g.id },
      build: () => tmdb.discover("tv", { region, providers, monetization, genres: [g.id], minVotes: 30 }),
    });
  }
  return specs;
}

export interface ExtraRailsPage {
  rails: Rail[];
  hasMore: boolean;
}

/** Build one page of extended rails (4 per page by default) for infinite scroll. */
export async function buildExtraRails(
  userId: string,
  page: number,
  pageSize = 4,
): Promise<ExtraRailsPage> {
  const [specs, hidden] = await Promise.all([extraRailSpecs(), getHiddenTitleIds(userId)]);
  const start = Math.max(0, page - 1) * pageSize;
  const slice = specs.slice(start, start + pageSize);

  const built = await mapLimit(slice, 3, async (spec): Promise<Rail | null> => {
    try {
      const items = (await spec.build()).filter((i) => !hidden.has(i.id));
      if (items.length < 4) return null;
      return { id: spec.id, title: spec.title, kind: spec.kind, items, context: spec.context };
    } catch {
      return null;
    }
  });

  return {
    rails: built.filter((r): r is Rail => r !== null),
    hasMore: start + pageSize < specs.length,
  };
}
