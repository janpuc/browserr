import "server-only";
import type {
  MediaDetail,
  MediaSummary,
  MediaType,
  Person,
  ProviderInfo,
  RegionWatch,
  SeasonSummary,
  Video,
} from "@/lib/types";
import type {
  TmdbCastMember,
  TmdbCrewMember,
  TmdbDetail,
  TmdbImage,
  TmdbMediaResult,
  TmdbVideo,
  TmdbWatchProvider,
  TmdbWatchProviderEntry,
} from "./types";

function yearOf(raw: TmdbMediaResult): number | null {
  const d = raw.release_date || raw.first_air_date;
  if (!d) return null;
  const y = Number.parseInt(d.slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

export function resolveMediaType(raw: TmdbMediaResult, fallback?: MediaType): MediaType | null {
  if (raw.media_type === "movie" || raw.media_type === "tv") return raw.media_type;
  if (raw.media_type === "person") return null;
  // Heuristic: movies have title, shows have name.
  if (fallback) return fallback;
  if (raw.title) return "movie";
  if (raw.name) return "tv";
  return null;
}

export function toSummary(raw: TmdbMediaResult, fallback?: MediaType): MediaSummary | null {
  const mediaType = resolveMediaType(raw, fallback);
  if (!mediaType) return null;
  const title = raw.title || raw.name || raw.original_title || raw.original_name || "Untitled";
  return {
    id: raw.id,
    mediaType,
    title,
    overview: raw.overview ?? "",
    posterPath: raw.poster_path ?? null,
    backdropPath: raw.backdrop_path ?? null,
    year: yearOf(raw),
    voteAverage: raw.vote_average ?? 0,
    popularity: raw.popularity ?? 0,
    genreIds: raw.genre_ids ?? [],
    originalLanguage: raw.original_language ?? "",
  };
}

export function toSummaries(list: TmdbMediaResult[] | undefined, fallback?: MediaType): MediaSummary[] {
  if (!list) return [];
  const out: MediaSummary[] = [];
  for (const r of list) {
    const s = toSummary(r, fallback);
    if (s) out.push(s);
  }
  return out;
}

export function pickTrailer(videos: TmdbVideo[] | undefined): Video | null {
  if (!videos?.length) return null;
  const yt = videos.filter((v) => v.site === "YouTube" && v.key);
  if (!yt.length) return null;
  const rank = (v: TmdbVideo) => {
    let score = 0;
    if (v.type === "Trailer") score += 4;
    else if (v.type === "Teaser") score += 2;
    if (v.official) score += 1;
    return score;
  };
  const best = [...yt].sort((a, b) => rank(b) - rank(a))[0];
  return { key: best.key, site: best.site, type: best.type, name: best.name, official: best.official };
}

export function toVideos(videos: TmdbVideo[] | undefined): Video[] {
  if (!videos) return [];
  return videos
    .filter((v) => v.site === "YouTube" && v.key)
    .map((v) => ({ key: v.key, site: v.site, type: v.type, name: v.name, official: v.official }));
}

export function pickLogo(logos: TmdbImage[] | undefined, language: string): string | null {
  if (!logos?.length) return null;
  const lang = language.split("-")[0];
  const score = (img: TmdbImage) => {
    let s = img.vote_average ?? 0;
    if (img.iso_639_1 === lang) s += 100;
    else if (img.iso_639_1 === "en") s += 50;
    else if (img.iso_639_1 === null) s += 10;
    // Prefer PNG-friendly wide logos implicitly via vote_average tiebreak.
    return s;
  };
  return [...logos].sort((a, b) => score(b) - score(a))[0]?.file_path ?? null;
}

function toProviderInfos(list: TmdbWatchProvider[] | undefined): ProviderInfo[] {
  if (!list) return [];
  return list
    .map((p) => ({
      providerId: p.provider_id,
      name: p.provider_name,
      logoPath: p.logo_path,
      priority: p.display_priority,
    }))
    .sort((a, b) => a.priority - b.priority);
}

export function regionWatch(entry: TmdbWatchProviderEntry | undefined): RegionWatch {
  return {
    link: entry?.link ?? null,
    flatrate: toProviderInfos(entry?.flatrate),
    rent: toProviderInfos(entry?.rent),
    buy: toProviderInfos(entry?.buy),
    ads: toProviderInfos(entry?.ads),
    free: toProviderInfos(entry?.free),
  };
}

function cast(members: TmdbCastMember[] | undefined): Person[] {
  if (!members) return [];
  return [...members]
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .slice(0, 18)
    .map((m) => ({
      id: m.id,
      name: m.name,
      role: m.character ?? "",
      profilePath: m.profile_path,
    }));
}

function keyCrew(members: TmdbCrewMember[] | undefined): Person[] {
  if (!members) return [];
  const wanted = new Set(["Director", "Creator", "Writer", "Screenplay", "Executive Producer"]);
  return members
    .filter((m) => m.job && wanted.has(m.job))
    .slice(0, 8)
    .map((m) => ({ id: m.id, name: m.name, role: m.job ?? "", profilePath: m.profile_path }));
}

function certification(raw: TmdbDetail, region: string, type: MediaType): string | null {
  if (type === "movie") {
    const entry = raw.release_dates?.results.find((r) => r.iso_3166_1 === region);
    const cert = entry?.release_dates.map((d) => d.certification).find((c) => c);
    return cert || null;
  }
  const rating = raw.content_ratings?.results.find((r) => r.iso_3166_1 === region)?.rating;
  return rating || null;
}

function seasons(raw: TmdbDetail): SeasonSummary[] {
  if (!raw.seasons) return [];
  return raw.seasons
    .filter((s) => s.season_number >= 0)
    .map((s) => ({
      seasonNumber: s.season_number,
      name: s.name,
      episodeCount: s.episode_count,
      airDate: s.air_date,
    }));
}

export function toDetail(
  raw: TmdbDetail,
  type: MediaType,
  region: string,
  language: string,
): MediaDetail {
  const summary = toSummary(raw, type)!;
  const runtime =
    type === "movie" ? raw.runtime ?? null : raw.episode_run_time?.[0] ?? null;
  const keywords =
    raw.keywords?.keywords ?? raw.keywords?.results ?? [];
  const watchEntry = raw["watch/providers"]?.results?.[region];

  return {
    ...summary,
    tagline: raw.tagline ?? "",
    genres: raw.genres ?? [],
    runtime,
    releaseDate: raw.release_date || raw.first_air_date || null,
    certification: certification(raw, region, type),
    cast: cast(raw.credits?.cast),
    crew: keyCrew(raw.credits?.crew),
    videos: toVideos(raw.videos?.results),
    trailer: pickTrailer(raw.videos?.results),
    logoPath: pickLogo(raw.images?.logos, language),
    keywords: keywords.map((k) => ({ id: k.id, name: k.name })),
    watch: regionWatch(watchEntry),
    recommendations: toSummaries(raw.recommendations?.results),
    similar: toSummaries(raw.similar?.results),
    seasons: seasons(raw),
    numberOfSeasons: raw.number_of_seasons ?? null,
  };
}
