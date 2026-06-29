import "server-only";
import type { Availability, MediaType } from "@/lib/types";
import { cached } from "../cache";
import { getConfig } from "../config";
import { log } from "../log";
import { assertSafeUpstreamUrl } from "../net";
import type {
  SeerrMediaListItem,
  SeerrMediaListResponse,
  SeerrRequestBody,
  SeerrStatus,
  SeerrTitleResponse,
  SeerrWatchlistResponse,
} from "./types";

export class SeerrNotConfiguredError extends Error {
  constructor() {
    super("Seerr is not configured. Set the internal URL and API key in Settings.");
    this.name = "SeerrNotConfiguredError";
  }
}

const UNKNOWN: Availability = { status: 0, known: false };
const NOT_IN_LIBRARY: Availability = { status: 0, known: true };

/** Bounded-concurrency map to avoid hammering Seerr on batch lookups. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const idx = i++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}

export class SeerrClient {
  constructor(
    private readonly internalUrl: string,
    private readonly apiKey: string,
  ) {}

  /** Internal URL + key are the only thing that gates server-to-server calls. */
  isConfigured(): boolean {
    return Boolean(this.internalUrl && this.apiKey);
  }

  private base(): string {
    return this.internalUrl.replace(/\/+$/, "");
  }

  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    if (!this.isConfigured()) throw new SeerrNotConfiguredError();
    assertSafeUpstreamUrl(this.base()); // SSRF guard on every Seerr call

    const res = await fetch(this.base() + path, {
      ...init,
      headers: {
        "X-Api-Key": this.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const err = new Error(`Seerr ${res.status}: ${body.slice(0, 200)}`);
      (err as Error & { status?: number }).status = res.status;
      throw err;
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  /** Connection test used by Settings → returns version on success. */
  async status(): Promise<SeerrStatus> {
    return this.call<SeerrStatus>("/api/v1/status");
  }

  /**
   * Resolve library availability for a single title. Never throws - degrades to
   * `{ known: false }` so the catalog keeps browsing if Seerr is unreachable.
   */
  async getAvailability(type: MediaType, tmdbId: number): Promise<Availability> {
    if (!this.isConfigured()) return UNKNOWN;
    try {
      return await cached<Availability>(
        `seerr:status:${type}:${tmdbId}`,
        { ttlMs: 90_000, staleMs: 1000 * 60 * 60 },
        async () => {
          const data = await this.call<SeerrTitleResponse>(`/api/v1/${type}/${tmdbId}`);
          const mi = data.mediaInfo;
          if (!mi) return NOT_IN_LIBRARY;
          const seasons =
            type === "tv" && mi.seasons
              ? Object.fromEntries(mi.seasons.map((s) => [s.seasonNumber, s.status]))
              : undefined;
          return { status: mi.status ?? 0, seasons, known: true };
        },
      );
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      if (status === 404) return NOT_IN_LIBRARY;
      log.warn("seerr availability lookup failed", { type, tmdbId, err: String(err) });
      return UNKNOWN;
    }
  }

  /** Batch availability for a rail of titles; cached + concurrency-limited. */
  async getAvailabilityBatch(
    items: { id: number; mediaType: MediaType }[],
  ): Promise<Record<string, Availability>> {
    const out: Record<string, Availability> = {};
    if (!this.isConfigured()) {
      for (const it of items) out[`${it.mediaType}:${it.id}`] = UNKNOWN;
      return out;
    }
    const results = await mapLimit(items, 8, (it) => this.getAvailability(it.mediaType, it.id));
    items.forEach((it, idx) => {
      out[`${it.mediaType}:${it.id}`] = results[idx];
    });
    return out;
  }

  /** Titles Seerr reports as available, for the "In your library" rail. */
  async getAvailable(take = 60): Promise<SeerrMediaListItem[]> {
    if (!this.isConfigured()) return [];
    try {
      return await cached<SeerrMediaListItem[]>(
        `seerr:available:${take}`,
        { ttlMs: 1000 * 60 * 5, staleMs: 1000 * 60 * 60 },
        async () => {
          const data = await this.call<SeerrMediaListResponse>(
            `/api/v1/media?filter=available&take=${take}&sort=added`,
          );
          return data.results ?? [];
        },
      );
    } catch (err) {
      log.warn("seerr available list failed", { err: String(err) });
      return [];
    }
  }

  async getWatchlist(): Promise<SeerrWatchlistResponse["results"]> {
    if (!this.isConfigured()) return [];
    try {
      const data = await this.call<SeerrWatchlistResponse>("/api/v1/discover/watchlist");
      return data.results ?? [];
    } catch (err) {
      log.warn("seerr watchlist failed", { err: String(err) });
      return [];
    }
  }

  /** Proxy a request on the user's behalf (SEERR_REQUEST_MODE=proxy). */
  async createRequest(body: SeerrRequestBody): Promise<{ id?: number; status?: number }> {
    return this.call("/api/v1/request", { method: "POST", body: JSON.stringify(body) });
  }
}

export async function getSeerr(): Promise<SeerrClient> {
  const cfg = await getConfig();
  return new SeerrClient(cfg.seerr.internalUrl, cfg.seerr.apiKey);
}
