import "server-only";
import type {
  MediaDetail,
  MediaSummary,
  MediaType,
  RegionOption,
  RegionProvider,
  RegionWatch,
} from "@/lib/types";
import type { MonetizationType } from "@/lib/config";
import { cached, type CacheOpts } from "../cache";
import { getConfig } from "../config";
import { log } from "../log";
import { regionWatch, toDetail, toSummaries } from "./normalize";
import type {
  TmdbDetail,
  TmdbGenre,
  TmdbMediaResult,
  TmdbPaginated,
  TmdbRegion,
  TmdbWatchProvider,
} from "./types";

const BASE = "https://api.themoviedb.org/3";

const TTL = {
  regions: { ttlMs: 1000 * 60 * 60 * 24, staleMs: 1000 * 60 * 60 * 24 * 7 },
  providers: { ttlMs: 1000 * 60 * 60 * 12, staleMs: 1000 * 60 * 60 * 24 * 3 },
  discover: { ttlMs: 1000 * 60 * 45, staleMs: 1000 * 60 * 60 * 12 },
  trending: { ttlMs: 1000 * 60 * 30, staleMs: 1000 * 60 * 60 * 6 },
  detail: { ttlMs: 1000 * 60 * 60 * 6, staleMs: 1000 * 60 * 60 * 24 * 2 },
  genres: { ttlMs: 1000 * 60 * 60 * 24 * 7, staleMs: 1000 * 60 * 60 * 24 * 30 },
  search: { ttlMs: 1000 * 60 * 5 },
} satisfies Record<string, CacheOpts>;

export class TmdbNotConfiguredError extends Error {
  constructor() {
    super("TMDB is not configured. Set a TMDB API key or access token in Settings.");
    this.name = "TmdbNotConfiguredError";
  }
}

export class TmdbError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "TmdbError";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface DiscoverOpts {
  region: string;
  providers?: number[];
  monetization?: MonetizationType[];
  sortBy?: string;
  page?: number;
  genres?: number[];
  withoutGenres?: number[];
  minVotes?: number;
  releaseDateGte?: string;
  releaseDateLte?: string;
  originalLanguage?: string;
}

export class TmdbClient {
  constructor(
    private readonly creds: { apiKey: string; accessToken: string; language: string },
  ) {}

  get language(): string {
    return this.creds.language || "en-US";
  }

  isConfigured(): boolean {
    return Boolean(this.creds.apiKey || this.creds.accessToken);
  }

  private buildUrl(path: string, params: Record<string, string | number | undefined>): string {
    const url = new URL(BASE + path);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
    if (!this.creds.accessToken && this.creds.apiKey) {
      url.searchParams.set("api_key", this.creds.apiKey);
    }
    return url.toString();
  }

  private cacheKey(path: string, params: Record<string, string | number | undefined>): string {
    const entries = Object.entries(params)
      .filter(([k, v]) => v !== undefined && v !== "" && k !== "api_key")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
    return `tmdb:${path}?${entries}`;
  }

  private async raw<T>(
    path: string,
    params: Record<string, string | number | undefined>,
    cacheOpts: CacheOpts,
  ): Promise<T> {
    if (!this.isConfigured()) throw new TmdbNotConfiguredError();
    const key = this.cacheKey(path, params);
    return cached<T>(key, cacheOpts, async () => {
      const url = this.buildUrl(path, params);
      const headers: Record<string, string> = { Accept: "application/json" };
      if (this.creds.accessToken) headers.Authorization = `Bearer ${this.creds.accessToken}`;

      let attempt = 0;
      // Retry on 429 / 5xx with backoff, honoring Retry-After.
      for (;;) {
        let res: Response;
        try {
          res = await fetch(url, { headers, signal: AbortSignal.timeout(12_000) });
        } catch (err) {
          if (attempt < 3) {
            await sleep(250 * 2 ** attempt);
            attempt++;
            continue;
          }
          throw new TmdbError(`TMDB request failed: ${String(err)}`, 0);
        }
        if ((res.status === 429 || res.status >= 500) && attempt < 3) {
          const ra = Number(res.headers.get("retry-after"));
          await sleep(Number.isFinite(ra) && ra > 0 ? ra * 1000 : 300 * 2 ** attempt);
          attempt++;
          continue;
        }
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          log.warn("tmdb non-ok", { path, status: res.status });
          throw new TmdbError(`TMDB ${res.status}: ${body.slice(0, 200)}`, res.status);
        }
        return (await res.json()) as T;
      }
    });
  }

  // ── Regions & providers ────────────────────────────────────────────────────

  async getRegions(): Promise<RegionOption[]> {
    const data = await this.raw<{ results: TmdbRegion[] }>(
      "/watch/providers/regions",
      { language: this.language },
      TTL.regions,
    );
    return data.results
      .map((r) => ({ code: r.iso_3166_1, name: r.english_name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getWatchProviders(type: MediaType, region: string): Promise<RegionProvider[]> {
    const data = await this.raw<{ results: TmdbWatchProvider[] }>(
      `/watch/providers/${type}`,
      { language: this.language, watch_region: region },
      TTL.providers,
    );
    return data.results.map((p) => ({
      providerId: p.provider_id,
      name: p.provider_name,
      logoPath: p.logo_path,
      priority: p.display_priority,
    }));
  }

  // ── Discover / trending ─────────────────────────────────────────────────────

  async discover(type: MediaType, opts: DiscoverOpts): Promise<MediaSummary[]> {
    const params: Record<string, string | number | undefined> = {
      language: this.language,
      watch_region: opts.region,
      sort_by: opts.sortBy ?? "popularity.desc",
      page: opts.page ?? 1,
      include_adult: "false",
      "vote_count.gte": opts.minVotes,
      with_genres: opts.genres?.join(","),
      without_genres: opts.withoutGenres?.join(","),
      with_original_language: opts.originalLanguage,
    };
    // OR-join providers/monetization so "any of my services" matches.
    if (opts.providers?.length) params.with_watch_providers = opts.providers.join("|");
    if (opts.monetization?.length) params.with_watch_monetization_types = opts.monetization.join("|");
    if (opts.releaseDateGte) {
      params[type === "movie" ? "primary_release_date.gte" : "first_air_date.gte"] =
        opts.releaseDateGte;
    }
    if (opts.releaseDateLte) {
      params[type === "movie" ? "primary_release_date.lte" : "first_air_date.lte"] =
        opts.releaseDateLte;
    }
    const data = await this.raw<TmdbPaginated<TmdbMediaResult>>(
      `/discover/${type}`,
      params,
      TTL.discover,
    );
    return toSummaries(data.results, type);
  }

  async trending(
    media: "all" | "movie" | "tv" = "all",
    window: "day" | "week" = "day",
  ): Promise<MediaSummary[]> {
    const data = await this.raw<TmdbPaginated<TmdbMediaResult>>(
      `/trending/${media}/${window}`,
      { language: this.language },
      TTL.trending,
    );
    return toSummaries(data.results);
  }

  // ── Detail ──────────────────────────────────────────────────────────────────

  async getDetail(type: MediaType, id: number, region?: string): Promise<MediaDetail> {
    const cfg = region ? null : await getConfig();
    const reg = region ?? cfg!.region.region;
    const append =
      type === "movie"
        ? "videos,images,credits,keywords,recommendations,similar,watch/providers,release_dates"
        : "videos,images,credits,keywords,recommendations,similar,watch/providers,content_ratings";
    const data = await this.raw<TmdbDetail>(
      `/${type}/${id}`,
      {
        language: this.language,
        append_to_response: append,
        include_image_language: `${this.language.split("-")[0]},en,null`,
      },
      TTL.detail,
    );
    return toDetail(data, type, reg, this.language);
  }

  async getTitleProviders(type: MediaType, id: number, region: string): Promise<RegionWatch> {
    const data = await this.raw<{ results?: Record<string, unknown> }>(
      `/${type}/${id}/watch/providers`,
      {},
      TTL.providers,
    );
    return regionWatch((data.results as Record<string, never> | undefined)?.[region]);
  }

  // ── Search & genres ──────────────────────────────────────────────────────────

  async search(query: string): Promise<MediaSummary[]> {
    if (!query.trim()) return [];
    const data = await this.raw<TmdbPaginated<TmdbMediaResult>>(
      "/search/multi",
      { language: this.language, query, include_adult: "false", page: 1 },
      TTL.search,
    );
    return toSummaries(data.results);
  }

  async getGenres(type: MediaType): Promise<TmdbGenre[]> {
    const data = await this.raw<{ genres: TmdbGenre[] }>(
      `/genre/${type}/list`,
      { language: this.language },
      TTL.genres,
    );
    return data.genres;
  }

  async genreMap(type: MediaType): Promise<Record<number, string>> {
    const genres = await this.getGenres(type);
    return Object.fromEntries(genres.map((g) => [g.id, g.name]));
  }
}

/** Build a TMDB client bound to the current resolved configuration. */
export async function getTmdb(): Promise<TmdbClient> {
  const cfg = await getConfig();
  return new TmdbClient({
    apiKey: cfg.tmdb.apiKey,
    accessToken: cfg.tmdb.accessToken,
    language: cfg.tmdb.language,
  });
}
