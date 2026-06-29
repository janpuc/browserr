import type { PublicConfig, SettingsPatch } from "./config";
import { DEMO, demoApi } from "./demo";
import type { SignalType } from "./signals";
import type {
  Availability,
  EpisodeSummary,
  HomeFeed,
  MediaSummary,
  MediaType,
  Rail,
  RegionOption,
  RegionProvider,
  TitleResponse,
} from "./types";

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* ignore */
    }
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as T;
}

const realApi = {
  getConfig: () => fetchJson<PublicConfig>("/api/config"),
  saveConfig: (patch: SettingsPatch) =>
    fetchJson<PublicConfig>("/api/config", { method: "PUT", body: JSON.stringify(patch) }),
  getDiagnostics: () => fetchJson<Record<string, unknown>>("/api/diagnostics"),

  getRegions: () => fetchJson<RegionOption[]>("/api/regions"),
  getServices: (region?: string) =>
    fetchJson<{ region: string; services: RegionProvider[] }>(
      `/api/services${region ? `?region=${encodeURIComponent(region)}` : ""}`,
    ),

  getHome: (variant = 0) => fetchJson<HomeFeed>(`/api/home${variant ? `?v=${variant}` : ""}`),
  getRails: (page: number) =>
    fetchJson<{ rails: Rail[]; hasMore: boolean }>(`/api/rails?page=${page}`),
  getTitle: (type: MediaType, id: number) => fetchJson<TitleResponse>(`/api/title/${type}/${id}`),
  getSeason: (id: number, seasonNumber: number) =>
    fetchJson<{ episodes: EpisodeSummary[] }>(`/api/title/tv/${id}/season/${seasonNumber}`),

  getAvailability: (items: { id: number; mediaType: MediaType }[]) =>
    fetchJson<{ availability: Record<string, Availability> }>("/api/availability", {
      method: "POST",
      body: JSON.stringify({ items }),
    }),

  request: (body: { tmdbId: number; mediaType: MediaType; seasons?: number[] | "all" }) =>
    fetchJson<{ mode: "redirect" | "proxy"; ok: boolean; redirectUrl?: string }>("/api/request", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  signal: (body: { tmdbId: number; mediaType: MediaType; type: SignalType }) =>
    fetchJson<{ ok: boolean }>("/api/signals", {
      method: "POST",
      body: JSON.stringify(body),
    }).catch(() => ({ ok: false })),

  explain: (type: MediaType, id: number) =>
    fetchJson<{ reasons: string[] }>(`/api/recommendations/explain?type=${type}&id=${id}`),
  resetTaste: () => fetchJson<{ ok: boolean }>("/api/recommendations/reset", { method: "POST" }),

  search: (q: string) =>
    fetchJson<{ results: MediaSummary[] }>(`/api/search?q=${encodeURIComponent(q)}`),

  testConnection: (body: {
    target: "tmdb" | "seerr";
    apiKey?: string;
    accessToken?: string;
    internalUrl?: string;
  }) =>
    fetchJson<{ ok: boolean; detail: string }>("/api/connection-test", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

/** Shape every api client (live + demo) must satisfy. */
export type Api = typeof realApi;

/** The live BFF client, or the static fixture client in demo builds. */
export const api: Api = DEMO ? demoApi : realApi;

/** Beacon-friendly signal sender that survives navigation (hover/click capture). */
export function sendSignalBeacon(body: {
  tmdbId: number;
  mediaType: MediaType;
  type: SignalType;
}): void {
  if (DEMO) return;
  try {
    const payload = JSON.stringify(body);
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/signals", new Blob([payload], { type: "application/json" }));
      return;
    }
  } catch {
    /* fall through */
  }
  void api.signal(body);
}
