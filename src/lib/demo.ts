/**
 * Demo mode: a fully static, keyless build for the public showcase. When
 * `NEXT_PUBLIC_DEMO=1`, `lib/api` swaps the live BFF for this fixture-backed
 * client. Catalog data + images come from bundled JSON snapshots under
 * `public/demo/` (public TMDB data only - no secrets, no Seerr, no DB).
 */
import type { Api } from "./api";
import type { PublicConfig } from "./config";
import type {
  Availability,
  HomeFeed,
  MediaDetail,
  MediaSummary,
  MediaType,
  TitleResponse,
} from "./types";

export const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const VERSION = process.env.NEXT_PUBLIC_VERSION ?? "demo";

const UNKNOWN: Availability = { status: 0, known: false };
const keyOf = (type: MediaType, id: number) => `${type}:${id}`;

/** Static public config used to render the shell without a DB. Locked so the
 *  Settings screen presents as a read-only showcase. */
export const DEMO_PUBLIC_CONFIG: PublicConfig = {
  core: { publicUrl: "", tz: "UTC", lockConfig: true, version: VERSION },
  tmdb: { language: "en-US", hasKey: true, configured: true },
  seerr: { externalUrl: "", requestMode: "redirect", hasKey: false, configured: false },
  region: { region: "US", services: [], monetizationTypes: ["flatrate"] },
  auth: { mode: "none" },
  recs: { enableRecommendations: true, enableEmbeddings: false },
  features: { enableLibraryRails: true, heroRotateSeconds: 12 },
  appearance: { theme: "dark", accent: "0 72% 51%" },
};

// In-memory snapshot of the home feed, used to power search + synthesize detail
// for any card we didn't pre-capture.
let homeCache: HomeFeed | null = null;
const itemIndex = new Map<string, MediaSummary>();

async function loadHome(): Promise<HomeFeed> {
  if (homeCache) return homeCache;
  const res = await fetch(`${BASE}/demo/home.json`);
  const home = (await res.json()) as HomeFeed;
  for (const slide of home.hero) itemIndex.set(keyOf(slide.item.mediaType, slide.item.id), slide.item);
  for (const rail of home.rails) {
    for (const item of rail.items) itemIndex.set(keyOf(item.mediaType, item.id), item);
  }
  homeCache = home;
  return home;
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  let a = (seed + 1) >>> 0;
  const rng = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Rotate + reshuffle the snapshot so the demo's "refresh" also feels different. */
async function demoHome(variant: number): Promise<HomeFeed> {
  const home = await loadHome();
  if (!variant) return home;
  const v = Math.abs(variant);
  const n = home.rails.length;
  const rotated = [...home.rails.slice(v % n), ...home.rails.slice(0, v % n)];
  return {
    hero: seededShuffle(home.hero, v),
    rails: rotated.map((r) => ({ ...r, items: seededShuffle(r.items, v) })),
  };
}

/** A handful of other catalog items to fill "More Like This" for synthesized detail. */
function relatedItems(excludeKey: string, n: number): MediaSummary[] {
  const out: MediaSummary[] = [];
  for (const [k, item] of itemIndex) {
    if (k === excludeKey) continue;
    out.push(item);
    if (out.length >= n) break;
  }
  return out;
}

function synthesizeDetail(type: MediaType, id: number, summary?: MediaSummary): MediaDetail {
  const base: MediaSummary =
    summary ??
    {
      id,
      mediaType: type,
      title: "Title unavailable in demo",
      overview: "",
      posterPath: null,
      backdropPath: null,
      year: null,
      voteAverage: 0,
      popularity: 0,
      genreIds: [],
      originalLanguage: "en",
    };
  return {
    ...base,
    tagline: "",
    genres: [],
    runtime: null,
    releaseDate: null,
    certification: null,
    cast: [],
    crew: [],
    videos: [],
    trailer: null,
    logoPath: null,
    keywords: [],
    watch: { link: null, flatrate: [], rent: [], buy: [], ads: [], free: [] },
    recommendations: relatedItems(keyOf(type, id), 12),
    similar: [],
    seasons: [],
    numberOfSeasons: null,
  };
}

async function demoTitle(type: MediaType, id: number): Promise<TitleResponse> {
  try {
    const res = await fetch(`${BASE}/demo/titles/${type}-${id}.json`);
    if (res.ok) return (await res.json()) as TitleResponse;
  } catch {
    /* fall through to synthesis */
  }
  await loadHome();
  return {
    detail: synthesizeDetail(type, id, itemIndex.get(keyOf(type, id))),
    availability: UNKNOWN,
    request: { mode: "redirect", redirectUrl: null },
  };
}

async function demoSearch(q: string): Promise<MediaSummary[]> {
  await loadHome();
  const needle = q.trim().toLowerCase();
  if (needle.length < 2) return [];
  const seen = new Set<string>();
  const results: MediaSummary[] = [];
  for (const item of itemIndex.values()) {
    if (!item.title.toLowerCase().includes(needle)) continue;
    const k = keyOf(item.mediaType, item.id);
    if (seen.has(k)) continue;
    seen.add(k);
    results.push(item);
    if (results.length >= 24) break;
  }
  return results;
}

const disabled = (what: string) => (): never => {
  throw new Error(`${what} are disabled in the demo.`);
};

export const demoApi: Api = {
  getConfig: async () => DEMO_PUBLIC_CONFIG,
  saveConfig: disabled("Settings"),
  getRegions: async () => {
    try {
      const res = await fetch(`${BASE}/demo/regions.json`);
      if (res.ok) return await res.json();
    } catch {
      /* ignore */
    }
    return [{ code: "US", name: "United States" }];
  },
  getServices: async (region?: string) => ({ region: region ?? "US", services: [] }),
  getHome: (variant = 0) => demoHome(variant),
  getRails: async () => ({ rails: [], hasMore: false }),
  getTitle: (type, id) => demoTitle(type, id),
  // Static demo has no episode fixtures - synthesize a generic list so the
  // expandable season UI still demonstrates.
  getSeason: async () => ({
    episodes: Array.from({ length: 8 }, (_, i) => ({
      episodeNumber: i + 1,
      name: `Episode ${i + 1}`,
      overview: "",
      airDate: null,
      runtime: null,
      stillPath: null,
      voteAverage: 0,
    })),
  }),
  getAvailability: async () => ({ availability: {} }),
  request: disabled("Requests"),
  signal: async () => ({ ok: true }),
  explain: async () => ({
    reasons: ["This is a static demo - recommendations aren't personalized here."],
  }),
  resetTaste: async () => ({ ok: true }),
  search: async (q: string) => ({ results: await demoSearch(q) }),
  testConnection: async () => ({ ok: false, detail: "Connection tests are disabled in the demo." }),
};
