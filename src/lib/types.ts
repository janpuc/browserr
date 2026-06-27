/**
 * Normalized domain types shared by the BFF and the UI. These are deliberately
 * decoupled from raw TMDB/Seerr shapes so the client never depends on upstream
 * payloads (and never sees secrets/internal URLs).
 */

export type MediaType = "movie" | "tv";

export interface MediaSummary {
  id: number;
  mediaType: MediaType;
  title: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  year: number | null;
  voteAverage: number;
  popularity: number;
  genreIds: number[];
  originalLanguage: string;
}

export interface Person {
  id: number;
  name: string;
  role: string; // character (cast) or job (crew)
  profilePath: string | null;
}

export interface Video {
  key: string; // YouTube key
  site: string;
  type: string; // Trailer | Teaser | Clip ...
  name: string;
  official: boolean;
}

export interface ProviderInfo {
  providerId: number;
  name: string;
  logoPath: string | null;
  priority: number;
}

/** "Where to watch" for a single title, already filtered to the active region. */
export interface RegionWatch {
  link: string | null;
  flatrate: ProviderInfo[];
  rent: ProviderInfo[];
  buy: ProviderInfo[];
  ads: ProviderInfo[];
  free: ProviderInfo[];
}

export interface SeasonSummary {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  airDate: string | null;
  /** Seerr availability status for this season, if known. */
  status?: number;
}

export interface MediaDetail extends MediaSummary {
  tagline: string;
  genres: { id: number; name: string }[];
  runtime: number | null; // minutes (movie) or avg episode runtime (tv)
  releaseDate: string | null;
  certification: string | null;
  cast: Person[];
  crew: Person[];
  videos: Video[];
  trailer: Video | null;
  logoPath: string | null;
  keywords: { id: number; name: string }[];
  watch: RegionWatch;
  recommendations: MediaSummary[];
  similar: MediaSummary[];
  seasons: SeasonSummary[];
  numberOfSeasons: number | null;
}

/** TMDB watch-provider summary for the region service picker. */
export interface RegionProvider {
  providerId: number;
  name: string;
  logoPath: string | null;
  priority: number;
}

export interface RegionOption {
  code: string; // ISO 3166-1 alpha-2
  name: string;
}

// ── Seerr availability ───────────────────────────────────────────────────────

export const MEDIA_STATUS = {
  UNKNOWN: 0,
  PENDING: 2,
  PROCESSING: 3,
  PARTIALLY_AVAILABLE: 4,
  AVAILABLE: 5,
} as const;

export interface Availability {
  status: number; // Seerr mediaInfo.status (0/2/3/4/5); 0 = unknown/not found
  seasons?: Record<number, number>; // seasonNumber -> status (TV)
  /** False when Seerr is unreachable/unconfigured - UI shows "unknown". */
  known: boolean;
}

// ── Home feed rails ──────────────────────────────────────────────────────────

export type RailKind = "standard" | "top10" | "because" | "library" | "genre" | "service";

export interface Rail {
  id: string;
  title: string;
  kind: RailKind;
  items: MediaSummary[];
  context?: {
    becauseOf?: { id: number; mediaType: MediaType; title: string };
    serviceId?: number;
    genreId?: number;
    reason?: string;
  };
}

export interface HeroSlide {
  item: MediaSummary;
  logoPath: string | null;
  trailer: Video | null;
  certification: string | null;
  runtime: number | null;
  genres: string[];
}

export interface HomeFeed {
  hero: HeroSlide[];
  rails: Rail[];
}

export interface TitleResponse {
  detail: MediaDetail;
  availability: Availability;
  request: { mode: "redirect" | "proxy"; redirectUrl: string | null };
}
